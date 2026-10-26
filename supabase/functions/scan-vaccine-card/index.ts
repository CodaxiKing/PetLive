// PetLive: lê a foto do cartão de vacina e devolve as vacinas para o tutor
// revisar antes de salvar (BUSINESS.md 5.22, Premium). A foto chega no corpo
// da requisição, vai só para o serviço de leitura e não é guardada.
//
// Serviço de leitura: Claude (Anthropic) com saída estruturada. Precisa do
// segredo ANTHROPIC_API_KEY nas Edge Functions do projeto.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod';
import { z } from 'npm:zod@4.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
const LIMITE_BYTES = 5 * 1024 * 1024;

const Leitura = z.object({
  legivel: z.boolean(),
  vacinas: z.array(
    z.object({
      nome: z.string(),
      aplicada_em: z.string().nullable(),
      proxima_dose: z.string().nullable(),
      lote: z.string().nullable(),
      veterinario: z.string().nullable(),
      confianca: z.enum(['alta', 'media', 'baixa']),
    }),
  ),
});

const INSTRUCOES = `Você lê fotos de cartões de vacina de cães e gatos no Brasil.
Liste cada vacina aplicada que aparece no cartão, uma por linha do cartão.
- nome: o nome da vacina como está escrito (ex.: V10, V8, Antirrábica, Giárdia, Gripe canina, V4 felina, V5 felina). Se houver só a etiqueta do fabricante, use o nome comercial da etiqueta.
- aplicada_em e proxima_dose: datas no formato AAAA-MM-DD. Cartões brasileiros escrevem DD/MM/AA ou DD/MM/AAAA. Se a data não estiver legível, use null.
- lote: o número do lote da etiqueta, ou null.
- veterinario: nome ou CRMV de quem aplicou, ou null.
- confianca: baixa quando você precisou adivinhar alguma letra ou número.
Não invente vacinas, datas ou lotes. Se a foto não for de um cartão de vacina ou estiver ilegível, responda legivel=false e a lista vazia.`;

function cors(resp: Response): Response {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return resp;
}

function erro(mensagem: string, status: number): Response {
  return cors(Response.json({ erro: mensagem }, { status }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return cors(new Response('ok'));
  if (req.method !== 'POST') return erro('Use POST.', 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return erro('Entre na sua conta para ler o cartão.', 401);

  let corpo: { pet_id?: string; imagem?: string; tipo?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro('Envio inválido.', 400);
  }
  const tipo = (corpo.tipo ?? 'image/jpeg') as (typeof TIPOS)[number];
  if (!corpo.pet_id || !corpo.imagem || !TIPOS.includes(tipo)) return erro('Envie a foto do cartão em JPEG, PNG ou WebP.', 400);
  // base64 ocupa ~4/3 do arquivo.
  if (corpo.imagem.length * 0.75 > LIMITE_BYTES) return erro('A foto deve ter até 5 MB.', 413);

  // As regras (Premium, acesso ao pet e limite do mês) ficam no banco, com a conta de quem chamou.
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: reserva, error: erroReserva } = await supabase.rpc('cartao_leitura_reservar', { p_pet_id: corpo.pet_id });
  if (erroReserva) return erro(erroReserva.message, erroReserva.hint === 'plano_limite' ? 402 : 403);
  const leituraId = (reserva as { id: string; restantes: number }).id;

  const concluir = (ok: boolean, vacinas?: number) =>
    supabase.rpc('cartao_leitura_concluir', { p_id: leituraId, p_ok: ok, p_vacinas: vacinas ?? null });

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    await concluir(false);
    return erro('A leitura do cartão ainda não está disponível. Registre as vacinas à mão.', 503);
  }

  try {
    const client = new Anthropic();
    const resposta = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: zodOutputFormat(Leitura) },
      system: INSTRUCOES,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipo, data: corpo.imagem } },
            { type: 'text', text: 'Leia as vacinas deste cartão.' },
          ],
        },
      ],
    });

    if (resposta.stop_reason === 'refusal' || !resposta.parsed_output) {
      await concluir(false);
      return erro('Não deu para ler este cartão. Tente outra foto ou registre à mão.', 422);
    }
    const leitura = resposta.parsed_output;
    await concluir(leitura.legivel, leitura.vacinas.length);
    return cors(Response.json({ ...leitura, restantes: (reserva as { restantes: number }).restantes }));
  } catch (e) {
    await concluir(false);
    // Sem detalhes do provedor para o app; a vaga do mês é devolvida.
    console.error('scan-vaccine-card', e instanceof Anthropic.APIError ? e.status : 'erro');
    if (e instanceof Anthropic.RateLimitError) return erro('Muitas leituras agora. Tente de novo em alguns minutos.', 429);
    return erro('Não deu para ler o cartão agora. Tente de novo.', 502);
  }
});

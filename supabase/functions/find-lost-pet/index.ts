// PetLive: Achei um pet (BUSINESS.md 5.38). Compara a foto de quem achou um
// pet só com as fotos de alertas de pet perdido ativos por perto, cujo tutor
// aceitou esse uso. A foto chega no corpo da requisição, vai só para o serviço
// de comparação e não é guardada. Devolve até 5 candidatos com o nível de
// semelhança em palavras, nunca uma porcentagem, e nunca afirma que é o pet.
//
// Serviço de comparação: Claude (Anthropic) com saída estruturada. Precisa do
// segredo ANTHROPIC_API_KEY nas Edge Functions do projeto.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { comparar, TIPOS, type Imagem } from './comparar.ts';

const LIMITE_BYTES = 5 * 1024 * 1024;
type Alerta = { alert_id: string; nome: string; especie: string; foto_url: string; visto_em: string; distancia_km: number };

function cors(resp: Response): Response {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return resp;
}

function erro(mensagem: string, status: number, extra: Record<string, unknown> = {}): Response {
  return cors(Response.json({ erro: mensagem, ...extra }, { status }));
}

/** Baixa a foto do alerta (bucket público de pets). Fotos que falham ficam de fora. */
async function baixar(url: string): Promise<Imagem | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const tipo = (r.headers.get('content-type') ?? '').split(';')[0] as (typeof TIPOS)[number];
    if (!r.ok || !TIPOS.includes(tipo)) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > LIMITE_BYTES) return null;
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { data: btoa(bin), tipo };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return cors(new Response('ok'));
  if (req.method !== 'POST') return erro('Use POST.', 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return erro('Entre na sua conta para buscar.', 401);

  let corpo: { imagem?: string; tipo?: string; lat?: number; lng?: number };
  try {
    corpo = await req.json();
  } catch {
    return erro('Envio inválido.', 400);
  }
  const tipo = (corpo.tipo ?? 'image/jpeg') as (typeof TIPOS)[number];
  if (!corpo.imagem || !TIPOS.includes(tipo)) return erro('Envie a foto em JPEG, PNG ou WebP.', 400);
  if (corpo.imagem.length * 0.75 > LIMITE_BYTES) return erro('A foto deve ter até 5 MB.', 413);
  if (typeof corpo.lat !== 'number' || typeof corpo.lng !== 'number') return erro('Autorize a localização para buscar alertas perto de você.', 400);

  // Recurso ligado, limite do dia e quais alertas entram: tudo no banco, com a conta de quem chamou.
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: reserva, error: erroReserva } = await supabase.rpc('achei_reservar', { p_lat: corpo.lat, p_lng: corpo.lng });
  if (erroReserva) return erro(erroReserva.message, erroReserva.hint === 'limite' ? 429 : erroReserva.hint === 'desligada' ? 503 : 403);
  const { id: buscaId, alertas } = reserva as { id: string; alertas: Alerta[] };
  const concluir = (ok: boolean, candidatos?: { alert_id: string; nivel: string }[]) =>
    supabase.rpc('achei_concluir', { p_id: buscaId, p_ok: ok, p_candidatos: candidatos ?? null });

  if (alertas.length === 0) {
    await concluir(true, []);
    return cors(Response.json({ candidatos: [] }));
  }
  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    await concluir(false);
    return erro('A busca por foto ainda não está disponível. Veja os alertas perto de você.', 503);
  }

  const fotos = (await Promise.all(alertas.map(async (a) => ({ a, foto: await baixar(a.foto_url) })))).filter((x) => x.foto);
  if (fotos.length === 0) {
    await concluir(false);
    return erro('Não deu para comparar agora. Tente de novo.', 502);
  }

  try {
    const r = await comparar(
      new Anthropic(),
      { data: corpo.imagem, tipo },
      fotos.map(({ a, foto }) => ({ ...foto!, especie: a.especie })),
    );
    if (!r) {
      await concluir(false);
      return erro('Não deu para comparar esta foto. Tente outra.', 422);
    }
    if (!r.foto_valida) {
      await concluir(false);
      const texto = r.motivo === 'pessoa_no_rosto'
        ? 'Tire outra foto só do pet, sem o rosto de pessoas.'
        : r.motivo === 'sem_pet'
          ? 'Não encontramos um cão ou gato na foto. Tente outra.'
          : 'A foto ficou escura ou borrada. Tente de novo com mais luz.';
      return erro(texto, 422, { motivo: r.motivo });
    }

    const ordem = { muito_parecido: 0, parecido: 1, pouco_parecido: 2 } as const;
    const candidatos = r.candidatos
      .filter((c): c is { numero: number; nivel: keyof typeof ordem } => c.nivel !== 'diferente' && c.numero >= 1 && c.numero <= fotos.length)
      .filter((c, i, lista) => lista.findIndex((x) => x.numero === c.numero) === i)
      .map((c) => ({ ...fotos[c.numero - 1].a, nivel: c.nivel }))
      .sort((x, y) => ordem[x.nivel] - ordem[y.nivel] || x.distancia_km - y.distancia_km)
      .slice(0, 5);
    await concluir(true, candidatos.map((c) => ({ alert_id: c.alert_id, nivel: c.nivel })));
    return cors(Response.json({ candidatos }));
  } catch (e) {
    await concluir(false);
    console.error('find-lost-pet', e instanceof Anthropic.APIError ? e.status : 'erro');
    if (e instanceof Anthropic.RateLimitError) return erro('Muitas buscas agora. Tente de novo em alguns minutos.', 429);
    return erro('Não deu para comparar agora. Tente de novo.', 502);
  }
});

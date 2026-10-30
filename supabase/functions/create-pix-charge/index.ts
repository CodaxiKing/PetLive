// PetLive: cria a cobrança Pix de um pedido da loja ou do álbum do ano
// (BUSINESS.md 5.4 e 23). O tutor chama com a própria sessão; o banco confere
// dono, status e valor (pagamento_preparar / album_pagamento_preparar) antes de
// falarmos com o provedor. O CPF vai só para o provedor, nunca para o banco.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ErroPagamento, provedorPadrao } from '../_shared/pagamentos/provedor.ts';

type Pedido = { pedido?: string; album?: string; cpf?: string; nome?: string };
type Preparo = { id: string; pronto: boolean; amount_cents?: number; descricao?: string; expires_at?: string; customer_id?: string | null };

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'metodo', mensagem: 'Use POST.' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ erro: 'sem_sessao', mensagem: 'Entre na sua conta.' }, 401);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const servico = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  let corpo: Pedido;
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'dados', mensagem: 'Pedido inválido.' }, 400);
  }
  const uuid = /^[0-9a-f-]{36}$/i;
  const alvo = corpo.pedido && uuid.test(corpo.pedido) ? { rpc: 'pagamento_preparar', args: { p_request: corpo.pedido } }
    : corpo.album && uuid.test(corpo.album) ? { rpc: 'album_pagamento_preparar', args: { p_order: corpo.album } } : null;
  if (!alvo) return json({ erro: 'dados', mensagem: 'Informe o pedido.' }, 400);

  const { data: preparo, error } = await usuario.rpc(alvo.rpc, alvo.args);
  if (error) return json({ erro: 'pedido', mensagem: error.message }, 400);
  const p = preparo as Preparo;
  if (p.pronto) return json({ id: p.id });

  try {
    const provedor = provedorPadrao();
    let cliente = p.customer_id ?? null;
    if (!cliente) {
      const { data: quem } = await usuario.auth.getUser();
      if (!quem.user) return json({ erro: 'sem_sessao', mensagem: 'Entre na sua conta.' }, 401);
      if (!corpo.cpf || !corpo.nome?.trim()) return json({ erro: 'cpf', mensagem: 'Informe nome e CPF para gerar o Pix.' }, 400);
      cliente = await provedor.criarCliente({ nome: corpo.nome.trim(), cpf: corpo.cpf, referencia: quem.user.id });
    }
    const pix = await provedor.criarPix({
      cliente,
      valorCentavos: p.amount_cents ?? 0,
      descricao: p.descricao ?? 'PetLive',
      referencia: p.id,
      venceEm: new Date(p.expires_at ?? Date.now() + 30 * 60000),
    });
    const { error: erroRegistro } = await servico.rpc('pagamento_registrar', {
      p_payment: p.id, p_provider_id: pix.id, p_payload: pix.payload, p_qr: pix.qrBase64,
      p_expira: pix.expiraEm ? new Date(pix.expiraEm.replace(' ', 'T') + '-03:00').toISOString() : null,
      p_customer_id: p.customer_id ? null : cliente,
    });
    if (erroRegistro) return json({ erro: 'interno', mensagem: 'Não deu para salvar a cobrança. Tente de novo.' }, 500);
    return json({ id: p.id });
  } catch (e) {
    if (e instanceof ErroPagamento) {
      const status = { sem_chave: 503, provedor: 502, dados: 400, nao_autorizado: 401 }[e.codigo];
      return json({ erro: e.codigo, mensagem: e.message }, status);
    }
    return json({ erro: 'interno', mensagem: 'Não deu para gerar o Pix. Tente de novo.' }, 500);
  }
});

// PetLive: recebe a confirmação de pagamento do provedor (BUSINESS.md 5.4).
// Sem sessão de usuário (verify_jwt = false): a autenticidade vem do token do
// webhook. A confirmação é idempotente no banco, então repetições são seguras.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ErroPagamento, provedorPadrao } from '../_shared/pagamentos/provedor.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response('corpo inválido', { status: 400 });
  }
  let evento;
  try {
    evento = provedorPadrao().lerWebhook(req.headers, corpo);
  } catch (e) {
    if (e instanceof ErroPagamento) return new Response('nao autorizado', { status: 401 });
    throw e;
  }
  if (evento.tipo === 'ignorado') return Response.json({ ok: true });

  const servico = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { error } = await servico.rpc('pagamento_confirmado', {
    p_provider_id: evento.id,
    p_valor_cents: evento.valorCentavos,
    // O provedor informa só o dia; o aviso chega na hora, então vale o horário do recebimento.
    p_pago_em: null,
  });
  // Erro devolve 500 para o provedor tentar de novo mais tarde.
  if (error) return new Response('erro ao confirmar', { status: 500 });
  return Response.json({ ok: true });
});

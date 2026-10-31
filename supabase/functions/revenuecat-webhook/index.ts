// PetLive: recebe do RevenueCat os eventos da assinatura Premium feita na
// Google Play ou na App Store (BUSINESS.md 5.13) e liga ou desliga o Premium.
// Sem sessão de usuário (verify_jwt = false): a autenticidade vem do cabeçalho
// Authorization configurado no painel do RevenueCat (REVENUECAT_WEBHOOK_AUTH).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { traduzirEvento, type EventoRevenueCat } from './evento.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  const segredo = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
  if (!segredo || req.headers.get('Authorization') !== segredo) return new Response('nao autorizado', { status: 401 });

  let corpo: { event?: EventoRevenueCat };
  try {
    corpo = await req.json();
  } catch {
    return new Response('corpo inválido', { status: 400 });
  }
  const a = traduzirEvento(corpo.event ?? {});
  if (!a) return Response.json({ ok: true, ignorado: true });

  const servico = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data, error } = await servico.rpc('assinatura_loja_evento', {
    p_tutor: a.tutor, p_provedor: a.provedor, p_referencia: a.referencia, p_status: a.status,
    p_inicio: a.inicio, p_fim: a.fim, p_valor_centavos: a.valorCentavos, p_evento_em: a.eventoEm,
  });
  // Erro devolve 500 para o RevenueCat tentar de novo mais tarde.
  if (error) return new Response('erro ao registrar', { status: 500 });
  return Response.json(data);
});

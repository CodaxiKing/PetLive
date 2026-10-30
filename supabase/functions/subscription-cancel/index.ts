// PetLive: cancela a assinatura mantendo o Premium até o fim do período
// (BUSINESS.md 5.13). Com a sessão do tutor, agenda no banco
// (assinatura_cancelar) e para a recorrência no provedor. Com a chave de
// serviço (cron), retoma as recorrências que ficaram sem parar por falha.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { provedorPadrao } from '../_shared/pagamentos/provedor.ts';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'metodo', mensagem: 'Use POST.' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const servico = createClient(url, chaveServico, { auth: { persistSession: false } });

  let tutor: string | null = null;
  let resultado: unknown = null;
  if (auth !== `Bearer ${chaveServico}`) {
    if (!auth) return json({ erro: 'sem_sessao', mensagem: 'Entre na sua conta.' }, 401);
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const corpo = await req.json().catch(() => ({})) as { motivo?: string };
    const { data, error } = await usuario.rpc('assinatura_cancelar', { p_motivo: corpo.motivo ?? null });
    if (error) return json({ erro: error.hint === 'loja_apps' ? 'loja_apps' : 'pedido', mensagem: error.message }, 400);
    const { data: quem } = await usuario.auth.getUser();
    tutor = quem.user?.id ?? null;
    resultado = data;
  }

  // Para a recorrência no provedor. Sem sucesso agora, o cron tenta de novo; o cancelamento já vale no PetLive.
  const { data: pendentes } = await servico.rpc('assinaturas_para_cancelar', { p_tutor: tutor });
  let parados = 0;
  for (const p of (pendentes ?? []) as { id: string; referencia_provedor: string }[]) {
    try {
      await provedorPadrao().cancelarAssinatura(p.referencia_provedor);
      await servico.rpc('assinatura_cancelada_no_provedor', { p_id: p.id });
      parados++;
    } catch {
      // Fica marcada para a próxima tentativa.
    }
  }
  return json(resultado ?? { parados });
});

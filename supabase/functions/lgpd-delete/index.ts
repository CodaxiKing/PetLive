// PetLive: executa as exclusões de conta vencidas (LGPD, BUSINESS.md 12).
// Chamada todo dia pelo pg_cron (migração 20261024030000_lgpd_pedidos_com_prazo).
//
// Para cada pedido vencido: apaga os arquivos do tutor no Storage (o SQL não
// pode apagar storage.objects) e depois o usuário do Auth, que leva junto
// profiles e todos os dados em cascata. Se algo falhar, o pedido fica
// "em_andamento" e é retomado na próxima execução.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKETS = ['pets', 'anexos'];

Deno.serve(async (req) => {
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Só o cron (com a service_role) pode disparar.
  if (!chave || req.headers.get('Authorization') !== `Bearer ${chave}`) {
    return new Response('nao autorizado', { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', chave, {
    auth: { persistSession: false },
  });

  const { data: pedidos, error } = await supabase.rpc('lgpd_exclusoes_vencidas');
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const resultado: { pedido: string; ok: boolean; erro?: string }[] = [];

  for (const pedido of (pedidos ?? []) as { id: string; user_id: string }[]) {
    try {
      // Arquivos ficam em <bucket>/<user_id>/<arquivo> (mesma regra das policies).
      for (const bucket of BUCKETS) {
        for (;;) {
          const { data: arquivos, error: erroLista } = await supabase.storage
            .from(bucket)
            .list(pedido.user_id, { limit: 1000 });
          if (erroLista) throw erroLista;
          const caminhos = (arquivos ?? []).filter((a) => a.name).map((a) => `${pedido.user_id}/${a.name}`);
          if (caminhos.length === 0) break;
          const { error: erroRemover } = await supabase.storage.from(bucket).remove(caminhos);
          if (erroRemover) throw erroRemover;
        }
      }

      const { error: erroConcluir } = await supabase.rpc('lgpd_concluir_exclusao', { p_pedido: pedido.id });
      if (erroConcluir) throw erroConcluir;
      resultado.push({ pedido: pedido.id, ok: true });
    } catch (e) {
      resultado.push({ pedido: pedido.id, ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ processados: resultado.length, resultado });
});

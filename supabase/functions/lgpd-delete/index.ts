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
      // Arquivos ficam em <bucket>/<user_id>/... (mesma regra das policies),
      // inclusive em subpastas (anexos/<pet>, marcos, despesas).
      for (const bucket of BUCKETS) {
        await apagarPasta(supabase, bucket, pedido.user_id);
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

type Cliente = ReturnType<typeof createClient>;

/** Apaga tudo dentro da pasta, descendo nas subpastas (o list do Storage não é recursivo). */
async function apagarPasta(supabase: Cliente, bucket: string, pasta: string): Promise<void> {
  for (;;) {
    const { data: itens, error: erroLista } = await supabase.storage.from(bucket).list(pasta, { limit: 1000 });
    if (erroLista) throw erroLista;
    // Subpasta vem sem id; arquivo vem com id.
    const subpastas = (itens ?? []).filter((i) => i.name && !i.id).map((i) => `${pasta}/${i.name}`);
    const arquivos = (itens ?? []).filter((i) => i.name && i.id).map((i) => `${pasta}/${i.name}`);
    for (const sub of subpastas) await apagarPasta(supabase, bucket, sub);
    if (arquivos.length === 0) return;
    const { error: erroRemover } = await supabase.storage.from(bucket).remove(arquivos);
    if (erroRemover) throw erroRemover;
  }
}

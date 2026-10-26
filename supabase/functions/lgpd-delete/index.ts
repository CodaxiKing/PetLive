// PetLive: executa as exclusões de conta vencidas (LGPD, BUSINESS.md 12).
// Chamada todo dia pelo pg_cron (migração 20261024030000_lgpd_pedidos_com_prazo).
//
// Para cada pedido vencido: apaga os arquivos do tutor no Storage (o SQL não
// pode apagar storage.objects) e depois o usuário do Auth, que leva junto
// profiles e todos os dados em cascata. Se algo falhar, o pedido fica
// "em_andamento" e é retomado na próxima execução.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { processarExclusao } from './processar.mjs';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Só o cron (com a service_role) pode disparar.
  if (!chave || req.headers.get('Authorization') !== `Bearer ${chave}`) {
    return new Response('nao autorizado', { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', chave, {
    auth: { persistSession: false },
  });

  try {
    const resultado = await processarExclusao(supabase);
    return Response.json(resultado, { status: resultado.retentar ? 503 : 200 });
  } catch {
    return Response.json({ erro: 'Não foi possível processar a fila.' }, { status: 503 });
  }
});

// Cancelar a assinatura: agenda, mantém o Premium até o fim, reativa, recusa
// assinatura da loja de apps e encerra pelo cron.
// Rode com: node supabase/tests/testar-cancelar-assinatura.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const ana = '44000000-0000-4000-8000-000000000001', bia = '44000000-0000-4000-8000-000000000002', caio = '44000000-0000-4000-8000-000000000003';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const linha = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]);
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${ana}', '{"name":"Ana"}'), ('${bia}', '{"name":"Bia"}'), ('${caio}', '{"name":"Caio"}');
    update public.profiles set plano = 'premium';
    insert into public.subscriptions(tutor_id, provedor, referencia_provedor, ciclo, status, periodo_inicio, periodo_fim, forma_pagamento, valor_centavos) values
      ('${ana}', 'asaas', 'sub_ana', 'anual', 'ativa', now() - interval '30 days', now() + interval '335 days', 'pix', 11880),
      ('${bia}', 'google_play', 'gp_bia', 'mensal', 'ativa', now() - interval '3 days', now() + interval '27 days', 'loja_apps', 1490);`);

  await entrar(db, ana);
  assert.equal((await um('select public.minha_assinatura($1) as r', [ana])).gestao_disponivel, true);
  const r = await um("select public.assinatura_cancelar('Caro demais') as r");
  assert.equal(r.status, 'cancelando');
  assert.equal((await um('select public.assinatura_cancelar() as r')).status, 'cancelando', 'repetir é seguro');
  const minha = await um('select public.minha_assinatura($1) as r', [ana]);
  assert.equal(minha.plano, 'premium', 'Premium continua até o fim do período');
  assert.equal(minha.assinatura.status, 'cancelando');
  await assert.rejects(um('select public.assinaturas_encerrar() as r'), /permission denied/);
  await assert.rejects(um('select * from public.assinaturas_para_cancelar()'), /permission denied/);

  // Reativar antes do provedor parar a recorrência; depois de parada, pede nova assinatura.
  assert.equal((await um('select public.assinatura_reativar() as r')).status, 'ativa');
  await um('select public.assinatura_cancelar() as r');
  await entrar(db, null, 'service_role');
  const pendentes = (await db.query('select * from public.assinaturas_para_cancelar()')).rows;
  assert.deepEqual(pendentes.map((p) => p.referencia_provedor), ['sub_ana']);
  await db.query('select public.assinatura_cancelada_no_provedor($1)', [pendentes[0].id]);
  await entrar(db, ana);
  await assert.rejects(um('select public.assinatura_reativar() as r'), /Assine de novo/);

  // Loja de apps: só orienta o caminho.
  await entrar(db, bia);
  await assert.rejects(um('select public.assinatura_cancelar() as r'), /Google Play/);
  assert.equal((await um('select public.minha_assinatura($1) as r', [bia])).gestao_disponivel, false);
  await entrar(db, caio);
  await assert.rejects(um('select public.assinatura_cancelar() as r'), /não tem uma assinatura/);

  // Fim do período: cancelada e plano grátis.
  await db.exec(`reset role; update public.subscriptions set periodo_fim = now() - interval '1 minute', periodo_inicio = now() - interval '1 year' where tutor_id = '${ana}';`);
  assert.equal(await um('select public.assinaturas_encerrar() as r'), 1);
  assert.equal((await linha('select status from public.subscriptions where tutor_id = $1', [ana])).status, 'cancelada');
  assert.equal((await linha('select plano from public.profiles where id = $1', [ana])).plano, 'gratis');
  assert.equal((await linha('select plano from public.profiles where id = $1', [bia])).plano, 'premium');
  await entrar(db, null, 'anon');
  await assert.rejects(um('select public.assinatura_cancelar() as r'), /permission denied/);
  console.log('Assinatura: cancelamento agendado, reativação, loja de apps e encerramento OK.');
} finally {
  await db.close();
}

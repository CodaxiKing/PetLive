// Premium pela loja de apps: preço público, eventos da loja ligando e
// desligando o Premium, teste da loja, cancelamento e evento atrasado.
// Rode com: node supabase/tests/testar-premium-loja.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const ana = '4b000000-0000-4000-8000-000000000001';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const dia = 86400000;
const em = (ms) => new Date(Date.now() + ms).toISOString();
const evento = (status, inicio, fim, eventoEm, valor = 1990) =>
  um('select public.assinatura_loja_evento($1, $2, $3, $4, $5, $6, $7, $8) as r',
    [ana, 'google_play', 'GPA.1234', status, inicio, fim, valor, eventoEm]);
const estado = async () => {
  await db.exec('reset role');
  const p = (await db.query('select plano from public.profiles where id = $1', [ana])).rows[0].plano;
  const s = (await db.query('select status, forma_pagamento from public.subscriptions where tutor_id = $1', [ana])).rows[0];
  return { plano: p, status: s?.status, forma: s?.forma_pagamento };
};
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${ana}', '{"name":"Ana"}');`);
  await entrar(db, null, 'anon');
  assert.deepEqual(await um('select public.premium_planos_publicos() as r'), [{ ciclo: 'mensal', preco_centavos: 1990, dias_teste: 7 }]);
  await assert.rejects(evento('ativa', em(0), em(30 * dia), em(0)), /permission denied/);
  await entrar(db, ana);
  await assert.rejects(evento('ativa', em(0), em(30 * dia), em(0)), /permission denied/, 'o tutor não se dá Premium');

  await entrar(db, null, 'service_role');
  // Teste de 7 dias da loja: Premium liberado, sem pagamento ainda.
  await evento('em_teste', em(0), em(7 * dia), em(0), null);
  assert.deepEqual(await estado(), { plano: 'premium', status: 'em_teste', forma: 'loja_apps' });
  // Fim do teste com cobrança: ativa por um mês.
  await evento('ativa', em(0), em(37 * dia), em(1000));
  assert.deepEqual(await estado(), { plano: 'premium', status: 'ativa', forma: 'loja_apps' });
  // Aviso atrasado do teste não desfaz a renovação.
  await entrar(db, null, 'service_role');
  assert.equal((await evento('em_teste', em(0), em(7 * dia), em(500), null)).ignorado, 'evento_antigo');
  // Cancelou na loja: continua Premium até o fim do período.
  await entrar(db, null, 'service_role');
  await evento('cancelando', em(0), em(37 * dia), em(2000));
  assert.deepEqual(await estado(), { plano: 'premium', status: 'cancelando', forma: 'loja_apps' });
  // Venceu: volta ao grátis com aviso.
  await entrar(db, null, 'service_role');
  await evento('expirada', em(-40 * dia), em(-1000), em(3000));
  assert.deepEqual(await estado(), { plano: 'gratis', status: 'expirada', forma: 'loja_apps' });
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int n from public.notification_log where user_id = $1 and title = 'Seu Premium terminou'", [ana])).rows[0].n, 1);

  // Minha assinatura mostra a loja e não oferece cancelar pelo app.
  await entrar(db, ana);
  const minha = await um('select public.minha_assinatura($1) as r', [ana]);
  assert.equal(minha.assinatura.provedor, 'google_play');
  assert.equal(minha.gestao_disponivel, false);
  await entrar(db, null, 'service_role');
  assert.equal((await um("select public.assinatura_loja_evento($1, 'google_play', 'X', 'ativa', now(), now() + interval '1 day', null, now()) as r",
    ['4b000000-0000-4000-8000-000000000099'])).motivo, 'tutor_desconhecido');
  console.log('Premium pela loja: preço, teste da loja, renovação, cancelamento, vencimento e evento atrasado OK.');
} finally {
  await db.close();
}

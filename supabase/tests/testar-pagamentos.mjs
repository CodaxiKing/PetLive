// Pix no app e cupons: pedido esperando pagamento, cobrança, confirmação
// repetida, expiração, desistência, estorno e limites do cupom.
// Rode com: node supabase/tests/testar-pagamentos.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const tutor = '43000000-0000-4000-8000-000000000001', outro = '43000000-0000-4000-8000-000000000002', dono = '43000000-0000-4000-8000-000000000003';
const loja = '53000000-0000-4000-8000-000000000001', produto = '63000000-0000-4000-8000-000000000001';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const linha = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]);
const pedir = (pay, cupom = null) =>
  um("select public.solicitacao_criar($1, $2::jsonb, 'retirada', null, null, $3, $4) as r",
    [loja, JSON.stringify([{ product_id: produto, qty: 1 }]), pay, cupom]);
const avisosLoja = async () => {
  await db.exec('reset role');
  return (await linha('select count(*)::int as n from public.notification_log where user_id = $1', [dono])).n;
};
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}'), ('${outro}', '{"name":"Bia"}'), ('${dono}', '{"name":"Caio"}');
    insert into public.stores(id, name, status, kind) values ('${loja}', 'Patinhas', 'aprovada', 'petshop');
    insert into public.store_members(store_id, user_id, role) values ('${loja}', '${dono}', 'owner');
    insert into public.products(id, store_id, name, price_cents, stock) values ('${produto}', '${loja}', 'Ração 10 kg', 18990, 50);`);

  // Cupom: só dono ou gerente cria; o código é normalizado.
  await entrar(db, tutor);
  await assert.rejects(um("select public.loja_cupom_salvar($1, 'XYZ', 'percentual', 10) as r", [loja]), /dono ou o gerente/);
  await entrar(db, dono);
  await um("select public.loja_cupom_salvar($1, 'primeira10', 'percentual', 10, '10% no primeiro pedido', 0, true) as r", [loja]);
  await um("select public.loja_cupom_salvar($1, 'GRANDE', 'valor', 5000, null, 50000) as r", [loja]);

  await entrar(db, tutor);
  const lista = await um('select public.cupons_para_mim($1) as r', [loja]);
  assert.deepEqual(lista.map((c) => c.code).sort(), ['GRANDE', 'PRIMEIRA10']);
  assert.equal((await um("select public.cupom_aplicar($1, ' primeira10 ', 18990) as r", [loja])).desconto_cents, 1899);
  await assert.rejects(um("select public.cupom_aplicar($1, 'GRANDE', 18990) as r", [loja]), /a partir de R\$ 500,00/);
  await assert.rejects(um("select public.cupom_aplicar($1, 'NADA', 18990) as r", [loja]), /não encontrado/);

  // Pix com cupom: o pedido espera o pagamento e a loja ainda não é avisada.
  const avisosAntes = await avisosLoja();
  await entrar(db, tutor);
  const pedido = await pedir('pix_app', 'primeira10');
  assert.equal(pedido.status, 'aguardando_pagamento');
  assert.equal(pedido.total_cents, 17091);
  assert.equal(await avisosLoja(), avisosAntes, 'loja não vê pedido sem pagamento');
  await entrar(db, tutor);
  await assert.rejects(pedir('na_loja', 'PRIMEIRA10'), /já usou/);

  // Cobrança: preparar é idempotente enquanto o Pix está em aberto.
  assert.equal(await um('select public.pagamento_precisa_cpf() as r'), true, 'primeiro Pix pede CPF');
  const prep = await um('select public.pagamento_preparar($1) as r', [pedido.id]);
  assert.equal(prep.pronto, false);
  assert.equal(prep.amount_cents, 17091);
  await entrar(db, outro);
  await assert.rejects(um('select public.pagamento_preparar($1) as r', [pedido.id]), /não encontrado/);
  await assert.rejects(um("select public.pagamento_confirmado('x', 1) as r"), /permission denied/);
  await entrar(db, tutor);
  await assert.rejects(um("select public.pagamento_registrar($1, 'pay_1', 'pix', 'qr', null) as r", [prep.id]), /permission denied/);
  await entrar(db, null, 'service_role');
  await um("select public.pagamento_registrar($1, 'pay_1', '000201pix', 'qr64', now() + interval '1 hour', 'cus_1') as r", [prep.id]);
  await entrar(db, tutor);
  assert.equal(await um('select public.pagamento_precisa_cpf() as r'), false, 'cliente guardado: não pede de novo');
  assert.deepEqual(await um('select public.pagamento_preparar($1) as r', [pedido.id]), { id: prep.id, pronto: true });
  const aberto = await um('select public.pagamento_detalhe($1) as r', [prep.id]);
  assert.equal(aberto.status, 'pendente');
  assert.equal(aberto.pix_payload, '000201pix');
  assert.equal(aberto.para, 'Patinhas');
  assert.ok(new Date(aberto.expires_at) <= new Date(Date.now() + 31 * 60000), 'Pix não passa de 30 min');
  await entrar(db, outro);
  assert.equal(await um('select public.pagamento_detalhe($1) as r', [prep.id]), null);

  // Confirmação (repetida pelo Asaas): o pedido vai para a loja uma vez só.
  await entrar(db, null, 'service_role');
  await assert.rejects(um("select public.pagamento_confirmado('pay_1', 100) as r"), /menor/);
  assert.equal((await um("select public.pagamento_confirmado('pay_1', 17091) as r")).ok, true);
  assert.equal((await um("select public.pagamento_confirmado('pay_1', 17091) as r")).repetido, true);
  assert.equal(await avisosLoja(), avisosAntes + 1);
  assert.equal((await linha('select status from public.requests where id = $1', [pedido.id])).status, 'enviada');
  await entrar(db, tutor);
  const pago = await um('select public.pagamento_detalhe($1) as r', [prep.id]);
  assert.equal(pago.status, 'pago');
  assert.equal(pago.pix_payload, null);
  assert.match(pago.codigo, /^PX-\d+$/);
  assert.deepEqual(pago.itens, ['Ração 10 kg × 1']);
  const detalhe = await um('select public.solicitacao_detalhe($1) as r', [pedido.id]);
  assert.equal(detalhe.solicitacao.pagamento.status, 'pago');
  assert.equal(detalhe.solicitacao.cupom, 'PRIMEIRA10');

  // Loja recusa pedido pago: estorno pendente e cupom devolvido.
  await entrar(db, dono);
  await um("select public.solicitacao_mudar($1, 'recusada', 'Sem estoque') as r", [pedido.id]);
  await db.exec('reset role');
  assert.equal((await linha('select status from public.payments where id = $1', [prep.id])).status, 'estorno_pendente');
  assert.equal((await linha("select usos from public.coupons where code = 'PRIMEIRA10'")).usos, 0);

  // Desistir antes de pagar: cancela sem avisar a loja.
  await entrar(db, tutor);
  const p2 = await pedir('pix_app');
  await um('select public.pagamento_preparar($1) as r', [p2.id]);
  const antes2 = await avisosLoja();
  await entrar(db, tutor);
  await um('select public.pagamento_desistir($1) as r', [p2.id]);
  assert.equal(await avisosLoja(), antes2);
  assert.equal((await linha('select status from public.payments where request_id = $1', [p2.id])).status, 'cancelado');

  // Pix vencido: pagamento e pedido expiram; pagar depois vira estorno.
  await entrar(db, tutor);
  const p3 = await pedir('pix_app');
  const prep3 = await um('select public.pagamento_preparar($1) as r', [p3.id]);
  await entrar(db, null, 'service_role');
  await um("select public.pagamento_registrar($1, 'pay_3', 'pix3', 'qr3', null) as r", [prep3.id]);
  await db.exec(`reset role; update public.requests set expira_em = now() - interval '1 minute' where id = '${p3.id}';
    update public.payments set expires_at = now() - interval '1 minute' where id = '${prep3.id}';`);
  assert.equal(await um('select public.pagamentos_expirar() as r'), 1);
  assert.equal((await linha('select status from public.requests where id = $1', [p3.id])).status, 'expirada');
  await um("select public.pagamento_confirmado('pay_3', 18990) as r");
  assert.equal((await linha('select status from public.payments where id = $1', [prep3.id])).status, 'estorno_pendente');

  // Pagar na loja continua igual.
  await entrar(db, tutor);
  assert.equal((await pedir('na_loja')).status, 'enviada');
  await assert.rejects(pedir('cartao'), /Pix ou pagar na loja/);
  await entrar(db, null, 'anon');
  await assert.rejects(um('select public.cupons_para_mim($1) as r', [loja]), /permission denied/);
  console.log('Pagamentos: Pix, confirmação idempotente, expiração, desistência, estorno e cupons OK.');
} finally {
  await db.close();
}

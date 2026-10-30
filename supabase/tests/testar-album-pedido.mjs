// Pedido do álbum impresso: cotação por formato e páginas, endereço com CEP,
// cobrança Pix, confirmação, comprovante, cancelamento e expiração.
// Rode com: node supabase/tests/testar-album-pedido.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const tutor = '47000000-0000-4000-8000-000000000001', outro = '47000000-0000-4000-8000-000000000002';
const pet = '77000000-0000-4000-8000-000000000001';
const endOk = '87000000-0000-4000-8000-000000000001', endSemCep = '87000000-0000-4000-8000-000000000002';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const itens = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => `marco:${i}:2026-01-01`));
const pedir = (n, formato = 'capa_dura_21x28', endereco = endOk) =>
  um('select public.album_pedido_criar($1, 2026, $2, $3::jsonb, $4) as r', [pet, formato, itens(n), endereco]);
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}'), ('${outro}', '{"name":"Bia"}');
    insert into public.pets(id, tutor_id, nome, especie) values ('${pet}', '${tutor}', 'Rex', 'cao');
    insert into public.addresses(id, user_id, street, number, neighborhood, city, cep) values
      ('${endOk}', '${tutor}', 'Rua Uruguai', '380', 'Tijuca', 'Rio de Janeiro', '20510060'),
      ('${endSemCep}', '${tutor}', 'Rua Sem Cep', '1', null, null, null);`);

  await entrar(db, tutor);
  const cot = await um('select public.album_formatos_cotar(25) as r');
  assert.equal(cot[0].paginas, 40);
  assert.equal(cot[0].preco_cents, 14900);
  assert.equal(cot[0].total_cents, 16750, 'R$ 149,00 + R$ 18,50 do protótipo');
  assert.equal((await um('select public.album_formatos_cotar(5) as r'))[1].paginas, 20);
  assert.equal((await um('select public.album_formatos_cotar(80) as r'))[0].paginas, 60);

  await assert.rejects(pedir(10, 'capa_dura_21x28', endSemCep), /CEP e cidade/);
  await assert.rejects(pedir(0), /1 a 60/);
  await assert.rejects(pedir(10, 'nao_existe'), /indisponível/);
  const p = await pedir(25);
  assert.equal(p.total_cents, 16750);
  await entrar(db, outro);
  await assert.rejects(um('select public.album_pedido_criar($1, 2026, $2, $3::jsonb, $4) as r', [pet, 'capa_dura_21x28', itens(3), endOk]), /dono do pet/);
  await assert.rejects(um('select public.album_pagamento_preparar($1) as r', [p.id]), /não encontrado/);
  assert.deepEqual(await um('select public.album_pedidos_meus() as r'), []);

  await entrar(db, tutor);
  const prep = await um('select public.album_pagamento_preparar($1) as r', [p.id]);
  assert.equal(prep.amount_cents, 16750);
  assert.match(prep.descricao, /Álbum do ano de Rex/);
  await entrar(db, null, 'service_role');
  await um("select public.pagamento_registrar($1, 'pay_alb', 'pixalb', 'qralb', null) as r", [prep.id]);
  assert.equal((await um("select public.pagamento_confirmado('pay_alb', 16750) as r")).ok, true);

  await entrar(db, tutor);
  const meus = await um('select public.album_pedidos_meus($1) as r', [pet]);
  assert.equal(meus[0].status, 'pago');
  assert.equal(meus[0].lembrancas, 25);
  assert.equal(meus[0].endereco, 'Rua Uruguai 380, Tijuca, Rio de Janeiro');
  const comprovante = await um('select public.pagamento_detalhe($1) as r', [prep.id]);
  assert.equal(comprovante.para, 'PetLive · gráfica parceira');
  assert.deepEqual(comprovante.itens, ['Álbum 2026 de Rex · 40 páginas']);
  await assert.rejects(um('select public.album_pedido_cancelar($1) as r', [p.id]), /não pode mais/);

  // Cancelar antes de pagar e expiração depois de 7 dias.
  const p2 = await pedir(3, 'flexivel_15x21');
  await um('select public.album_pagamento_preparar($1) as r', [p2.id]);
  await um('select public.album_pedido_cancelar($1) as r', [p2.id]);
  await db.exec('reset role');
  assert.equal((await db.query('select status from public.payments where album_order_id = $1', [p2.id])).rows[0].status, 'cancelado');
  await entrar(db, tutor);
  const p3 = await pedir(3);
  await db.exec(`reset role; update public.album_orders set criado_em = now() - interval '8 days' where id = '${p3.id}';`);
  await um('select public.pagamentos_expirar() as r');
  assert.equal((await db.query('select status from public.album_orders where id = $1', [p3.id])).rows[0].status, 'expirado');
  await entrar(db, null, 'anon');
  await assert.rejects(um('select public.album_formatos_cotar(5) as r'), /permission denied/);
  console.log('Álbum: cotação, endereço, Pix, confirmação, comprovante, cancelamento e expiração OK.');
} finally {
  await db.close();
}

// Consulta na clínica: tipo clínico na vitrine, reserva por horário e o
// histórico do pet acompanhando confirmação, remarcação e cancelamento.
// Rode com: node supabase/tests/testar-consulta-clinica.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const tutor = '45000000-0000-4000-8000-000000000001', vet = '45000000-0000-4000-8000-000000000002';
const clinica = '55000000-0000-4000-8000-000000000001', servico = '65000000-0000-4000-8000-000000000001';
const pet = '75000000-0000-4000-8000-000000000001';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const visitas = async () => {
  await db.exec('reset role');
  return (await db.query('select motivo, realizada_em::text as dia, local from public.visits where pet_id = $1', [pet])).rows;
};
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}'), ('${vet}', '{"name":"Dra. Lu"}');
    insert into public.pets(id, tutor_id, nome, especie) values ('${pet}', '${tutor}', 'Rex', 'cao');
    insert into public.stores(id, name, status, kind, oferece) values ('${clinica}', 'Clínica Vet Rio', 'aprovada', 'clinica', 'servicos');
    insert into public.store_members(store_id, user_id, role) values ('${clinica}', '${vet}', 'owner');
    insert into public.store_hours(store_id, weekday, opens, closes) select '${clinica}', d, '08:00', '18:00' from generate_series(0, 6) d;
    insert into public.services(id, store_id, name, modelo, duration_min, price_cents) values ('${servico}', '${clinica}', 'Consulta clínica geral', 'horario', 30, 18000);`);

  await entrar(db, tutor);
  await assert.rejects(um("select public.loja_servico_tipo_clinico($1, 'consulta') as r", [servico]), /não encontrado/);
  await entrar(db, vet);
  await um("select public.loja_servico_tipo_clinico($1, 'consulta') as r", [servico]);
  await entrar(db, tutor);
  const vitrine = await um('select public.loja_vitrine($1) as r', [clinica]);
  assert.equal(vitrine.servicos[0].tipo_clinico, 'consulta');

  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const livres = await um('select public.horarios_livres($1, $2::date) as r', [servico, amanha]);
  assert.ok(livres.length > 0, 'há horários amanhã');
  const reserva = await um('select public.servico_reservar($1, $2::timestamptz, $3) as r', [servico, livres[2].inicio, pet]);
  assert.equal(reserva.status, 'enviada');
  assert.deepEqual(await visitas(), [], 'só entra no histórico quando a clínica confirma');

  await entrar(db, vet);
  await um("select public.solicitacao_mudar($1, 'confirmada') as r", [reserva.id]);
  assert.deepEqual(await visitas(), [{ motivo: 'Consulta', dia: amanha, local: 'Clínica Vet Rio' }]);

  // Remarcar para depois de amanhã muda a data no histórico.
  const depois = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await entrar(db, tutor);
  const outros = await um('select public.horarios_livres($1, $2::date) as r', [servico, depois]);
  await db.query('select public.servico_remarcar($1, $2::timestamptz)', [reserva.id, outros[1].inicio]);
  assert.equal((await visitas())[0].dia, depois);

  await entrar(db, tutor);
  await um("select public.solicitacao_mudar($1, 'cancelada', 'Não vou poder') as r", [reserva.id]);
  assert.deepEqual(await visitas(), [], 'cancelada sai do histórico');
  console.log('Consulta na clínica: tipo clínico, reserva e histórico do pet OK.');
} finally {
  await db.close();
}

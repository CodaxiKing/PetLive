// SOS pré-chegada: clínicas 24 h perto, aviso com a ficha, resposta da
// clínica, mudar de clínica, Cheguei e quem pode ver cada aviso.
// Rode com: node supabase/tests/testar-sos-chegada.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const tutor = '46000000-0000-4000-8000-000000000001', outro = '46000000-0000-4000-8000-000000000002';
const vetA = '46000000-0000-4000-8000-000000000003', vetB = '46000000-0000-4000-8000-000000000004';
const clinA = '56000000-0000-4000-8000-000000000001', clinB = '56000000-0000-4000-8000-000000000002', petshop = '56000000-0000-4000-8000-000000000003';
const pet = '76000000-0000-4000-8000-000000000001';
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const avisos = async (uid) => {
  await db.exec('reset role');
  return (await db.query("select title from public.notification_log where user_id = $1 and type = 'sos' order by sent_at", [uid])).rows.map((r) => r.title);
};
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}'), ('${outro}', '{"name":"Bia"}'), ('${vetA}', '{"name":"Lu"}'), ('${vetB}', '{"name":"Rui"}');
    insert into public.pets(id, tutor_id, nome, especie) values ('${pet}', '${tutor}', 'Rex', 'cao');
    insert into public.stores(id, name, status, kind, oferece, lat, lng, phone, emergencia_24h) values
      ('${clinA}', 'Hospital Vet 24h Botafogo', 'aprovada', 'clinica', 'servicos', -22.951, -43.184, '2122220000', true),
      ('${clinB}', 'Vet 24h Tijuca', 'aprovada', 'clinica', 'servicos', -22.925, -43.232, '2133330000', true),
      ('${petshop}', 'Patinhas', 'aprovada', 'petshop', 'ambos', -22.950, -43.185, null, false);
    insert into public.store_members(store_id, user_id, role) values ('${clinA}', '${vetA}', 'owner'), ('${clinB}', '${vetB}', 'owner');
    insert into public.carteirinha_links(codigo, pet_id, tutor_id, secoes, conteudo, expira_em, tipo)
      values ('FICHA123', '${pet}', '${tutor}', '{dados,alergias}', '{}', now() + interval '6 hours', 'emergencia'),
             ('VENCIDA1', '${pet}', '${tutor}', '{dados}', '{}', now() - interval '1 hour', 'emergencia');`);

  await entrar(db, tutor);
  const perto = await um('select public.clinicas_24h_perto(-22.95, -43.18) as r');
  assert.deepEqual(perto.map((c) => c.name), ['Hospital Vet 24h Botafogo', 'Vet 24h Tijuca'], 'só clínicas 24 h, mais perto primeiro');
  await assert.rejects(um("select public.sos_chegada_criar($1, $2, 'FICHA123', 9) as r", [petshop, pet]), /não recebe avisos/);
  await assert.rejects(um("select public.sos_chegada_criar($1, $2, 'VENCIDA1', 9) as r", [clinA, pet]), /venceu/);
  const id = await um("select public.sos_chegada_criar($1, $2, 'FICHA123', 9) as r", [clinA, pet]);
  assert.equal(await um('select public.sos_chegada_atual() as r'), id);
  assert.deepEqual(await avisos(vetA), ['Emergência a caminho']);

  // Ninguém além do tutor e da clínica vê o aviso.
  await entrar(db, outro);
  assert.equal(await um('select public.sos_chegada_detalhe($1) as r', [id]), null);
  await assert.rejects(um("select public.sos_chegada_criar($1, $2, 'FICHA123', 9) as r", [clinA, pet]), /não disponível/);
  await entrar(db, vetB);
  assert.equal(await um('select public.sos_chegada_detalhe($1) as r', [id]), null);
  await assert.rejects(um("select public.sos_chegada_responder($1, 'vista') as r", [id]), /não encontrado/);

  // A clínica responde; a ficha e o telefone do tutor aparecem só para ela.
  await entrar(db, vetA);
  await um("select public.sos_chegada_responder($1, 'vista') as r", [id]);
  await um("select public.sos_chegada_responder($1, 'preparando') as r", [id]);
  await assert.rejects(um("select public.sos_chegada_responder($1, 'indisponivel') as r", [id]), /motivo/);
  const visto = await um('select public.sos_chegada_detalhe($1) as r', [id]);
  assert.equal(visto.status, 'preparando');
  assert.equal(visto.ficha.codigo, 'FICHA123');
  assert.equal((await um('select public.loja_emergencias($1) as r', [clinA])).length, 1);
  await entrar(db, tutor);
  const meu = await um('select public.sos_chegada_detalhe($1) as r', [id]);
  assert.ok(meu.vista_em && meu.preparando_em);
  assert.equal(meu.telefone_tutor, null);
  assert.deepEqual(await avisos(tutor), ['A clínica viu a ficha', 'Equipe se preparando']);

  // Sem vaga: o tutor muda de clínica com a mesma ficha.
  await entrar(db, vetA);
  await um("select public.sos_chegada_responder($1, 'indisponivel', 'Sem veterinário de plantão agora') as r", [id]);
  await entrar(db, tutor);
  assert.equal((await um('select public.sos_chegada_detalhe($1) as r', [id])).resposta, 'Sem veterinário de plantão agora');
  await assert.rejects(um('select public.sos_chegada_mudar_clinica($1, $2, 15) as r', [id, clinA]), /já está indo/);
  const novo = await um('select public.sos_chegada_mudar_clinica($1, $2, 15) as r', [id, clinB]);
  const antigo = await um('select public.sos_chegada_detalhe($1) as r', [id]);
  assert.equal(antigo.status, 'cancelada');
  assert.equal(antigo.substituido_por, novo);
  assert.equal((await um('select public.sos_chegada_detalhe($1) as r', [novo])).ficha.codigo, 'FICHA123');
  assert.deepEqual((await avisos(vetA)).slice(-1), ['Tutor mudou de clínica']);
  assert.deepEqual(await avisos(vetB), ['Emergência a caminho']);

  // Cheguei encerra e avisa a clínica; depois não dá para mudar mais nada.
  await entrar(db, tutor);
  await um('select public.sos_chegada_encerrar($1, true) as r', [novo]);
  assert.equal((await um('select public.sos_chegada_detalhe($1) as r', [novo])).status, 'chegou');
  assert.equal(await um('select public.sos_chegada_atual() as r'), null);
  await assert.rejects(um('select public.sos_chegada_encerrar($1, true) as r', [novo]), /encerrado/);
  assert.deepEqual((await avisos(vetB)).slice(-1), ['Chegou']);

  // Aviso esquecido deixa de valer depois de 3 horas.
  await entrar(db, tutor);
  const velho = await um("select public.sos_chegada_criar($1, $2, 'FICHA123', 20) as r", [clinA, pet]);
  await db.exec(`reset role; update public.sos_arrivals set criado_em = now() - interval '4 hours' where id = '${velho}';`);
  await entrar(db, tutor);
  assert.equal((await um('select public.sos_chegada_detalhe($1) as r', [velho])).status, 'expirada');
  assert.equal(await um('select public.sos_chegada_atual() as r'), null);

  await entrar(db, vetA);
  await assert.rejects(um('select public.loja_emergencia_24h($1, false) as r', [clinB]), /dono ou o gerente/);
  await um('select public.loja_emergencia_24h($1, false) as r', [clinA]);
  await entrar(db, tutor);
  assert.deepEqual((await um('select public.clinicas_24h_perto(-22.95, -43.18) as r')).map((c) => c.name), ['Vet 24h Tijuca']);
  await entrar(db, null, 'anon');
  await assert.rejects(um('select public.clinicas_24h_perto(-22.95, -43.18) as r'), /permission denied/);
  console.log('SOS pré-chegada: clínicas 24 h, aviso, resposta, troca de clínica, Cheguei e expiração OK.');
} finally {
  await db.close();
}

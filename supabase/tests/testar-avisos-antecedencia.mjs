// Avisos sem horário: o push de lembrete sai em etapas contadas da hora do
// lembrete (vacina, vermífugo e consulta: 1 dia e 2 horas antes; banho e
// tosa: 2 horas antes). Só a última etapa encerra ou avança o lembrete.
// Rode com: node supabase/tests/testar-avisos-antecedencia.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const tutor = '48000000-0000-4000-8000-000000000001', pet = '78000000-0000-4000-8000-000000000001';
const estado = async () =>
  Object.fromEntries((await db.query('select titulo, ultimo_aviso_em is not null as avisado, ativo from public.reminders')).rows
    .map((r) => [r.titulo, `${r.avisado ? 'avisado' : '-'}/${r.ativo ? 'ativo' : 'encerrado'}`]));
// Simula o relógio andando: tudo fica mais perto da hora.
const andar = (horas) => db.exec(`update public.reminders set proxima_em = proxima_em - interval '${horas} hours',
  ultimo_aviso_em = ultimo_aviso_em - interval '${horas} hours'`);
const enviar = () => db.exec('select public.aviso_lembrete_push()');
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}');
    insert into public.pets(id, tutor_id, nome, especie) values ('${pet}', '${tutor}', 'Rex', 'cao');
    insert into public.push_tokens(tutor_id, token, ativo, plataforma) values ('${tutor}', 'ExponentPushToken[x]', true, 'android');
    insert into public.reminders(tutor_id, pet_id, tipo, titulo, proxima_em, ativo, aviso_antes, repetir) values
      ('${tutor}', '${pet}', 'vacina', 'V10', now() + interval '20 hours', true, false, 'nao'),
      ('${tutor}', '${pet}', 'vacina', 'Antirrábica', now() + interval '3 days', true, true, 'nao'),
      ('${tutor}', '${pet}', 'banho_tosa', 'Banho', now() + interval '20 hours', true, true, 'nao'),
      ('${tutor}', '${pet}', 'consulta', 'Retorno', now() + interval '20 hours', true, true, 'anual');`);
  // A migração religa o aviso de lembretes que tinham "Avisar 1 dia antes" desligado.
  await db.exec(await readFile(new URL('../migrations/20270113000000_avisos_sem_horario.sql', import.meta.url), 'utf8'));

  // Faltam 20 h: vacina e consulta recebem o aviso de 1 dia; banho ainda não.
  await enviar();
  assert.deepEqual(await estado(), { V10: 'avisado/ativo', Antirrábica: '-/ativo', Banho: '-/ativo', Retorno: 'avisado/ativo' });
  await enviar();
  const repetido = (await db.query("select count(*)::int n from public.reminders where ultimo_aviso_em is not null")).rows[0].n;
  assert.equal(repetido, 2, 'a mesma etapa não sai duas vezes');

  // Faltam 1 h 30: sai a etapa de 2 horas; a vacina sem repetição encerra e o retorno anual vai para o ano que vem.
  await andar(18.5);
  await enviar();
  const depois = await estado();
  assert.equal(depois.V10, 'avisado/encerrado');
  assert.equal(depois.Banho, 'avisado/encerrado');
  assert.equal(depois.Retorno, 'avisado/ativo');
  const retorno = (await db.query("select proxima_em > now() + interval '300 days' as ok from public.reminders where titulo = 'Retorno'")).rows[0].ok;
  assert.equal(retorno, true, 'retorno anual avançou um ano');
  assert.equal(depois.Antirrábica, '-/ativo');
  console.log('Avisos: 1 dia e 2 horas antes, etapa única por vez e encerramento na última, OK.');
} finally {
  await db.close();
}

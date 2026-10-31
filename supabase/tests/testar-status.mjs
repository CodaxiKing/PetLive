// Status e manutenção: consulta pública, config do app e quem pode ligar a manutenção.
// Rode com: node supabase/tests/testar-status.mjs
import assert from 'node:assert/strict';
import { entrar, montarBanco } from './banco-memoria.mjs';

const db = await montarBanco();
const um = (sql, args = []) => db.query(sql, args).then((r) => r.rows[0]?.r);
const tutor = '49000000-0000-4000-8000-000000000001';
try {
  await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${tutor}', '{"name":"Ana"}');`);
  await entrar(db, null, 'anon');
  const status = await um('select public.status_publico() as r');
  assert.equal(status.banco, 'ok');
  assert.equal(status.manutencao.ativa, false);
  assert.equal((await um('select public.config_app() as r')).manutencao.ativa, false);
  await assert.rejects(um("select public.admin_manutencao(true, 'Troca de servidor') as r"), /permission denied/);
  await entrar(db, tutor);
  await assert.rejects(um("select public.admin_manutencao(true, 'Troca de servidor') as r"), /equipe/);
  // Super admin liga e desliga (papel simulado direto na função de papel).
  await db.exec('reset role');
  await db.exec("create or replace function public.admin_papel() returns text language sql stable as $$ select 'super' $$");
  await entrar(db, tutor);
  const ligada = await um("select public.admin_manutencao(true, ' Troca de servidor ', now() + interval '1 hour') as r");
  assert.equal(ligada.ativa, true);
  assert.equal(ligada.mensagem, 'Troca de servidor');
  await entrar(db, null, 'anon');
  assert.equal((await um('select public.status_publico() as r')).manutencao.mensagem, 'Troca de servidor');
  assert.equal((await um('select public.config_app() as r')).manutencao.ativa, true);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int n from public.audit_log where acao = 'manutencao_ligada'")).rows[0].n, 1);
  console.log('Status: consulta pública, config do app e manutenção só pela equipe OK.');
} finally {
  await db.close();
}

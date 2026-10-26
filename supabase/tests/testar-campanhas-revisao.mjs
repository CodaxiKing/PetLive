import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const admin = '72000000-0000-4000-8000-000000000001';
async function sessao(papel = 'marketing', aal = 'aal2', ativo = true) {
  await db.exec(`reset role;delete from admin_members;select set_config('request.jwt.claim.sub','${admin}',false);select set_config('request.jwt.claim.aal','${aal}',false)`);
  if (papel) await db.query('insert into admin_members values($1,$2,$3)', [admin,papel,ativo]);
  await db.exec('set role authenticated');
}
async function salvar(id = null, revisao = null, titulo = 'Campanha original', para = null) {
  return (await db.query('select admin_campanha_salvar_v2($1,$2,$3,$4,$5,$6,$7) id', [id,revisao,titulo,'Mensagem de teste','todos','/inicio',para])).rows[0].id;
}
try {
  await db.exec(`create role authenticated;create role anon;create role service_role;
    create schema auth;create schema cron;create schema net;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
    grant usage on schema auth,public to authenticated,anon;
    create table auth.users(id uuid primary key,email text,banned_until timestamptz);
    insert into auth.users values('${admin}','teste@example.invalid',null);
    create table profiles(id uuid,nome text,notificacoes_ativas boolean);insert into profiles values('${admin}','Admin',true);
    create table admin_members(user_id uuid,papel text,ativo boolean);
    create table consentimentos(tutor_id uuid,tipo text,aceito boolean,registrado_em timestamptz);
    create table pets(id uuid,tutor_id uuid,ativo boolean,especie text);
    create table vaccinations(pet_id uuid,proxima_dose date);
    create table eventos_uso(user_id uuid,evento text,ocorreu_em timestamptz);
    create table push_tokens(tutor_id uuid,token text,ativo boolean);
    create table notification_log(id uuid default gen_random_uuid(),user_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz default now(),read_at timestamptz,
      constraint notification_log_type_check check(type in('lembrete','vacina','dose','peso','sistema')));
    create table auditoria(acao text,objeto text,rotulo text,dados jsonb);
    create function public.admin_registrar(text,text,text,jsonb) returns void language sql as $$insert into auditoria values($1,$2,$3,$4)$$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create table net.chamadas(id integer);
    create function net.http_post(url text,body jsonb,headers jsonb) returns bigint language plpgsql as $$begin insert into net.chamadas values(1);return 1;end$$;`);
  const guardas = await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
  await db.exec(guardas.slice(guardas.indexOf('create or replace function public.admin_papel()'),guardas.indexOf('create or replace function public.admin_registrar(')));
  await db.exec(await readFile(new URL('../migrations/20261105000000_admin_campanhas.sql',import.meta.url),'utf8'));
  const sql = await readFile(new URL('../migrations/20270109050000_campanhas_revisao.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  await sessao();
  const id = await salvar();
  let lista = (await db.query('select admin_campanhas_v2() r')).rows[0].r;
  assert.equal(lista.campanhas[0].id,id);assert.equal(lista.campanhas[0].revisao,1);
  assert.equal(lista.enviadas_30d,0);
  await salvar(id,1,'Alterada por outra aba');
  await assert.rejects(salvar(id,1,'Não sobrescrever'),/alterada por outra operação/);
  await assert.rejects(salvar(id,null),/alterada por outra operação/);
  await assert.rejects(db.query('select admin_campanha_cancelar_v2($1,$2)',[id,1]),/alterada por outra operação/);
  lista = (await db.query('select admin_campanhas_v2() r')).rows[0].r;
  assert.equal(lista.campanhas[0].titulo,'Alterada por outra aba');assert.equal(lista.campanhas[0].revisao,2);
  await assert.rejects(salvar(null,1),/sem revisão anterior/);
  const passado = new Date(Date.now()-60000).toISOString();
  await assert.rejects(salvar(id,2,'Inválida',passado),/horário no futuro/);
  await db.query('select admin_campanha_cancelar_v2($1,$2)',[id,2]);
  await assert.rejects(salvar(id,3),/enviada ou cancelada/);
  await assert.rejects(db.query('select admin_campanha_cancelar_v2($1,$2)',[id,3]),/Só dá para cancelar/);
  // O job também avança a revisão e o estado continua sendo a guarda final.
  const futuro = new Date(Date.now()+3600000).toISOString();
  const enviada = await salvar(null,null,'Campanha agendada',futuro);
  lista = (await db.query('select admin_campanhas_v2() r')).rows[0].r;
  assert.equal(lista.campanhas.find(c=>c.id===enviada).status,'agendada');
  assert.equal(lista.agendadas,1);
  await assert.rejects(salvar('72000000-0000-4000-8000-000000000099',1),/não encontrada/);
  await db.exec(`reset role;update campanhas set status='enviada',enviada_em=now() where id='${enviada}'`);
  await sessao();
  await assert.rejects(salvar(enviada,1),/enviada ou cancelada/);
  await assert.rejects(db.query('select admin_campanha_salvar(null,$1,$2,$3,$4,null)',['Título','Mensagem','todos','/inicio']),/permission denied/);
  await assert.rejects(db.query('select admin_campanha_cancelar($1)',[id]),/permission denied/);
  for (const papel of [null,'suporte','moderacao','financeiro','leitura']) {
    await sessao(papel);
    await assert.rejects(salvar(),/equipe|função/);
    await assert.rejects(db.query('select admin_campanha_cancelar_v2($1,1)',[id]),/equipe|função/);
    if (papel==='leitura') assert.ok((await db.query('select admin_campanhas_v2() r')).rows[0].r.campanhas.length);
    else await assert.rejects(db.query('select admin_campanhas_v2()'),/equipe|função/);
  }
  await sessao('super','aal1');await assert.rejects(salvar(),/duas etapas/);
  await sessao('marketing','aal2',false);await assert.rejects(salvar(),/duas etapas/);
  await sessao('super');await salvar();
  await db.exec('reset role');
  await db.exec(sql); // Reaplicação não reinicia revisões existentes.
  await sessao('super');
  lista = (await db.query('select admin_campanhas_v2() r')).rows[0].r;
  assert.equal(lista.campanhas.find(c=>c.id===id).revisao,3);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select admin_campanhas_v2()'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from net.chamadas')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from auditoria')).rows[0].n,5);
  console.log('OK: revisão, edição/cancelamento obsoletos, estados finais, horário futuro, reaplicação, RPCs antigas revogadas, papel/2FA reais e nenhuma chamada de push.');
} catch (erro) {
  console.error(erro.message);process.exitCode=1;
} finally { await db.close(); }

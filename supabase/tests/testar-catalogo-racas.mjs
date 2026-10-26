import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const a='64000000-0000-4000-8000-000000000001',b='64000000-0000-4000-8000-000000000002';
async function sessao(papel,aal='aal2',ativo=true) {
  await db.exec(`reset role;delete from admin_members;select set_config('request.jwt.claim.sub','${a}',false);select set_config('request.jwt.claim.aal','${aal}',false);`);
  if(papel) await db.query('insert into admin_members values($1,$2,$3)',[a,papel,ativo]);
  await db.exec('set role authenticated');
}
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table admin_members(user_id uuid,papel text,ativo boolean);
    create table audit_log(admin_id uuid,acao text,alvo_tipo text,alvo_id text,detalhes jsonb);`);
  const admin=await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
  await db.exec(admin.slice(admin.indexOf('create or replace function public.admin_papel()'),admin.indexOf('/**\n * Estado da sessão')));
  const sql=await readFile(new URL('../migrations/20270105000000_catalogo_racas.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const salvar=(id,versao,especie,nome,ativo=true)=>db.query('select admin_raca_salvar($1,$2,$3,$4,$5) id',[id,versao,especie,nome,ativo]);
  for(const papel of [null,'suporte','moderacao','marketing','financeiro','leitura']) {
    await sessao(papel);await assert.rejects(salvar(null,0,'cao','Teste'),/equipe|função/);
    if(papel) assert.equal((await db.query('select admin_racas() r')).rows[0].r.total,9);
  }
  await sessao('super','aal1');await assert.rejects(salvar(null,0,'cao','Teste'),/duas etapas/);
  await sessao('super','aal2',false);await assert.rejects(salvar(null,0,'cao','Teste'),/duas etapas/);
  await sessao('super');
  const id=(await salvar(null,0,'cao','  Teste raça  ')).rows[0].id;
  await assert.rejects(salvar(null,0,'cao','teste raça'),/já está cadastrada/);
  await assert.rejects(salvar(null,0,'ave','Inválida'),/Confira/);
  await assert.rejects(salvar(null,0,'cao','x'),/Confira/);
  await assert.rejects(salvar(null,0,'cao','x'.repeat(81)),/Confira/);
  await assert.rejects(salvar(null,4,'cao','Outra'),/Versão/);
  await salvar(id,1,'cao','Teste raça',false);
  await assert.rejects(salvar(id,1,'cao','Alteração antiga'),/cadastro mudou/);
  await sessao(null,'aal1');
  assert.equal((await db.query("select racas_sugerir('cao','Teste') r")).rows[0].r.length,0);
  assert.equal((await db.query("select racas_sugerir('gato','Labrador') r")).rows[0].r.length,0);
  assert.equal((await db.query("select racas_sugerir('cao','LAB') r")).rows[0].r[0].nome,'Labrador');
  assert.equal((await db.query("select racas_sugerir('cao','%') r")).rows[0].r.length,0);
  await assert.rejects(db.query('select * from catalogo_racas'),/permission denied/);
  await assert.rejects(db.query("update catalogo_racas set ativo=true"),/permission denied/);
  await assert.rejects(db.query("select racas_sugerir('ave')"),/inválida/);
  await sessao('super');await salvar(id,2,'cao','Teste raça',true);
  await db.exec('reset role');
  const logs=(await db.query('select * from audit_log')).rows;
  assert.equal(logs.length,3);assert.equal(logs[1].detalhes.antes.ativo,true);assert.equal(logs[1].detalhes.depois.ativo,false);
  await db.exec(sql);
  assert.equal((await db.query('select versao from catalogo_racas where id=$1',[id])).rows[0].versao,3);
  await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(db.query("select racas_sugerir('cao')"),/Entre/);
  await db.exec('reset role;set role anon');
  for(const q of ["select racas_sugerir('cao')",'select admin_racas()',"select admin_raca_salvar(null,0,'cao','Proibido',true)"]) await assert.rejects(db.query(q),/permission denied/);
  console.log('OK: papéis, 2FA, RLS, unicidade, validação, conflito de versão, desativação/reativação, sugestões por espécie, auditoria e reaplicação.');
} finally {await db.close();}
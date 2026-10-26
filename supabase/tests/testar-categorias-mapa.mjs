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
  const sql=await readFile(new URL('../migrations/20270106000000_catalogo_categorias_mapa.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const salvar=(codigo,versao,nome='Veterinário',plural='Veterinários')=>db.query('select admin_categoria_mapa_salvar($1,$2,$3,$4)',[codigo,versao,nome,plural]);
  for(const papel of [null,'suporte','moderacao','marketing','financeiro','leitura']) {
    await sessao(papel);await assert.rejects(salvar('clinica',1),/equipe|função/);
    if(papel) assert.equal((await db.query('select admin_categorias_mapa() r')).rows[0].r.length,9);
  }
  await sessao('super','aal1');await assert.rejects(salvar('clinica',1),/duas etapas/);
  await sessao('super','aal2',false);await assert.rejects(salvar('clinica',1),/duas etapas/);
  await sessao('super');await salvar('clinica',1);
  await assert.rejects(salvar('clinica',1),/categoria mudou/);
  await assert.rejects(salvar('clinica',null),/categoria mudou/);
  await assert.rejects(salvar('nova',1),/inexistente/);
  await assert.rejects(salvar('clinica',2,' '),/Confira/);
  await assert.rejects(salvar('clinica',2,'x'.repeat(33)),/Confira/);
  await assert.rejects(salvar('clinica',2,'Clínica','x'.repeat(41)),/Confira/);
  await sessao(null,'aal1');
  const publico=(await db.query('select categorias_mapa() r')).rows[0].r;
  assert.equal(publico.length,9);assert.equal(publico.find(c=>c.codigo==='clinica').nome,'Veterinário');
  assert.deepEqual(Object.keys(publico[0]).sort(),['codigo','nome','plural']);
  for(const q of ['select * from catalogo_categorias_mapa',"update catalogo_categorias_mapa set nome='Outra'",'delete from catalogo_categorias_mapa']) await assert.rejects(db.query(q),/permission denied/);
  await db.exec('reset role');
  const logs=(await db.query('select * from audit_log')).rows;
  assert.equal(logs.length,1);assert.equal(logs[0].detalhes.antes.nome,'Clínica');assert.equal(logs[0].detalhes.depois.nome,'Veterinário');
  await db.exec(sql);
  assert.equal((await db.query("select nome from catalogo_categorias_mapa where codigo='clinica'")).rows[0].nome,'Veterinário');
  await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(db.query('select categorias_mapa()'),/Entre/);
  await db.exec('reset role;set role anon');
  for(const q of ['select categorias_mapa()','select admin_categorias_mapa()',"select admin_categoria_mapa_salvar('clinica',1,'Nome','Nomes')"]) await assert.rejects(db.query(q),/permission denied/);
  console.log('OK: categorias fixas, papéis/2FA/inativo, acesso tutor/anon, validação, versão concorrente, auditoria, RLS e reaplicação.');
} finally {await db.close();}
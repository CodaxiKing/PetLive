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
    create table admin_members(user_id uuid,papel text,ativo boolean);`);
  const admin=await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
  await db.exec(admin.slice(admin.indexOf('create or replace function public.admin_papel()'),admin.indexOf('create or replace function public.admin_registrar(')));
  const sql=await readFile(new URL('../migrations/20270104000000_admin_integracoes.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  for(const papel of [null,'suporte','moderacao','marketing','financeiro']) {
    await sessao(papel);await assert.rejects(db.query('select admin_integracoes()'),/equipe|função/);
  }
  await sessao('super','aal1');await assert.rejects(db.query('select admin_integracoes()'),/duas etapas/);
  await sessao('super','aal2',false);await assert.rejects(db.query('select admin_integracoes()'),/duas etapas/);
  for(const papel of ['super','leitura']) {
    await sessao(papel);
    const r=(await db.query('select admin_integracoes() r')).rows[0].r;
    assert.equal(Object.keys(r.componentes).length,6);
    assert.ok(Object.values(r.componentes).every(v=>v===false));
    assert.ok(r.consultado_em);
    assert.deepEqual(Object.keys(r).sort(),['componentes','consultado_em']);
  }
  await db.exec(`reset role;create table subscriptions(secret text);insert into subscriptions values('NAO_EXPOR');
    create function lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer,text) returns void language sql as $$select$$;`);
  await sessao('leitura');
  const r=(await db.query('select admin_integracoes() r')).rows[0].r;
  assert.equal(r.componentes.assinaturas,true);assert.equal(r.componentes.mapa,true);
  assert.equal(r.componentes.push_fila,false);
  assert.equal(JSON.stringify(r).includes('NAO_EXPOR'),false);
  await assert.rejects(db.query('select * from subscriptions'),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select admin_integracoes()'),/permission denied/);
  console.log('OK: guarda real de papel/2FA/ativo, anon negado, inventário atualizado e sem dados privados.');
} finally { await db.close(); }
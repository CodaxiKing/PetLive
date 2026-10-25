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
    create table profiles(id uuid primary key,nome text,email text,plano text);
    create table admin_members(user_id uuid,papel text,ativo boolean);
    insert into profiles values('${a}','Tutor 100%','a@example.test','premium'),('${b}','Outro','b@example.test','gratis');`);
  const admin=await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
  await db.exec(admin.slice(admin.indexOf('create or replace function public.admin_papel()'),admin.indexOf('create or replace function public.admin_registrar(')));
  await db.exec(await readFile(new URL('../migrations/20261228000000_consulta_assinatura.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../migrations/20261230000000_admin_assinaturas.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  await db.query(`insert into subscriptions(tutor_id,provedor,referencia_provedor,ciclo,status,periodo_inicio,periodo_fim,valor_centavos)
    select $1,'asaas','secreta-'||g,'anual','ativa',now()-interval '1 day',now()+interval '1 year',9900 from generate_series(1,27) g`,[a]);
  await db.query(`insert into subscriptions(tutor_id,provedor,referencia_provedor,ciclo,status,periodo_inicio,periodo_fim)
    values($1,'google_play','secreta-vencida','mensal','ativa',now()-interval '2 months',now()-interval '1 month'),
    ($2,'app_store','secreta-falha','mensal','pagamento_falhou',now()-interval '1 day',now()+interval '1 month'),
    ($2,'asaas','secreta-cancelada','anual','cancelada',now()-interval '1 year',now()-interval '1 day')`,[a,b]);
  for(const papel of [null,'suporte','moderacao','marketing']) {
    await sessao(papel); await assert.rejects(db.query('select admin_assinaturas()'),/equipe|função/);
  }
  await sessao('financeiro','aal1');await assert.rejects(db.query('select admin_assinaturas()'),/duas etapas/);
  await sessao('super','aal2',false);await assert.rejects(db.query('select admin_assinaturas()'),/duas etapas/);
  for(const papel of ['super','financeiro','leitura']) {
    await sessao(papel);
    const r=(await db.query('select admin_assinaturas() r')).rows[0].r;
    assert.equal(r.total,30);assert.equal(r.itens.length,25);assert.equal(r.resumo.ativas,27);assert.equal(r.resumo.expiradas,1);
    assert.equal(JSON.stringify(r).includes('referencia_provedor'),false);assert.equal(JSON.stringify(r).includes('secreta-'),false);
  }
  let r=(await db.query("select admin_assinaturas(p_status=>'expirada') r")).rows[0].r;
  assert.equal(r.total,1);assert.equal(r.itens[0].status_registrado,'ativa');
  r=(await db.query("select admin_assinaturas(p_busca=>'100%',p_ciclo=>'anual',p_provedor=>'asaas',p_pagina=>1) r")).rows[0].r;
  assert.equal(r.total,27);assert.equal(r.itens.length,2);
  const ids=r.itens.map(x=>x.id);
  const primeiros=(await db.query("select admin_assinaturas(p_busca=>'100%',p_ciclo=>'anual',p_provedor=>'asaas') r")).rows[0].r.itens;
  assert.equal(primeiros.some(x=>ids.includes(x.id)),false);
  for(const query of ["select admin_assinaturas(p_status=>'qualquer')","select admin_assinaturas(p_pagina=>-1)","select admin_assinaturas(p_provedor=>'x')"]) await assert.rejects(db.query(query),/inválid/);
  await assert.rejects(db.query('select * from subscriptions'),/permission denied/);
  await assert.rejects(db.query("update subscriptions set status='cancelada'"),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select admin_assinaturas()'),/permission denied/);
  console.log('OK: guarda real por papel/2FA/ativo, anonimato, filtros literais, paginação sem repetição, períodos expirados, referências privadas omitidas e nenhuma escrita cliente.');
} finally {await db.close();}

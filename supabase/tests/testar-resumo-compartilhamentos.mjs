import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);const db=new PGlite();
const a='52000000-0000-4000-8000-000000000001',b='52000000-0000-4000-8000-000000000002',pet='52000000-0000-4000-8000-000000000003';
async function entrar(uid=a,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);}
const resumo=()=>db.query('select privacidade_compartilhamentos($1) as r',[a]).then(r=>r.rows[0].r);
try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;`);
 const sql=await readFile(new URL('../migrations/20261216000000_resumo_compartilhamentos.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await entrar();let r=await resumo();for(const k of ['qrs','fichas','familia','cuidadores'])assert.equal(r[k],null,'tabela ausente não significa zero');
 await db.exec(`reset role;create table profiles(id uuid primary key,plano text);create table pets(id uuid primary key,tutor_id uuid,ativo boolean,em_memoria boolean);
 create table pet_qr_settings(pet_id uuid,active boolean);create table cuidador_acessos(tutor_id uuid,inicio timestamptz,fim timestamptz,revogado_em timestamptz);
 create table carteirinha_links(tutor_id uuid,expira_em timestamptz,cancelado_em timestamptz);create table pet_members(pet_id uuid,user_id uuid);
 insert into profiles values('${a}','premium'),('${b}','premium');insert into pets values('${pet}','${a}',true,false),('${b}','${b}',true,false);
 insert into pet_qr_settings values('${pet}',true),('${b}',true);insert into pet_members values('${pet}','${b}'),('${b}','${a}');
 insert into cuidador_acessos values('${a}',now()-interval '1 hour',now()+interval '1 hour',null),('${a}',now()-interval '2 hour',now()-interval '1 hour',null),('${a}',now()+interval '1 hour',now()+interval '2 hour',null),('${a}',now()-interval '1 hour',now()+interval '1 hour',now()),('${b}',now()-interval '1 hour',now()+interval '1 hour',null);
 insert into carteirinha_links values('${a}',now()+interval '1 hour',null),('${a}',now()-interval '1 hour',null),('${a}',now()+interval '1 hour',now()),('${b}',now()+interval '1 hour',null);`);
 await entrar();r=await resumo();for(const k of ['qrs','fichas','familia','cuidadores'])assert.equal(r[k],1,k);
 assert.deepEqual(Object.keys(r).sort(),['consultado_em','cuidadores','familia','fichas','qrs'].sort(),'sem códigos, nomes ou contatos');
 await entrar(b);await assert.rejects(resumo(),/conta mudou/);await entrar('','anon');await assert.rejects(resumo(),/permission denied/);
 await db.exec(`reset role;update profiles set plano='gratis' where id='${a}';update pets set em_memoria=true where id='${pet}'`);
 await entrar();r=await resumo();assert.equal(r.qrs,0);assert.equal(r.familia,0);
 console.log('OK: tabelas ausentes/null, isolamento, contagens reais, vigência/revogação, Premium/memorial, privacidade e reaplicação.');
}finally{await db.close();}

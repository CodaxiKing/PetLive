import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);const db=new PGlite();const uid=n=>`56000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const [a,b,pet,link]=[1,2,3,4].map(uid);
try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;
 create table pets(id uuid primary key,tutor_id uuid,ativo boolean,em_memoria boolean);insert into pets values('${pet}','${a}',true,false);
 create table notification_log(id uuid primary key default gen_random_uuid(),user_id uuid,pet_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz default now(),read_at timestamptz);
 alter table notification_log enable row level security;create policy legado on notification_log for all to authenticated using(true) with check(true);grant all on notification_log to authenticated,anon;
 create table carteirinha_links(id uuid primary key,pet_id uuid,tutor_id uuid,tipo text,aberturas int default 0,avisado_em timestamptz,cancelado_em timestamptz,expira_em timestamptz);
 insert into carteirinha_links(id,pet_id,tutor_id,tipo,expira_em) values('${link}','${pet}','${a}','emergencia',now()+interval '1 day');`);
 const sql=await readFile(new URL('../migrations/20261219000000_aviso_abertura_ficha.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const abrir=()=>db.exec(`update carteirinha_links set aberturas=aberturas+1 where id='${link}'`);
 await abrir();await abrir();let r=(await db.query('select * from notification_log')).rows;assert.equal(r.length,1);assert.equal(r[0].user_id,a);assert.equal(r[0].pet_id,pet);assert.match(r[0].title,/emergência/);assert(!JSON.stringify(r[0]).includes('codigo'));assert.match(r[0].body,/Pode ter sido você/);
 await db.exec(`update carteirinha_links set avisado_em=now()-interval '2 hours'`);await abrir();assert.equal((await db.query('select count(*)::int n from notification_log')).rows[0].n,2);
 await db.exec(`update carteirinha_links set avisado_em=null,cancelado_em=now()`);await abrir();assert.equal((await db.query('select count(*)::int n from notification_log')).rows[0].n,2);
 await db.exec(`update carteirinha_links set cancelado_em=null,expira_em=now()-interval '1 second'`);await abrir();assert.equal((await db.query('select count(*)::int n from notification_log')).rows[0].n,2);
 await db.exec(`update carteirinha_links set expira_em=now()+interval '1 day';update pets set em_memoria=true`);await abrir();assert.equal((await db.query('select count(*)::int n from notification_log')).rows[0].n,2);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`);
 assert.equal((await db.query('select id,title from notification_log')).rows.length,2);await db.exec('update notification_log set read_at=now()');
 await assert.rejects(db.exec("update notification_log set body='alterado'"),/permission denied/);await assert.rejects(db.exec("insert into notification_log(title) values('falso')"),/permission denied/);await assert.rejects(db.exec('delete from notification_log'),/permission denied/);
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);assert.equal((await db.query('select id from notification_log')).rows.length,0);await db.exec('update notification_log set read_at=null');
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select id from notification_log'),/permission denied/);
 console.log('OK: reaplicação, aviso próprio sem código/identidade de visitante, limite de uma hora, prazo/cancelamento/memorial e leitura/alteração restrita mesmo com policy legada permissiva.');
}finally{await db.close();}

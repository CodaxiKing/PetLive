import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);const db=new PGlite();const uid=n=>`57000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const [a,b,pet,link]=[1,2,3,4].map(uid);const token='ExpoPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
async function entrar(user=a,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);}
async function root(sql=''){await db.exec('reset role;'+sql);}
const processar=()=>db.query('select ficha_push_processar()');
const fila=()=>db.query('select * from ficha_push_fila order by criado_em desc,id desc').then(r=>r.rows);
async function pronto(){await db.exec("update ficha_push_fila set disponivel_em=now()-interval '1 second'");await processar();}
async function nova(){await root(`update carteirinha_links set avisado_em=null;update carteirinha_links set aberturas=aberturas+1 where id='${link}'`);return (await fila()).find(q=>q.estado==='pendente');}
async function resposta(id,body,status=200){await db.query('insert into net._http_response(id,status_code,content) values($1,$2,$3)',[id,status,JSON.stringify(body)]);}
try{
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema extensions;create schema net;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;
 create function extensions.digest(v text,alg text) returns bytea language sql as $$select decode(md5(v)||md5(v),'hex')$$;
 create table profiles(id uuid primary key,notificacoes_ativas boolean,fuso_horario text);insert into profiles values('${a}',true,'America/Sao_Paulo'),('${b}',true,'UTC');
 create table pets(id uuid primary key,tutor_id uuid,ativo boolean,em_memoria boolean);insert into pets values('${pet}','${a}',true,false);
 create table notification_log(id uuid primary key default gen_random_uuid(),user_id uuid,pet_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz default now(),read_at timestamptz);
 create table carteirinha_links(id uuid primary key,pet_id uuid,tutor_id uuid,tipo text,aberturas int default 0,avisado_em timestamptz,cancelado_em timestamptz,expira_em timestamptz);
 insert into carteirinha_links(id,pet_id,tutor_id,tipo,expira_em) values('${link}','${pet}','${a}','emergencia',now()+interval '2 days');
 create table push_tokens(id uuid primary key default gen_random_uuid(),tutor_id uuid references profiles(id),token text unique,plataforma text,ativo boolean);
 create table consentimentos(id uuid primary key default gen_random_uuid(),tutor_id uuid,tipo text,aceito boolean,registrado_em timestamptz default now());
 create table notification_prefs(tutor_id uuid,tipo text,ativo boolean,nao_perturbe_inicio time,nao_perturbe_fim time);
 create table notification_settings(tutor_id uuid,fuso text);
 insert into notification_prefs values('${a}','outro',true,null,null);
 create table net.requests(id bigint generated always as identity primary key,url text,body jsonb,headers jsonb);
 create table net._http_response(id bigint primary key,status_code int,content text,timed_out boolean default false,error_msg text);
 create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds int default 2000) returns bigint language plpgsql as $$declare v_id bigint;begin insert into net.requests(url,body,headers) values(url,body,headers) returning id into v_id;return v_id;end$$;`);
 await db.exec(await readFile(new URL('../migrations/20261219000000_aviso_abertura_ficha.sql',import.meta.url),'utf8'));
 const sql=await readFile(new URL('../migrations/20261221000000_push_abertura_ficha.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await entrar('','anon');await assert.rejects(db.query('select push_token_registrar($1,$2,$3)',[a,token,'android']),/permission denied/);await assert.rejects(processar(),/permission denied/);
 await entrar();await assert.rejects(db.query('select push_token_registrar($1,$2,$3)',[b,token,'android']),/conta mudou/);await assert.rejects(db.query('select push_token_registrar($1,$2,$3)',[a,'invalido','android']),/inválido/);
 const id=(await db.query('select push_token_registrar($1,$2,$3) as id',[a,token,'android'])).rows[0].id;assert.equal((await db.query('select push_token_registrar($1,$2,$3) as id',[a,token,'android'])).rows[0].id,id);
 await assert.rejects(db.query('select * from ficha_push_fila'),/permission denied/);await assert.rejects(db.query('select token from push_tokens'),/permission denied/);
 await root();let q=await nova();assert(q);await db.exec(`update carteirinha_links set aberturas=aberturas+1`);assert.equal((await fila()).length,1,'limite horário não duplica fila');
 await processar();q=(await fila())[0];assert.equal(q.estado,'ticket');let req=(await db.query('select * from net.requests where id=$1',[q.requisicao_id])).rows[0];assert.equal(req.body.to,token);assert.equal(req.body.channelId,'lembretes');assert.equal(req.body.data.aviso_id,q.aviso_id);assert(!JSON.stringify(req.body).includes('codigo'));
 await resposta(q.requisicao_id,{data:{status:'ok',id:'ticket-1'}});await pronto();q=(await fila())[0];assert.equal(q.estado,'aguardando_recibo');await pronto();q=(await fila())[0];assert.equal(q.estado,'recibo');
 await resposta(q.requisicao_id,{data:{'ticket-1':{status:'ok'}}});await pronto();q=(await fila())[0];assert.equal(q.estado,'aceito');assert.equal((await db.query('select count(*)::int n from net.requests')).rows[0].n,2);await processar();assert.equal((await db.query('select count(*)::int n from net.requests')).rows[0].n,2);
 q=await nova();await processar();q=(await fila()).find(x=>x.id===q.id);await resposta(q.requisicao_id,{data:{status:'error',details:{error:'DeviceNotRegistered'}}});await pronto();assert.equal((await db.query('select ativo from push_tokens where id=$1',[id])).rows[0].ativo,false);
 await entrar();await db.query('select push_token_registrar($1,$2,$3)',[a,token,'android']);await root();q=await nova();
 await db.exec(`update notification_prefs set nao_perturbe_inicio=(now() at time zone 'UTC'-interval '1 minute')::time,nao_perturbe_fim=(now() at time zone 'UTC'+interval '1 minute')::time;insert into notification_settings values('${a}','UTC')`);await processar();assert.equal((await fila()).find(x=>x.id===q.id).estado,'pendente');
 await db.exec('update notification_prefs set nao_perturbe_inicio=null,nao_perturbe_fim=null,ativo=false');await pronto();assert.equal((await fila()).find(x=>x.id===q.id).estado,'suprimido');
 await db.exec('update notification_prefs set ativo=true');q=await nova();await db.exec(`insert into consentimentos(tutor_id,tipo,aceito) values('${a}','avisos_push',false)`);await processar();assert.equal((await fila()).find(x=>x.id===q.id).estado,'suprimido');await db.exec('delete from consentimentos');
 q=await nova();await db.query('update notification_log set read_at=now() where id=$1',[q.aviso_id]);await processar();assert.equal((await fila()).find(x=>x.id===q.id).estado,'suprimido');
 q=await nova();await entrar(b);await db.query('select push_token_registrar($1,$2,$3)',[b,token,'android']);await root();assert.equal((await fila()).find(x=>x.id===q.id).estado,'suprimido');assert.equal((await db.query('select tutor_id from push_tokens where id=$1',[id])).rows[0].tutor_id,b);
 await entrar();await db.query('select push_token_registrar($1,$2,$3)',[a,token,'android']);await root();q=await nova();await processar();q=(await fila()).find(x=>x.id===q.id);await resposta(q.requisicao_id,{},503);await pronto();assert.equal((await fila()).find(x=>x.id===q.id).estado,'pendente');await pronto();q=(await fila()).find(x=>x.id===q.id);await db.query('insert into net._http_response(id,status_code,timed_out) values($1,null,true)',[q.requisicao_id]);await pronto();assert.equal((await fila()).find(x=>x.id===q.id).motivo,'transporte_incerto');
 await db.exec('delete from notification_prefs;delete from notification_settings');
 for(const [hora,esperado] of [['2026-10-25T01:00:00Z','aguardar'],['2026-10-25T09:59:59Z','aguardar'],['2026-10-25T10:00:00Z','enviar']])assert.equal((await db.query('select ficha_push_permissao($1,$2) r',[a,hora])).rows[0].r,esperado);
 console.log('OK: RPC privada/conta, token idempotente/transferência, fila por abertura, tickets/recibos, DeviceNotRegistered, preferências/consentimento/Não perturbe, lido, retry503 e transporte incerto sem reenvio automático. Transporte inteiro simulado.');
}finally{await db.close();}

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);const db=new PGlite();
async function entrar(id='53000000-0000-4000-8000-000000000001',role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const ler=ids=>db.query('select destaques_lugares($1) as r',[ids]).then(r=>r.rows[0].r);
try{
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;`);
 const sql=await readFile(new URL('../migrations/20261213000000_destaques_pagos_lugares.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`insert into lugares_destaques_pagos(lugar_id,pagamento_ref,pagamento_confirmado_em,inicio_em,fim_em,status) values
 ('ativo','pag-1',now(),now()-interval '1 hour',now()+interval '1 hour','ativo'),
 ('ativo','pag-2',now(),now()-interval '1 hour',now()+interval '2 hours','ativo'),
 ('vencido','pag-3',now(),now()-interval '1 day',now(),'ativo'),
 ('agendado','pag-4',now(),now()+interval '1 day',now()+interval '2 days','ativo'),
 ('cancelado','pag-5',now(),now()-interval '1 day',now()+interval '1 day','cancelado'),
 ('reembolso','pag-6',now(),now()-interval '1 day',now()+interval '1 day','reembolsado'),
 ('pagamento-futuro','pag-7',now()+interval '1 day',now()-interval '1 day',now()+interval '1 day','ativo');`);
 await entrar('', 'anon');await assert.rejects(ler(['ativo']),/permission denied/);
 await entrar('');await assert.rejects(ler(['ativo']),/Entre/);await entrar();
 const r=await ler(['ativo','ativo','vencido','agendado','cancelado','reembolso','pagamento-futuro','inexistente']);
 assert.equal(r.destaques.length,1);assert.equal(r.destaques[0].lugar_id,'ativo');assert(r.servidor_em);
 assert(!JSON.stringify(r).includes('pagamento_ref'));assert(!JSON.stringify(r).includes('pag-1'));
 assert.equal((await ler([])).destaques.length,0);assert.equal((await ler(['outro'])).destaques.length,0);
 await assert.rejects(ler(Array(201).fill('ativo')),/inválida/);await assert.rejects(ler([null]),/inválida/);
 await assert.rejects(db.exec("insert into lugares_destaques_pagos(lugar_id,pagamento_ref,pagamento_confirmado_em,inicio_em,fim_em) values('fraude','fraude',now(),now(),now()+interval '1 day')"),/permission denied/);
 await assert.rejects(db.exec('select * from lugares_destaques_pagos'),/permission denied/);await assert.rejects(db.exec("update lugares_destaques_pagos set status='ativo'"),/permission denied/);
 await entrar('', 'service_role');await db.exec("update lugares_destaques_pagos set status='cancelado' where lugar_id='ativo'");await entrar();assert.equal((await ler(['ativo'])).destaques.length,0);
 console.log('OK: pago/vigente, início/fim, cancelamento/reembolso, deduplicação, limites e bloqueio de autopromoção/dados de pagamento.');
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}

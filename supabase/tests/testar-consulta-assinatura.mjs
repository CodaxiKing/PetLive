import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const a='62000000-0000-4000-8000-000000000001', b='62000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table profiles(id uuid primary key,plano text);insert into profiles values('${a}','premium'),('${b}','gratis');`);
  const sql=await readFile(new URL('../migrations/20261228000000_consulta_assinatura.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);set role authenticated`);
  let r=(await db.query('select minha_assinatura($1) r',[a])).rows[0].r;
  assert.equal(r.plano,'premium');assert.equal(r.assinatura,null);assert.equal(r.gestao_disponivel,false);
  await assert.rejects(db.query('select minha_assinatura($1)',[b]),/conta mudou/);
  await assert.rejects(db.query('select * from subscriptions'),/permission denied/);
  await assert.rejects(db.query(`insert into subscriptions(tutor_id) values($1)`,[a]),/permission denied/);
  await db.exec(`reset role;set role service_role`);
  await db.query(`insert into subscriptions(tutor_id,provedor,referencia_provedor,ciclo,status,periodo_inicio,periodo_fim,forma_pagamento,valor_centavos,criado_em)
    values($1,'asaas','privada-a','anual','cancelando',now()-interval '1 day',now()+interval '1 year','pix',9900,now()-interval '1 day'),
    ($1,'asaas','privada-encerrada','mensal','cancelada',now()-interval '2 months',now()-interval '1 month','cartao',990,now()),
    ($2,'asaas','privada-b','anual','ativa',now(),now()+interval '1 year','pix',9900,now())`,[a,b]);
  await db.exec('reset role;set role authenticated');
  r=(await db.query('select minha_assinatura($1) r',[a])).rows[0].r;
  assert.equal(r.assinatura.status,'cancelando');assert.equal(r.assinatura.valor_centavos,9900);
  assert.equal('referencia_provedor' in r.assinatura,false);
  await assert.rejects(db.query(`update subscriptions set status='cancelada'`),/permission denied/);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${b}',false);set role authenticated`);
  r=(await db.query('select minha_assinatura($1) r',[b])).rows[0].r;
  assert.equal(r.plano,'gratis'); // Registro de cobrança não altera benefício automaticamente.
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select minha_assinatura($1)',[a]),/permission denied/);
  console.log('OK: isolamento de contas, sem escrita cliente, sem referência privada, benefício preservado, contrato vigente priorizado e reaplicação.');
} finally { await db.close(); }

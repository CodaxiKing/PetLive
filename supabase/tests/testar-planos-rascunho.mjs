import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();const a='66000000-0000-4000-8000-000000000001';
async function entrar(papel,aal='aal2',ativo=true) {
 await db.exec(`reset role;delete from admin_members;select set_config('request.jwt.claim.sub','${a}',false);`);
 await db.query("select set_config('request.jwt.claim.aal',$1,false)",[aal]);
 if(papel)await db.query('insert into admin_members values($1,$2,$3)',[a,papel,ativo]);
 await db.exec('set role authenticated');
}
const cupom=(id=null,versao=0,codigo=' teste10 ',tipo='percentual',valor=10,arquivado=false)=>db.query(
 'select admin_cupom_salvar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,versao,codigo,tipo,valor,'2027-01-01T00:00:00Z','2028-01-01T00:00:00Z',100,0,arquivado]);
try {
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create table admin_members(user_id uuid,papel text,ativo boolean);
 create table audit_log(admin_id uuid,acao text,alvo_tipo text,alvo_id text,detalhes jsonb);
 create table profiles(id uuid,plano text);insert into profiles values('${a}','gratis');`);
 const base=await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
 await db.exec(base.slice(base.indexOf('create or replace function public.admin_papel()'),base.indexOf('/**\n * Estado da sessão')));
 const sql=await readFile(new URL('../migrations/20270103000000_planos_cupons_rascunho.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 for(const papel of [null,'marketing','moderacao','suporte']){await entrar(papel);await assert.rejects(db.query('select admin_planos()'),/equipe|função/);}
 await entrar('super','aal1');await assert.rejects(cupom(),/duas etapas/);
 await entrar('super','aal2',false);await assert.rejects(db.query('select admin_planos()'),/duas etapas/);
 await entrar('leitura');assert.equal((await db.query('select admin_planos() r')).rows[0].r.venda_disponivel,false);
 await assert.rejects(cupom(),/função/);
 await entrar('financeiro');let r=(await db.query('select admin_planos() r')).rows[0].r;
 assert.equal(r.planos.length,2);assert(r.planos.every(p=>p.preco_centavos===null));
 await db.query("select admin_plano_salvar('mensal',1,1990,7)");
 await assert.rejects(db.query("select admin_plano_salvar('mensal',1,2990,7)"),/plano mudou/);
 await assert.rejects(db.query("select admin_plano_salvar('mensal',2,0,7)"),/preço/);
 await assert.rejects(db.query("select admin_plano_salvar('mensal',2,1990,91)"),/preço/);
 await cupom();
 r=(await db.query('select admin_planos() r')).rows[0].r;
 let c=r.cupons[0];assert.equal(c.codigo,'TESTE10');assert.equal(c.valor,10);assert.equal(c.versao,1);
 await assert.rejects(cupom(),/código já/);
 await assert.rejects(cupom(null,0,'BAD101','percentual',101),/dados do cupom/);
 await assert.rejects(cupom(null,0,'<html>'),/dados do cupom/);
 await cupom(c.id,1,'TESTE10','percentual',15,true);
 await assert.rejects(cupom(c.id,1),/cupom mudou/);
 await cupom(null,0,'VALOR10','valor_fixo',1000);
 await cupom(null,0,'DIAS10','dias_gratis',10);
 await assert.rejects(db.query('select * from premium_cupons_rascunho'),/permission denied/);
 await assert.rejects(db.query('update premium_planos_rascunho set preco_centavos=1'),/permission denied/);
 await db.exec('reset role');await db.exec(sql);
 assert.equal((await db.query("select preco_centavos from premium_planos_rascunho where ciclo='mensal'")).rows[0].preco_centavos,1990);
 assert.equal((await db.query('select plano from profiles')).rows[0].plano,'gratis');
 assert.equal((await db.query("select count(*)::integer n from audit_log where acao='plano_rascunho_salvar'")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::integer n from audit_log where acao='cupom_premium_rascunho_salvar'")).rows[0].n,4);
 await entrar('super');r=(await db.query('select admin_planos(1) r')).rows[0].r;assert.equal(r.cupons.length,0);assert.equal(r.total_cupons,3);
 assert.equal((await db.query('select admin_planos() r')).rows[0].r.cupons.find(x=>x.id===c.id).arquivado,true);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select admin_planos()'),/permission denied/);
 console.log('OK: papéis/2FA, preços indefinidos, versão, duplicidade, tipos, arquivo de cupom, auditoria, sem venda/benefício e reaplicação sem sobrescrever preços.');
} finally {await db.close();}

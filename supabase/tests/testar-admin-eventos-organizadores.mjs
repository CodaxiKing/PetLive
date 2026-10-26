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
    create table auth.users(id uuid primary key);create table profiles(id uuid primary key,nome text);
    create table admin_members(user_id uuid,papel text,ativo boolean);
    create table audit_log(admin_id uuid,acao text,alvo_tipo text,alvo_id text,detalhes jsonb);
    insert into auth.users values('${a}'),('${b}');insert into profiles values('${a}','Equipe'),('${b}','Conta comum');`);
  const admin=await readFile(new URL('../migrations/20261031000000_painel_admin.sql',import.meta.url),'utf8');
  await db.exec(admin.slice(admin.indexOf('create or replace function public.admin_papel()'),admin.indexOf('/**\n * Estado da sessão')));
  const eventos=await readFile(new URL('../migrations/20261122000000_eventos_pet.sql',import.meta.url),'utf8');
  await db.exec(eventos.slice(eventos.indexOf('create table public.organizers'),eventos.indexOf('create index events_status_inicio_idx')));
  await db.exec(eventos.slice(eventos.indexOf('alter table public.organizers enable row level security'),eventos.indexOf('create or replace function public.eventos_por_perto')));
  await db.exec(eventos.slice(eventos.indexOf('create or replace function public.evento_criar('),eventos.indexOf('create or replace function public.evento_confirmar_presenca')));
  const sql=await readFile(new URL('../migrations/20270107000000_admin_eventos_organizadores.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const dados={titulo:'Encontro de teste',tipo:'encontro',descricao:'Descrição de evento isolado para testes.',
    inicio_em:new Date(Date.now()+86400000).toISOString(),fim_em:new Date(Date.now()+90000000).toISOString(),
    local_nome:'Praça de teste',lat:-22.75,lng:-43.45,gratuito:true,preco_centavos:null,ingresso_url:null,vagas:10};
  const key='65000000-0000-4000-8000-000000000001';
  const criar=(chave=key,evento=dados,confirmar=true)=>db.query('select admin_evento_oficial_criar($1,$2,$3) id',[chave,evento,confirmar]);
  const verificar=(versao=0,valor=true,motivo='Identidade revisada',confirmar=true)=>db.query('select admin_organizador_verificar($1,$2,$3,$4,$5)',[b,versao,valor,motivo,confirmar]);
  for(const papel of [null,'leitura','suporte','financeiro','marketing']) {
    await sessao(papel);await assert.rejects(criar(),/equipe|função/);await assert.rejects(verificar(),/equipe|função/);
    await assert.rejects(db.query('select admin_evento_chave()'),/equipe|função/);
  }
  await sessao('super','aal1');await assert.rejects(criar(),/duas etapas/);
  await sessao('moderacao','aal2',false);await assert.rejects(verificar(),/duas etapas/);
  await sessao('moderacao');
  assert.match((await db.query('select admin_evento_chave() id')).rows[0].id,/^[0-9a-f-]{36}$/);
  await assert.rejects(criar(key,dados,false),/Confirme/);
  const id=(await criar()).rows[0].id;assert.equal((await criar()).rows[0].id,id);
  await assert.rejects(criar(key,{...dados,titulo:'Outro evento'}),/chave já foi usada/);
  await assert.rejects(criar('65000000-0000-4000-8000-000000000002',{...dados,oficial:false}),/Campos/);
  for(const patch of [{lat:100},{inicio_em:'2000-01-01'},{gratuito:false,preco_centavos:0},{gratuito:false,preco_centavos:100,ingresso_url:'http://inseguro.test'}])
    await assert.rejects(criar('65000000-0000-4000-8000-000000000002',{...dados,...patch}));
  await db.exec('reset role');
  assert.equal((await db.query('select count(*) n from events')).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from audit_log')).rows[0].n,1);
  const oficial=(await db.query('select * from events')).rows[0];assert.equal(oficial.oficial,true);assert.equal(oficial.status,'publicado');
  await sessao(null);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  const comunitario=async()=> (await db.query(`select evento_criar($1,$2,$3,$4,$5,$6,p_lat=>$7,p_lng=>$8) id`,
    [dados.titulo,dados.tipo,dados.descricao,dados.inicio_em,dados.fim_em,dados.local_nome,dados.lat,dados.lng])).rows[0].id;
  const primeiro=await comunitario();
  await assert.rejects(db.query('update organizers set verificado=true'),/permission denied/);
  await sessao('leitura');assert.equal((await db.query('select admin_organizadores() r')).rows[0].r.total,2);
  await sessao('moderacao');
  await assert.rejects(verificar(0,true,'x'),/motivo/);await assert.rejects(verificar(0,true,'Revisado',false),/Confirme/);
  await verificar();await assert.rejects(verificar(),/organizador mudou/);
  await db.exec('reset role');assert.equal((await db.query('select status from events where id=$1',[primeiro])).rows[0].status,'em_analise');
  await sessao(null);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);const segundo=await comunitario();
  await sessao('super');await verificar(1,false,'Verificação revogada');
  await sessao(null);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);const terceiro=await comunitario();
  await db.exec('reset role');
  assert.equal((await db.query('select status from events where id=$1',[segundo])).rows[0].status,'publicado');
  assert.equal((await db.query('select status from events where id=$1',[terceiro])).rows[0].status,'em_analise');
  assert.equal((await db.query('select count(*) n from audit_log')).rows[0].n,3);
  assert.equal((await db.query('select verificado_em from organizers where user_id=$1',[b])).rows[0].verificado_em,null);
  await db.exec(sql);assert.equal((await db.query('select verificacao_versao from organizers where user_id=$1',[b])).rows[0].verificacao_versao,2);
  await sessao('leitura');const consulta=(await db.query("select admin_organizadores('Conta',0) r")).rows[0].r;
  assert.equal(consulta.total,1);assert.equal(consulta.itens[0].eventos,3);assert.equal(JSON.stringify(consulta).includes('email'),false);
  await assert.rejects(db.query("select admin_organizadores('',-1)"),/inválida/);
  await assert.rejects(db.query('select * from admin_eventos_pedidos'),/permission denied/);
  await db.exec('reset role;set role anon');
  for(const q of ['select admin_organizadores()','select admin_evento_chave()',"select admin_organizador_verificar(null,0,true,'Motivo',true)","select admin_evento_oficial_criar(null,'{}',true)"]) await assert.rejects(db.query(q),/permission denied/);
  console.log('OK: guardas reais, 2FA, RLS, idempotência, validações, auditoria e transições reais de publicação com verificação/revogação.');
} finally {await db.close();}
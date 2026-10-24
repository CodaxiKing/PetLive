import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite(); const uid=n=>`51000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [tutor,ong,outra]=[1,2,3].map(uid), g=uid(10),h=uid(11),pet=uid(100);
async function entrar(id,role='authenticated') {await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const pets=(t=ong,c=null)=>db.query('select ong_pets_listar($1,$2,$3) as r',[t,c?.criado_em??null,c?.id??null]).then(r=>r.rows[0].r);
const contatos=(t=ong,p=pet,c=null)=>db.query('select ong_interesses_listar($1,$2,$3,$4) as r',[t,p,c?.criado_em??null,c?.id??null]).then(r=>r.rows[0].r);
const adotar=(t=ong,p=pet)=>db.query('select ong_marcar_adotado($1,$2) as r',[t,p]).then(r=>r.rows[0].r);
const email=(t=ong,c=uid(200))=>db.query('select ong_contato_email($1,$2) as r',[t,c]).then(r=>r.rows[0].r);
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;create table profiles(id uuid primary key);
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into profiles values('${tutor}'),('${ong}'),('${outra}');`);
  for(const f of ['20261206000000_catalogo_adocao.sql','20261209000000_interesse_adocao.sql','20261211000000_painel_ong_interessados.sql']) await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/20261211000000_painel_ong_interessados.sql',import.meta.url),'utf8'));
  await db.exec(`insert into adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) values
    ('${g}','${ong}','Abrigo','Nova Iguaçu','Centro','aprovada'),('${h}','${outra}','Outro Abrigo','Rio','Centro','aprovada');
    insert into adocao_pets(id,ong_id,nome,especie,porte,sexo,descricao,status,criado_em)
    select ('51000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${g}','Pet '||i,'cao','medio','macho','Descrição','publicado','2026-01-01' from generate_series(100,124) i;
    insert into adocao_pets(id,ong_id,nome,especie,porte,sexo,descricao,status) values('${uid(150)}','${h}','Outro','gato','pequeno','femea','Descrição','publicado');
    insert into adocao_contatos(id,tutor_id,pet_id,mensagem,email_resposta,criado_em)
    select ('51000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${tutor}','${pet}','Interesse '||i,'tutor@example.com','2026-01-01' from generate_series(200,224) i;`);
  await entrar('', 'anon'); for(const fn of [pets,contatos,adotar,email]) await assert.rejects(fn(),/permission denied/);
  await entrar(tutor);assert.equal((await pets(tutor)).ongs.length,0);assert.equal((await pets(tutor)).itens.length,0);
  for(const fn of [contatos,adotar,email]) await assert.rejects(fn(tutor),/Somente|indisponível/);
  await entrar(outra);await assert.rejects(contatos(outra),/Somente/);await assert.rejects(adotar(outra),/Somente/);await assert.rejects(email(outra),/indisponível/);
  await entrar(ong);await assert.rejects(pets(tutor),/nesta conta/);
  const p1=await pets();assert.equal(p1.itens.length,20);assert.equal(p1.tem_mais,true);assert.equal(p1.ongs.length,1);
  const p2=await pets(ong,p1.itens.at(-1));assert.equal(p2.itens.length,5);assert.equal(new Set([...p1.itens,...p2.itens].map(i=>i.id)).size,25);
  const c1=await contatos();assert.equal(c1.itens.length,20);assert(!('tutor_id' in c1.itens[0]));
  const c2=await contatos(ong,pet,c1.itens.at(-1));assert.equal(c2.itens.length,5);assert.equal(new Set([...c1.itens,...c2.itens].map(i=>i.id)).size,25);
  assert.equal(await email(),'tutor@example.com');assert.equal(await adotar(),true);assert.equal(await adotar(),true);
  assert.equal((await contatos()).itens.length,20,'adoção preserva contatos');
  await assert.rejects(db.exec("update adocao_pets set status='publicado'"),/permission denied/);
  await entrar(tutor);assert.equal((await db.query('select adocao_detalhe($1,$2) as r',[tutor,pet])).rows[0].r,null);
  await assert.rejects(db.query('select adocao_enviar_interesse($1,$2,$3,$4,true)',[tutor,pet,'Novo interesse realista','tutor@example.com']),/não está disponível/);
  await db.exec(`reset role;update adocao_pets set status='oculto' where id='${uid(101)}'`);await entrar(ong);await assert.rejects(adotar(ong,uid(101)),/Somente pets publicados/);
  for(const estado of ['pendente','suspensa','recusada']) {
    await db.exec(`reset role;update adocao_ongs set status='${estado}' where id='${g}'`);await entrar(ong);
    assert.equal((await pets()).ongs[0].status,estado);await assert.rejects(contatos(),/Somente/);await assert.rejects(adotar(),/Somente/);await assert.rejects(email(),/indisponível/);
    assert.equal((await db.query('select * from adocao_contatos')).rows.length,0,'RLS direta também bloqueia ONG não aprovada');
  }
  await db.exec(`reset role;update adocao_ongs set status='aprovada' where id='${g}';delete from profiles where id='${tutor}'`);await entrar(ong);
  assert.equal((await contatos()).itens.length,0);await assert.rejects(email(),/indisponível/);
  console.log('OK: painel/contatos paginados, isolamento tutor/ONG/anon, email revalidado, status/moderação, adoção idempotente, catálogo e cascata.');
} catch(e) {console.error(e);process.exitCode=1;} finally {await db.close();}

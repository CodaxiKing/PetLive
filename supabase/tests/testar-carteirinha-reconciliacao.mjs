import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);const db=new PGlite();
const uid=n=>`55000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const [a,b,pet]=[1,2,3].map(uid);
const integradas=process.env.TESTAR_FICHAS_INTEGRADAS==='1';const lugar=integradas?uid(9):'osm:teste';
async function entrar(user=a,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);}
const criar=(secoes=[],tipo='carteirinha',horas=24,lugar=null,canal=null)=>db.query('select criar_link_carteirinha($1,$2,$3,$4,$5,$6) as r',[pet,secoes,horas,tipo,lugar,canal]).then(r=>r.rows[0].r);
const abrir=code=>db.query('select carteirinha_publica($1) as r',[code]).then(r=>r.rows[0].r);
try {
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function extensions.gen_random_bytes(n int) returns bytea language sql as $$select decode(string_agg(substr(md5(random()::text),1,2),''),'hex') from generate_series(1,n)$$;
 create function extensions.digest(v text,alg text) returns bytea language sql as $$select decode(md5(v)||md5(v),'hex')$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 create function exportar_meus_dados() returns jsonb language sql as $$select '{"anterior":true}'::jsonb$$;
 create table profiles(id uuid primary key,nome text,telefone text,whatsapp boolean,cidade text,contato_emergencia_nome text,contato_emergencia_telefone text);
 create table pets(id uuid primary key,tutor_id uuid,nome text,especie text,foto_url text,raca text,nascimento date,sexo text,peso_atual numeric,castrado boolean,alergias text,ativo boolean,em_memoria boolean);
 create table vaccinations(pet_id uuid,nome text,aplicada_em date,proxima_dose date);
 create table dewormings(pet_id uuid,produto text,aplicado_em date,proxima_dose date);
 create table medications(pet_id uuid,nome text,dose text,frequencia text,horarios time[],inicio date,fim date,ativo boolean);
 create table weights(pet_id uuid,medido_em date);create table places(id ${integradas?'uuid':'text'} primary key);
 create table notification_log(id uuid primary key default gen_random_uuid(),user_id uuid,pet_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz default now(),read_at timestamptz);
 insert into profiles values('${a}','Tutor','telefone-secreto',true,'Cidade','Contato','outro-telefone'),('${b}','Outro',null,false,null,null,null);
 insert into pets values('${pet}','${a}','Pet teste','cao',null,'Raça',current_date-1,'macho',5,true,'alergia-secreta',true,false);
 insert into places values('${lugar}');insert into vaccinations values('${pet}','Vacina teste',current_date-1,current_date+1);`);
 const sql=await readFile(new URL('../migrations/20261218000000_reconciliar_carteirinha.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 if(integradas)for(const nome of ['20261219000000_aviso_abertura_ficha.sql','20261220000000_historico_envios_fichas.sql']){const s=await readFile(new URL(`../migrations/${nome}`,import.meta.url),'utf8');await db.exec(s);await db.exec(s);}
 await entrar('','anon');await assert.rejects(criar(),/permission denied/);assert.deepEqual(await abrir('inexistente'),{valido:false});
 await entrar(b);await assert.rejects(criar(),/Pet não encontrado/);
 await entrar();await assert.rejects(criar([],null),/Tipo inválido/);await assert.rejects(criar([],undefined,24,null,'telefone'),/Canal inválido/);await assert.rejects(criar([],undefined,24,'21999999999'),/Lugar indisponível/);
 const r=await criar(['vacinas','xx'],'carteirinha',999);assert.equal(r.codigo.length,64);assert(Date.parse(r.expira_em)-Date.now()<=72*3600000);
 const id=(await db.query('select id from carteirinha_links where codigo=$1',[r.codigo])).rows[0].id;
 await assert.rejects(db.query('select conteudo from carteirinha_links'),/permission denied/);
 await assert.rejects(db.exec("insert into carteirinha_links(codigo) values('x')"),/permission denied/);
 await entrar(b);assert.equal((await db.query('select id from carteirinha_links')).rows.length,0);await db.query('select cancelar_link_carteirinha($1)',[id]);
 await entrar('','anon');const v=await abrir(r.codigo);assert.equal(v.valido,true);assert.equal(v.conteudo.nome,'Pet teste');assert.equal(v.conteudo.tutor,undefined);assert.equal(v.conteudo.alergias,undefined);assert.equal(v.conteudo.vacinas.length,1);assert.deepEqual(v.secoes,['vacinas']);
 await entrar();const f=await criar(['telefone','dados'],'emergencia',24,lugar,'qr');const f2=await criar(['dados','telefone'],'emergencia',24);assert.equal(f.codigo,f2.codigo);assert.equal(f2.reaproveitada,true);
 const curto=await criar(['dados','telefone'],'emergencia',6);assert.notEqual(curto.codigo,f.codigo,'pedido curto não herda duração longa');
 await entrar('','anon');const vf=await abrir(f.codigo);assert.equal(vf.conteudo.tutor.telefone,'telefone-secreto');assert.equal(vf.conteudo.tutor.emergencia_nome,'Contato');
 await db.exec(`reset role;update pets set nome='Nome novo' where id='${pet}'`);await entrar('','anon');assert.equal((await abrir(f.codigo)).conteudo.nome,'Pet teste','snapshot imutável');
 await entrar();await db.query('select cancelar_link_carteirinha($1)',[id]);await entrar('','anon');assert.deepEqual(await abrir(r.codigo),{valido:false});
 await db.exec('reset role');assert.deepEqual((await db.query('select conteudo from carteirinha_links where id=$1',[id])).rows[0].conteudo,{});
 await db.exec('truncate carteirinha_limites');await entrar('','anon');for(let i=0;i<60;i++)assert.equal((await abrir(f.codigo)).valido,true);assert.deepEqual(await abrir(f.codigo),{valido:false});
 await db.exec(`reset role;truncate carteirinha_limites;update carteirinha_links set aberturas=99 where codigo='${f.codigo}'`);await entrar('','anon');assert.equal((await abrir(f.codigo)).valido,true);assert.deepEqual(await abrir(f.codigo),{valido:false});
 await db.exec(`reset role;update pets set em_memoria=true where id='${pet}'`);await entrar('','anon');assert.deepEqual(await abrir(curto.codigo),{valido:false});await entrar();await assert.rejects(criar(),/Pet não encontrado/);
 await db.exec("reset role;update carteirinha_links set expira_em=now()-interval '2 days';select encerrar_links_vencidos()");assert.equal((await db.query("select count(*)::int n from carteirinha_links where conteudo<>'{}'::jsonb")).rows[0].n,0);
 await entrar();const exp=(await db.query('select exportar_meus_dados() as r')).rows[0].r;assert.equal(exp.anterior,true);assert.equal(exp.carteirinha_links.length,3);assert(!JSON.stringify(exp).includes(f.codigo));await entrar(b);assert.equal((await db.query('select exportar_meus_dados() as r')).rows[0].r.carteirinha_links.length,0);
 await db.exec(`reset role;truncate carteirinha_links cascade;update pets set em_memoria=false where id='${pet}'`);await entrar();
 for(let i=0;i<30;i++)await criar();await assert.rejects(criar(),/Muitos links hoje/);
 await db.exec('reset role;truncate carteirinha_links cascade');await entrar();for(let i=0;i<10;i++)await criar([],'emergencia',1);await assert.rejects(criar([],'emergencia',1),/Muitas fichas hoje/);
 if(integradas){
  await db.exec('reset role;truncate carteirinha_links cascade');await entrar();let reuso;for(let i=0;i<10;i++)reuso=await criar(['dados'],'emergencia',24,lugar,'qr');
  await assert.rejects(criar(['dados'],'emergencia',24,lugar,'qr'),/Muitos envios de emergência/);
  const eventos=(await db.query('select id,link_id,tipo,acao,lugar_id,canal,criado_em from carteirinha_envios')).rows;assert.equal(eventos.length,10);assert.equal(eventos.filter(e=>e.acao==='gerar').length,1);assert.equal(eventos.filter(e=>e.acao==='reutilizar').length,9);assert.equal(new Set(eventos.map(e=>e.link_id)).size,1);
  assert.equal((await db.query('select id from carteirinha_links')).rows.length,1,'reuso não duplica ficha');
  await assert.rejects(db.exec("insert into carteirinha_envios(tipo) values('falso')"),/permission denied/);
  await entrar(b);assert.equal((await db.query('select id from carteirinha_envios')).rows.length,0);await entrar('','anon');await assert.rejects(db.query('select id from carteirinha_envios'),/permission denied/);
  await abrir(reuso.codigo);await entrar();const ex=(await db.query('select exportar_meus_dados() as r')).rows[0].r;assert.equal(ex.envios_fichas.length,10);assert(!JSON.stringify(ex.envios_fichas).includes('codigo'));assert(!JSON.stringify(ex.envios_fichas).includes('telefone'));
  assert.equal((await db.query('select id from notification_log')).rows.length>0,true);
  console.log('OK integrado: histórico privado de intenção, reuso auditado/limitado sem duplicar ficha, abertura não conta como envio, exportação composta e avisos no histórico.');
 }
 console.log('OK: reaplicação, dono/anon/RLS, seções e contatos, snapshot, tokens, prazo/reuso, revogação/memorial, quotas diárias/IP/link, limpeza e exportação sem códigos.');
} finally {await db.close();}

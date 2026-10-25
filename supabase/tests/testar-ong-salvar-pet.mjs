import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite }=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite(); const uid=n=>`52000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [a,b]=[1,2].map(uid),g=uid(10),h=uid(11),pet=uid(100);
const foto=`${a}/${pet}-${uid(401)}.jpg`,url=`https://projeto.supabase.co/storage/v1/object/public/pets/${foto}`;
const dados={nome:'Mia',especie:'gato',nascimento:null,porte:'pequeno',sexo:'femea',castrado:null,vacinado:false,vermifugado:true,descricao:'Calma e carinhosa',fotos:[],status:'rascunho'};
async function entrar(id,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const salvar=(versao=0,d=dados,t=a,p=pet,ong=g)=>db.query('select ong_pet_salvar($1,$2,$3,$4,$5) as r',[t,p,ong,versao,d]).then(r=>r.rows[0].r);
const obter=(t=a,p=pet)=>db.query('select ong_pet_obter($1,$2) as r',[t,p]).then(r=>r.rows[0].r);
try {
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
  create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to authenticated,anon,service_role;create table profiles(id uuid primary key);
  create function public.exportar_meus_dados() returns jsonb language sql as $$select '{}'::jsonb$$;
  create schema storage;create table storage.objects(bucket_id text,name text);
  insert into profiles values('${a}'),('${b}');`);
 for(const f of ['20261206000000_catalogo_adocao.sql','20261209000000_interesse_adocao.sql','20261211000000_painel_ong_interessados.sql','20261212000000_ong_salvar_pet.sql']) await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/20261212000000_ong_salvar_pet.sql',import.meta.url),'utf8'));
 await db.exec(`insert into adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) values('${g}','${a}','Abrigo','Nova Iguaçu','Centro','aprovada'),('${h}','${b}','Outro','Rio','Centro','aprovada');
 insert into storage.objects values('pets','${foto}');`);
 await entrar('', 'anon');await assert.rejects(salvar(),/permission denied/);
 await entrar(a);await assert.rejects(salvar(0,dados,b),/nesta conta/);await assert.rejects(salvar(0,dados,a,pet,h),/Somente a ONG/);
 const r=await salvar();assert.equal(r.versao,1);assert.equal(r.status,'rascunho');assert.equal((await obter()).nome,'Mia');
 await assert.rejects(salvar(),/foi alterado/);assert.equal((await db.query('select * from adocao_pets')).rows.length,1,'retry não duplica');
 await assert.rejects(salvar(1,{...dados,role:'admin'}),/inválidos/);
 await assert.rejects(salvar(1,{...dados,status:'adotado'}),/inválidos/);
 await assert.rejects(salvar(1,{...dados,nascimento:'2999-01-01'}),/check constraint/);
 await assert.rejects(salvar(1,{...dados,status:'publicado'}),/ao menos uma foto/);
 await assert.rejects(salvar(1,{...dados,fotos:['https://exemplo.com/externa.jpg']}),/foto não foi confirmada/);
 await assert.rejects(salvar(1,{...dados,fotos:[url.replace(a,b)]}),/foto não foi confirmada/);
 await assert.rejects(salvar(1,{...dados,fotos:Array(7).fill(url)}),/até seis/);
 const publicado=await salvar(1,{...dados,fotos:[url],status:'publicado'});assert.equal(publicado.versao,2);
 assert.equal((await db.query('select adocao_detalhe($1,$2) as r',[a,pet])).rows[0].r.pet.nome,'Mia');
 await assert.rejects(salvar(1,{...dados,nome:'Antigo'}),/foi alterado/);
 assert.equal((await obter()).nome,'Mia');
 const painel=(await db.query('select ong_pets_listar($1) as r',[a])).rows[0].r;assert.equal(painel.ongs[0].id,g);
 await entrar(b);await assert.rejects(obter(b),/indisponível/);await assert.rejects(salvar(2,dados,b,pet,h),/indisponível/);
 await entrar(a);
 for(const status of ['pendente','suspensa','recusada']){await db.exec(`reset role;update adocao_ongs set status='${status}' where id='${g}'`);await entrar(a);await assert.rejects(salvar(2,dados),/Somente a ONG/);await assert.rejects(obter(),/indisponível/);}
 await db.exec(`reset role;update adocao_ongs set status='aprovada' where id='${g}';update adocao_pets set status='oculto' where id='${pet}'`);await entrar(a);await assert.rejects(salvar(2,dados),/adotados ou ocultos/);
 await db.exec(`reset role;update adocao_pets set status='publicado' where id='${pet}'`);await entrar(a);await db.query('select ong_marcar_adotado($1,$2)',[a,pet]);await assert.rejects(salvar(2,dados),/adotados ou ocultos/);
 await assert.rejects(db.exec("insert into adocao_pets(ong_id,nome,especie,porte,sexo,descricao) values('"+g+"','X','cao','medio','macho','X')"),/permission denied/);
 assert.equal((await db.query('select exportar_meus_dados() as r')).rows[0].r.adocao_pets_da_ong.length,1);
 console.log('OK: rascunho, publicação/fotos próprias, versão/conflitos, retry sem duplicação, conta/ONG/moderação, LGPD e reaplicação.');
} catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}

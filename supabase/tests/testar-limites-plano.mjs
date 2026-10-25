import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const a='53000000-0000-4000-8000-000000000001',b='53000000-0000-4000-8000-000000000002';
const p1='54000000-0000-4000-8000-000000000001',p2='54000000-0000-4000-8000-000000000002',p3='54000000-0000-4000-8000-000000000003';
const sql=await readFile(new URL('../migrations/20261226000000_limites_plano_desativados.sql',import.meta.url),'utf8');
async function usuario(id=a){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`);}
try{
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create table profiles(id uuid primary key,plano text);insert into profiles values('${a}','gratis'),('${b}','premium');
 create table pets(id uuid primary key default gen_random_uuid(),tutor_id uuid references profiles(id) on delete cascade,nome text,ativo boolean default true,em_memoria boolean default false,criado_em timestamptz default now(),atualizado_em timestamptz default now());
 create table medications(id uuid primary key default gen_random_uuid(),pet_id uuid references pets(id) on delete cascade,nome text);
 create table medication_doses(id uuid default gen_random_uuid(),medication_id uuid references medications(id) on delete cascade,nome text);
 create table weights(id uuid default gen_random_uuid(),pet_id uuid references pets(id) on delete cascade,nome text);
 create table reminders(id uuid default gen_random_uuid(),pet_id uuid references pets(id) on delete cascade,nome text);
 grant select,insert,update,delete on pets,medications,medication_doses,weights,reminders to authenticated;
 insert into pets(id,tutor_id,nome,criado_em) values('${p1}','${a}','Primeiro','2026-01-01'),('${p2}','${a}','Excedente','2026-01-02');`);
 await db.exec(sql);await db.exec(sql);
 await usuario();
 assert.equal((await db.query('select limites_meu_plano($1) r',[a])).rows[0].r.limites_ativos,false);
 await db.query("insert into pets(id,tutor_id,nome) values($1,$2,'Terceiro')",[p3,a]);
 await db.query("insert into weights(pet_id,nome) values($1,'peso anterior')",[p2]);
 await assert.rejects(db.query('update plano_limites_config set ativo=true'),/permission denied/);
 await assert.rejects(db.query('select plano_pet_editavel($1)',[p1]),/permission denied/);
 await assert.rejects(db.query('select limites_meu_plano($1)',[b]),/conta mudou/);
 await db.exec('reset role;update plano_limites_config set ativo=true');
 await db.exec(sql); // Reaplicar não muda uma configuração deliberada.
 await usuario();
 const r=(await db.query('select limites_meu_plano($1) r',[a])).rows[0].r;
 assert.equal(r.pets_limite,1);assert.deepEqual(r.pets_somente_leitura,[p2,p3]);
 await assert.rejects(db.query("insert into pets(tutor_id,nome) values($1,'Quarto')",[a]),/limite de pets/);
 await db.query("update pets set nome='Editado' where id=$1",[p1]);
 await assert.rejects(db.query("update pets set nome='Bloqueado' where id=$1",[p2]),/somente em leitura/);
 await assert.rejects(db.query('delete from pets where id=$1',[p2]),/somente em leitura/);
 await assert.rejects(db.query("update pets set criado_em='2030-01-01' where id=$1",[p1]),/data de cadastro/);
 await db.query('update pets set ativo=false where id=$1',[p1]);
 await assert.rejects(db.query("insert into pets(tutor_id,nome) values($1,'Não libera vaga ao ocultar')",[a]),/limite de pets/);
 await assert.rejects(db.query("insert into weights(pet_id,nome) values($1,'novo')",[p2]),/somente em leitura/);
 await assert.rejects(db.query("update weights set pet_id=$1 where pet_id=$2",[p1,p2]),/somente em leitura/);
 await assert.rejects(db.query('delete from weights where pet_id=$1',[p2]),/somente em leitura/);
 await db.query("insert into reminders(pet_id,nome) values(null,'Sem pet')");
 await db.exec('reset role;update plano_limites_config set ativo=false');
 const med=(await db.query("insert into medications(pet_id,nome) values($1,'Remédio') returning id",[p2])).rows[0].id;
 await db.exec('update plano_limites_config set ativo=true');await usuario();
 await assert.rejects(db.query('insert into medication_doses(medication_id) values($1)',[med]),/somente em leitura/);
 // Memorial é gratuito e não consome vaga; não aceita outras edições junto.
 await assert.rejects(db.query("update pets set em_memoria=true,nome='contorno' where id=$1",[p2]),/somente em leitura/);
 await db.query('update pets set em_memoria=true where id=$1',[p1]);
 await db.query("update pets set nome='Agora editável' where id=$1",[p2]);
 await assert.rejects(db.query('update pets set em_memoria=false where id=$1',[p1]),/limite de pets/);
 // Usa o plano do titular, não o de quem está executando a escrita.
 await db.exec(`reset role;update profiles set plano='premium' where id='${a}'`);await usuario(b);
 await db.query("update pets set nome='Titular Premium' where id=$1",[p3]);
 await db.exec(`reset role;update profiles set plano='gratis' where id='${a}'`);await usuario();
 await assert.rejects(db.query("update pets set nome='Downgrade' where id=$1",[p3]),/somente em leitura/);
 assert.equal((await db.query('select count(*)::int n from pets where tutor_id=$1',[a])).rows[0].n,3,'downgrade não apaga pets');
 assert.equal((await db.query('select count(*)::int n from weights where pet_id=$1',[p2])).rows[0].n,1,'saúde permanece legível');
 await db.exec(`reset role;delete from profiles where id='${a}'`);
 assert.equal((await db.query('select count(*)::int n from pets')).rows[0].n,0,'cascata de exclusão da conta preservada');
 await db.exec('set role anon');await assert.rejects(db.query('select limites_meu_plano($1)',[a]),/permission denied/);
 console.log('OK: desligado por padrão/reaplicação, quota, leitura preservada, edição/doses/movimentação bloqueadas em excedentes, memorial/reativação, plano do titular, downgrade sem apagar e cascata da conta. Sem ativação em produção.');
}finally{await db.close();}

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
    create table public.profiles(id uuid primary key references auth.users on delete cascade,nome text not null,email text,telefone text,
      role text default 'tutor',provider text default 'email',plano text default 'gratis',aceite_termos boolean default false);
    create table public.pets(id uuid primary key default gen_random_uuid(),tutor_id uuid references profiles on delete cascade);
    grant all on public.profiles to authenticated,service_role;
    insert into auth.users values
      ('50000000-0000-4000-8000-000000000001','tutor@example.com','{"nome":"Diego","role":"admin_super","plano":"premium"}','{"provider":"google"}'),
      ('50000000-0000-4000-8000-000000000002',null,'{"nome":" "}',null),
      ('50000000-0000-4000-8000-000000000003','existente@example.com','{}','{}');
    insert into profiles(id,nome,plano) values('50000000-0000-4000-8000-000000000003','Nome mantido','premium');`);
  await assert.rejects(db.exec("insert into pets(tutor_id) values('50000000-0000-4000-8000-000000000001')"),/foreign key/);
  const sql=await readFile(new URL('../migrations/20261210000000_reparar_perfis_ausentes.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const rows=(await db.query('select * from profiles order by id')).rows;
  assert.equal(rows.length,3);assert.equal(rows[0].nome,'Diego');assert.equal(rows[0].plano,'gratis');
  assert.equal(rows[0].role,'tutor');assert.equal(rows[0].provider,'google');assert.equal(rows[0].aceite_termos,false);
  assert.equal(rows[1].nome,'Tutor');assert.equal(rows[1].provider,'email');assert.equal(rows[2].nome,'Nome mantido');assert.equal(rows[2].plano,'premium');
  await db.exec("insert into pets(tutor_id) values('50000000-0000-4000-8000-000000000001');set role authenticated");
  await assert.rejects(db.exec('delete from profiles'),/permission denied/);
  await db.exec("reset role;delete from auth.users where id='50000000-0000-4000-8000-000000000001'");
  assert.equal((await db.query('select * from pets')).rows.length,0,'exclusão Auth preserva cascata');
  console.log('OK: reproduz FK, repara sem promoção/aceite, preserva existentes, reaplica e protege exclusão direta/cascata.');
} catch(e) { console.error(e.message);process.exitCode=1; } finally {await db.close();}

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_change text);
    create table public.profiles(id uuid primary key,email text,nome text);
    insert into auth.users values('00000000-0000-4000-8000-000000000001','atual@exemplo.com',null);
    insert into public.profiles values('00000000-0000-4000-8000-000000000001','atual@exemplo.com','Tutor');`);
  const sql = await readFile(new URL('../migrations/20261227000000_sincronizar_email_confirmado.sql',import.meta.url),'utf8');
  await db.exec(sql); await db.exec(sql);
  await db.exec(`update auth.users set email_change='novo@exemplo.com'`);
  assert.equal((await db.query('select email from profiles')).rows[0].email,'atual@exemplo.com');
  await db.exec(`update auth.users set email='novo@exemplo.com',email_change=null`);
  assert.deepEqual((await db.query('select email,nome from profiles')).rows[0],{email:'novo@exemplo.com',nome:'Tutor'});
  assert.equal((await db.query("select has_function_privilege('authenticated','public.sincronizar_email_confirmado()','EXECUTE') permitido")).rows[0].permitido,false);
  console.log('OK: pendência preservada; confirmação sincronizada; nome preservado; acesso direto negado; reaplicação segura.');
} finally { await db.close(); }

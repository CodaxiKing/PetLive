import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const a='63000000-0000-4000-8000-000000000001',b='63000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role authenticated;create schema storage;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:1]$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
    grant usage on schema storage,auth to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  const sql=await readFile(new URL('../migrations/20261229000000_reparar_storage_perfis.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  const bucket=(await db.query('select * from storage.buckets')).rows[0];
  assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);set role authenticated`);
  await db.query('insert into storage.objects values($1,$2)',['perfis',`${a}/foto.jpg`]);
  await assert.rejects(db.query('insert into storage.objects values($1,$2)',['perfis',`${b}/foto.jpg`]),/row-level security/);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${b}',false);set role authenticated`);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  assert.equal((await db.query('delete from storage.objects returning *')).rows.length,0);
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${a}',false);set role authenticated`);
  assert.equal((await db.query('delete from storage.objects returning *')).rows.length,1);
  console.log('OK: bucket privado, limite 5MB, reaplicação, upload próprio, isolamento de leitura e exclusão.');
} finally { await db.close(); }

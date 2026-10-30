// Banco PostgreSQL em memória (pglite) com todas as migrações, para testar
// funções do banco sem Docker e sem tocar no Supabase hospedado. Os esquemas
// do Supabase (auth, storage, cron, net, vault) entram como stubs mínimos.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('../../', import.meta.url));

export async function montarBanco() {
  const { PGlite } = await import(pathToFileURL(raiz + 'node_modules/@electric-sql/pglite/dist/index.js').href);
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create role supabase_admin;
create schema auth; create schema storage; create schema extensions; create schema cron;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon')$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz, created_at timestamptz default now(), phone text, last_sign_in_at timestamptz, deleted_at timestamptz, is_anonymous boolean default false, banned_until timestamptz, updated_at timestamptz default now(), encrypted_password text, email_change text, aud text, role text);
create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid, provider text, provider_id text, identity_data jsonb, email text);
create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
create function storage.filename(name text) returns text language sql as $$select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)]$$;
create function storage.extension(name text) returns text language sql as $$select reverse(split_part(reverse(name),'.',1))$$;
create table cron.job(jobid serial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;
create function cron.unschedule(n text) returns boolean language sql as $$delete from cron.job where jobname=n returning true$$;
create function cron.unschedule(n bigint) returns boolean language sql as $$delete from cron.job where jobid=n returning true$$;
create function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$select decode(string_agg(lpad(to_hex((random()*255)::int),2,'0'),''),'hex') from generate_series(1,n)$$;
create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$select extensions.gen_random_bytes(n)$$;
create function extensions.digest(d text, t text) returns bytea language sql as $$select sha256(convert_to(d,'utf8'))$$;
create function extensions.digest(d bytea, t text) returns bytea language sql as $$select sha256(d)$$;
create function public.digest(d text, t text) returns bytea language sql as $$select sha256(convert_to(d,'utf8'))$$;
create function public.digest(d bytea, t text) returns bytea language sql as $$select sha256(d)$$;
create schema net; create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$select 1::bigint$$;
create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
grant usage on schema auth,public,storage,extensions to authenticated,anon,service_role;
`);
  const pasta = raiz + 'supabase/migrations/';
  for (const f of (await readdir(pasta)).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = (await readFile(pasta + f, 'utf8')).replace(/create extension[^;]*;/gi, '');
    try { await db.exec(sql); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  return db;
}

// Age como um usuário logado (ou anon / service_role) nas próximas consultas.
export async function entrar(db, uid, role = 'authenticated') {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
}

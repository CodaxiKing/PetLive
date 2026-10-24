// Reproduz somente os METADADOS do schema antigo. Nunca importa dados de usuários.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const a = '45000000-0000-4000-8000-000000000001';
const q = (s) => '"' + s.replaceAll('"', '""') + '"';
const migration = async (nome) => (await readFile(new URL(`../migrations/${nome}`, import.meta.url), 'utf8')).replace(/^create extension[^;]*;\s*/gm, '');
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon,service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;`);
  const meta = JSON.parse((await readFile(process.env.PETLIVE_SCHEMA_METADATA, 'utf8')).replace(/^\uFEFF/, ''));
  const tabelas = new Map();
  for (const col of meta.colunas) { if (!tabelas.has(col.tabela)) tabelas.set(col.tabela, []); tabelas.get(col.tabela).push(col); }
  for (const [nome, colunas] of tabelas) await db.exec(`create table public.${q(nome)}(${colunas.map((c) => `${q(c.coluna)} ${q(c.tipo)}${c.coluna === 'id' ? ` primary key${c.tipo === 'uuid' ? ' default gen_random_uuid()' : ''}` : ''}`).join(',')});`);
  await db.exec(`create function public.is_pet_owner(pet_uuid uuid) returns boolean language sql security definer as $$select exists(select 1 from public.pets where id=pet_uuid and tutor_id=auth.uid())$$;
    insert into auth.users values('${a}');insert into profiles(id,plano,notificacoes_ativas,fuso_horario) values('${a}','premium',true,'UTC');`);
  const deps = await migration('20261207000000_dependencias_tutor_producao.sql');
  await db.exec(deps); await db.exec(deps);
  const arquivos = ['20261122000000_eventos_pet.sql','20261123000000_eventos_jobs.sql','20261124000000_evento_detalhe.sql','20261125000000_evento_presenca.sql','20261126000000_evento_edicao.sql','20261127000000_evento_foto.sql','20261128000000_evento_denuncias.sql','20261129000000_eventos_filtros.sql','20261202000000_proteger_plano_e_papel_perfil.sql','20261203000000_passeios_tutor.sql','20261204000000_eventos_por_regiao.sql','20261205000000_exportar_despesas.sql','20261206000000_catalogo_adocao.sql'];
  for (const nome of arquivos) { try { await db.exec(await migration(nome)); } catch (e) { throw new Error(`${nome}: ${e.message}`); } }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
  const exp = (await db.query('select exportar_meus_dados() as r')).rows[0].r;
  for (const chave of ['perfil','vacinas','consentimentos','caixa_de_avisos','despesas','documentos_saude','passeios_nuvem','regiao_eventos','adocao_favoritos']) assert(chave in exp, `LGPD: ${chave}`);
  await db.query('select eventos_regiao_configurar($1,true,10,-22.75,-43.45)', [a]);
  await db.exec(`insert into places(id,nome,lat,lng) values('45000000-0000-4000-8000-000000000002','Praça',-22.75,-43.45);
    insert into events(titulo,tipo,descricao,inicio_em,fim_em,local_nome,place_id,status)
    values('Evento realista','encontro','Descrição de teste isolado',now()+interval '2 days',now()+interval '3 days','Praça','45000000-0000-4000-8000-000000000002','publicado');`);
  const hora = new Date().toISOString().slice(0, 10) + 'T15:00:00Z';
  await assert.rejects(db.query('select eventos_avisar_proximos($1)', [hora]), /uuid = text/);
  await db.exec(await migration('20261208000000_eventos_places_uuid.sql'));
  assert.equal((await db.query('select eventos_avisar_proximos($1) as n', [hora])).rows[0].n, 1, 'job funciona com places UUID');
  await db.exec(deps); // Reaplicar não perde as exportações adicionadas depois.
  const novamente = (await db.query('select exportar_meus_dados() as r')).rows[0].r;
  assert('adocao_favoritos' in novamente); assert('passeios_nuvem' in novamente);
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("update profiles set plano='premium'"), /permission denied/);
  assert.equal((await db.query('select adocao_listar($1) as r', [a])).rows[0].r.itens.length, 0);
  console.log('OK: upgrade do schema antigo, reaplicação, exportação completa, RLS/plano e regressão UUID/text corrigida.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await db.close(); }

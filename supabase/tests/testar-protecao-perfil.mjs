// PostgreSQL embarcado, somente em memória; não conecta ao Supabase remoto.
// PGLITE_MODULE aponta para dist/index.js de uma instalação isolada de PGlite.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

assert(process.env.PGLITE_MODULE, 'Defina PGLITE_MODULE para a instalação isolada do PostgreSQL de teste.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const ler = (arquivo) => readFile(new URL(arquivo, import.meta.url), 'utf8');
const migration = await ler('../migrations/20261202000000_proteger_plano_e_papel_perfil.sql');
const roles = 'create role authenticated; create role anon; create role service_role bypassrls;';

for (const schema of ['completo', 'minimo']) {
  const db = new PGlite();
  try {
    await db.exec(roles);
    if (schema === 'completo') {
      await db.exec(await ler('fixtures/profiles-com-grants-amplos.sql'));
      await db.exec(await ler('perfil-antes-protecao.sql'));
    } else {
      await db.exec(`
        create schema auth;
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
        $$;
        grant usage on schema auth, public to authenticated,anon,service_role;
        create table public.profiles(id uuid primary key,nome text,plano text default 'gratis');
        grant all on public.profiles to authenticated,service_role;
        insert into public.profiles(id,nome) values('42000000-0000-4000-8000-000000000001','Tutor');
      `);
    }
    await db.exec(migration);
    await db.exec(migration);
    if (schema === 'completo') {
      await db.exec(await ler('protecao-perfil.sql'));
    } else {
      const { rows } = await db.query(`select
        has_column_privilege('authenticated','profiles','nome','UPDATE') as nome_editavel,
        has_column_privilege('authenticated','profiles','plano','UPDATE') as plano_editavel`);
      assert.deepEqual(rows, [{ nome_editavel: true, plano_editavel: false }]);
      await db.exec(`begin; set local role authenticated;
        select set_config('request.jwt.claim.sub','42000000-0000-4000-8000-000000000001',true);
        update profiles set nome='Atualizado' where id=auth.uid(); rollback;`);
    }
    console.log(`Schema ${schema}: proteção, edição permitida e reaplicação OK`);
  } catch (erro) {
    console.error(`Schema ${schema}: ${erro.code ?? ''} ${erro.message}`);
    process.exitCode = 1;
    break;
  } finally { await db.close(); }
}

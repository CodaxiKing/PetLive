// PostgreSQL em memória. Nunca conecta à produção.
// PGLITE_MODULE aponta para dist/index.js da instalação isolada de @electric-sql/pglite.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
assert(process.env.PGLITE_MODULE, 'Defina PGLITE_MODULE.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const tutor = '42000000-0000-4000-8000-000000000001', outro = '42000000-0000-4000-8000-000000000002';
const pet = '52000000-0000-4000-8000-000000000001', petOutro = '52000000-0000-4000-8000-000000000002';
const id = '62000000-0000-4000-8000-000000000001';
const agora = Date.now();
const dados = { id, tutorId: tutor, petId: pet, nomePet: 'Luna', status: 'pausado', inicio: agora - 60000,
  atualizadoEm: agora, fim: null, ativoDesde: null, duracaoMs: 60000, distanciaM: 10, trecho: 0,
  pontos: [{ lat: -22.75, lng: -43.45, instante: agora - 1000, precisao: 5, trecho: 0 }], anotacao: '' };
const entrar = async (uid, role = 'authenticated') => {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
};
const enviar = async (p, versao = 0) => (await db.query('select public.passeio_sincronizar($1::jsonb,$2) as r', [JSON.stringify(p), versao])).rows[0].r;
try {
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table auth.users(id uuid primary key);
    create table public.pets(id uuid primary key,tutor_id uuid references auth.users);
    insert into auth.users values('${tutor}'),('${outro}');
    insert into public.pets values('${pet}','${tutor}'),('${petOutro}','${outro}');
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{"existente":true}'::jsonb$$;
  `);
  const migration = await readFile(new URL('../migrations/20261203000000_passeios_tutor.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  await entrar(tutor);
  const salvo = await enviar(dados); assert.equal(salvo.versao, 1);
  assert.equal((await enviar(dados)).versao, 1, 'repetição após perda de resposta');
  const editado = { ...dados, anotacao: 'parque' };
  assert.equal((await enviar(editado, 1)).versao, 2);
  await assert.rejects(enviar({ ...editado, anotacao: 'conflito' }, 1), (e) => e.code === '40001');
  await assert.rejects(enviar({ ...dados, petId: petOutro }, 2));
  await assert.rejects(db.exec("update public.passeios_tutor set versao=100"), /permission denied/);
  await assert.rejects(db.exec("delete from public.passeios_tutor"), /permission denied/);
  for (const alteracao of [ { status: null }, { nomePet: null }, { ativoDesde: 1 }, { status: 'gravando' },
    { tutorId: outro }, { distanciaM: -1 }, { anotacao: 'x'.repeat(1001) }, { fotoId: 'arquivo-local' },
    { atualizadoEm: agora + 600000 }, { pontos: [{ ...dados.pontos[0], lat: 100 }] },
    { pontos: [dados.pontos[0], dados.pontos[0]] }, { pontos: [{ ...dados.pontos[0], precisao: 100 }] } ]) {
    await assert.rejects(enviar({ ...editado, ...alteracao }, 2), `deve rejeitar ${Object.keys(alteracao)}`);
  }
  const exportado = (await db.query('select public.exportar_meus_dados() as r')).rows[0].r;
  assert.equal(exportado.existente, true); assert.equal(exportado.passeios_nuvem.length, 1);
  await assert.rejects(db.query('select public.exportar_meus_dados_sem_passeios()'), /permission denied/);
  await entrar(outro);
  assert.equal((await db.query('select * from public.passeios_tutor')).rows.length, 0);
  await assert.rejects(enviar({ ...dados, tutorId: outro }));
  await assert.rejects(db.query('select public.passeios_apagar_nuvem($1)', [tutor]), /nesta conta/);
  await db.query('select public.passeios_apagar_nuvem($1)', [outro]);
  assert.equal((await db.query('select public.exportar_meus_dados() as r')).rows[0].r.passeios_nuvem.length, 0);
  await entrar('', 'anon');
  await assert.rejects(enviar(dados), /permission denied/);
  await assert.rejects(db.exec('select * from public.passeios_tutor'), /permission denied/);
  await entrar(tutor);
  assert.equal((await db.query('select * from public.passeios_tutor')).rows.length, 1, 'outro não apagou');
  await enviar({ ...dados, id: '62000000-0000-4000-8000-000000000004', petId: '52000000-0000-4000-8000-000000000099', status: 'concluido', fim: agora });
  assert.equal((await db.query('select pet_id from public.passeios_tutor where id=$1', ['62000000-0000-4000-8000-000000000004'])).rows[0].pet_id, null, 'pet removido preserva passeio histórico');
  const antigo = { ...dados, id: '62000000-0000-4000-8000-000000000003', inicio: agora - 10 * 3600000,
    atualizadoEm: agora - 9 * 3600000, duracaoMs: 60000, pontos: [] };
  await enviar(antigo);
  await assert.rejects(db.query('select public.passeios_preparar_sincronizacao($1)', [outro]), /nesta conta/);
  await db.query('select public.passeios_preparar_sincronizacao($1)', [tutor]);
  const encerrado = (await db.query('select dados,versao from public.passeios_tutor where id=$1', [antigo.id])).rows[0];
  assert.equal(encerrado.dados.status, 'concluido'); assert.equal(encerrado.dados.fim, antigo.atualizadoEm);
  assert.equal(encerrado.dados.duracaoMs, 60000); assert.equal(encerrado.versao, 2);
  await assert.rejects(enviar(antigo, 2), /reaberto/);
  await assert.rejects(db.exec('select public.passeios_encerrar_inativos()'), /permission denied/);
  await db.query('select public.passeios_apagar_nuvem($1)', [tutor]);
  assert.equal((await db.query('select * from public.passeios_tutor')).rows.length, 0);
  await enviar(dados);
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1', [tutor]).catch(async () => {
    await db.query('delete from public.pets where tutor_id=$1', [tutor]);
    await db.query('delete from auth.users where id=$1', [tutor]);
  });
  assert.equal((await db.query('select * from public.passeios_tutor')).rows.length, 0, 'exclusão da conta remove trajetos');
  console.log('Passeios: RLS, validação, conflitos, idempotência, encerramento, exportação, exclusão e reaplicação OK.');
} finally { await db.close(); }

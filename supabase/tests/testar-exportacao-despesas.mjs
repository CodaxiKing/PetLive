// PostgreSQL isolado em memória. Nenhum acesso à produção ou envio externo.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
assert(process.env.PGLITE_MODULE, 'Defina PGLITE_MODULE para o PGlite.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const a = '43000000-0000-4000-8000-000000000001', b = '43000000-0000-4000-8000-000000000002';
const p = '43000000-0000-4000-8000-000000000003', q = '43000000-0000-4000-8000-000000000004';
async function entrar(uid, role = 'authenticated') {
  await db.exec(`reset role;set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
const exportar = (tutor = a, pet = null, mes = '2026-10-01') => db.query('select public.despesas_exportar($1,$2,$3) as r', [tutor, mes, pet]);
const configurar = (tutor = a, ativo = true) => db.query('select public.despesas_resumo_configurar($1,$2)', [tutor, ativo]);
async function job(quando = '2026-11-01T12:00:00Z') {
  await db.exec('reset role;set role service_role');
  return (await db.query('select public.despesas_enviar_resumos($1) as n', [quando])).rows[0].n;
}
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table profiles(id uuid primary key,plano text,notificacoes_ativas boolean default true,fuso_horario text default 'America/Sao_Paulo');
    create table pets(id uuid primary key,tutor_id uuid references profiles,nome text);
    create table despesas(id uuid primary key default gen_random_uuid(),tutor_id uuid references profiles,pet_id uuid references pets,categoria text,valor_centavos int,data date,anotacao text,recibo_path text,criado_em timestamptz default now());
    create table notification_settings(tutor_id uuid primary key,horario_avisos time);
    create table notification_log(user_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz);
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{"anterior":true}'::jsonb$$;
    insert into profiles(id,plano) values('${a}','premium'),('${b}','gratis');
    insert into pets values('${p}','${a}','Mia'),('${q}','${b}','Outro');
    insert into despesas(tutor_id,pet_id,categoria,valor_centavos,data,anotacao,recibo_path) values
      ('${a}','${p}','racao',1990,'2026-10-01','Mia','privado'),
      ('${a}',null,'outros',10,'2026-10-31',null,null),
      ('${a}',null,'outros',100,'2026-11-01',null,null),
      ('${b}','${q}','racao',999,'2026-10-05','SEGREDO',null);`);
  const sql = await readFile(new URL('../migrations/20261205000000_exportar_despesas.sql', import.meta.url), 'utf8');
  await db.exec(sql); await db.exec(sql);
  await entrar(a);
  const rel = (await exportar()).rows[0].r;
  assert.equal(rel.itens.length, 2); assert.equal(rel.itens[0].pet_nome, 'Mia');
  assert(!JSON.stringify(rel).includes('SEGREDO')); assert(!JSON.stringify(rel).includes('recibo'));
  assert.equal((await exportar(a, p)).rows[0].r.itens.length, 2, 'inclui despesa de todos');
  await assert.rejects(exportar(a, q), /Pet indisponível/);
  await assert.rejects(exportar(b), /nesta conta/);
  await assert.rejects(exportar(a, null, '2026-10-02'), /mês válido/);
  await assert.rejects(db.exec('select despesas_enviar_resumos()'), /permission denied/);
  assert.equal((await db.query('select * from despesas_resumo_preferencias')).rows.length, 0, 'desligado por padrão');
  await assert.rejects(configurar(b), /nesta conta/);
  await configurar();
  await db.exec(`reset role;update despesas_resumo_preferencias set atualizado_em='2026-10-24T12:00:00Z';set role authenticated`);
  await assert.rejects(db.exec('update despesas_resumo_preferencias set ativo=false'), /permission denied/);
  const exp = (await db.query('select exportar_meus_dados() as r')).rows[0].r;
  assert.equal(exp.anterior, true); assert.equal(exp.preferencia_resumo_despesas.ativo, true);
  await entrar(b); await assert.rejects(exportar(b), /Premium/);
  assert.equal((await db.query('select * from despesas_resumo_preferencias')).rows.length, 0);
  await entrar('', 'anon'); await assert.rejects(exportar(), /permission denied/);
  assert.equal(await job('2026-11-01T11:00:00Z'), 0, 'antes das 9h locais');
  assert.equal(await job(), 1); assert.equal(await job(), 0, 'idempotente no mês');
  await db.exec('reset role');
  const aviso = (await db.query('select * from notification_log')).rows[0];
  assert(aviso.body.includes('20,00')); assert.equal(aviso.deep_link, '/despesas?mes=2026-10');
  await db.exec('delete from despesas_resumos_enviados;delete from notification_log');
  await entrar(a); await configurar(a, false); assert.equal(await job(), 0, 'opt-out');
  await entrar(a); await configurar();
  await db.exec(`reset role;update despesas_resumo_preferencias set atualizado_em='2026-10-24T12:00:00Z'`);
  await db.exec(`reset role;update profiles set notificacoes_ativas=false where id='${a}'`);
  assert.equal(await job(), 0, 'avisos gerais desligados');
  await db.exec(`reset role;update profiles set notificacoes_ativas=true,fuso_horario='inexistente' where id='${a}';
    insert into notification_settings values('${a}','14:00')`);
  assert.equal(await job(), 0, 'horário personalizado e fuso inválido com fallback');
  assert.equal(await job('2026-11-01T18:00:00Z'), 1);
  assert.equal(await job('2026-12-01T18:00:00Z'), 1, 'novo mês');
  assert.equal(await job('2027-01-01T18:00:00Z'), 0, 'sem registros, sem aviso');
  await db.exec(`reset role;insert into despesas(tutor_id,categoria,valor_centavos,data)
    select '${a}','outros',1,'2026-09-01' from generate_series(1,1001)`);
  await entrar(a); assert.equal((await exportar(a, null, '2026-09-01')).rows[0].r.itens.length, 1001, 'não trunca em mil');
  await db.exec(`reset role;insert into despesas(tutor_id,categoria,valor_centavos,data)
    select '${a}','outros',1,'2026-09-01' from generate_series(1,4000)`);
  await entrar(a); await assert.rejects(exportar(a, null, '2026-09-01'), /5.000 despesas/);
  await db.exec(`reset role;delete from despesas where tutor_id='${a}';delete from pets where tutor_id='${a}';delete from profiles where id='${a}'`);
  assert.equal((await db.query('select * from despesas_resumo_preferencias')).rows.length, 0);
  assert.equal((await db.query('select * from despesas_resumos_enviados')).rows.length, 0);
  console.log('OK: exportação Premium, privacidade, filtros, 1.001 linhas, limite explícito, opt-in, horário, idempotência, LGPD e exclusão.');
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await db.close(); }

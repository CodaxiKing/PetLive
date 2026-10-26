import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const a = '51000000-0000-4000-8000-000000000001', b = '51000000-0000-4000-8000-000000000002';
const sql = await readFile(new URL('../migrations/20270109000000_lgpd_worker_seguro.sql', import.meta.url), 'utf8');
for (const legado of [true, false]) {
  const db = new PGlite();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const conta = async (id) => db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`);
  try {
    await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
      create schema auth;create schema storage;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,storage,public to authenticated,anon,service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values('${a}'),('${b}');
      create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);
      insert into profiles values('${a}'),('${b}');
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      grant insert,update on storage.objects to authenticated;
      create table lgpd_requests(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,
       tipo text check(tipo in ('exportar','${legado ? 'excluir' : 'apagar'}')),
       status text check(status in ('${legado ? 'pendente' : 'novo'}','concluido','cancelado','em_andamento')),
       criado_em timestamptz default now(),executar_em timestamptz,done_at timestamptz);
      insert into storage.objects(bucket_id,name) values('perfis','${a}/foto.jpg');`);
    await db.exec(sql); await db.exec(sql);
    const scheduler=await readFile(new URL('../migrations/20270109030000_lgpd_agendamento.sql',import.meta.url),'utf8');
    await db.exec(scheduler);await db.exec(scheduler);
    await db.exec('set role service_role');
    await q('select lgpd_worker_disparar()'); // Desligado: não consulta Vault/rede.
    await assert.rejects(q('select lgpd_worker_agendar()'),/Instale/);
    await conta(a);
    await assert.rejects(q('select privacidade_solicitar_exclusao($1)', [a]), /indisponível/);
    await assert.rejects(q('select privacidade_solicitar_exclusao($1)', [b]), /conta mudou/);
    await assert.rejects(q('select * from lgpd_exclusoes'), /permission denied/);
    await assert.rejects(q('select lgpd_exclusao_reivindicar()'), /permission denied/);
    await db.exec('reset role;update lgpd_worker_config set ativo=true');
    await db.exec(sql); // Reaplicar não desativa a configuração do operador.
    await conta(a);
    await assert.rejects(q('select privacidade_solicitar_exclusao($1)', [a]), /indisponível/);
    await db.exec('reset role;set role service_role');
    assert.equal((await q('select * from lgpd_exclusao_reivindicar()')).length, 0); // Primeiro heartbeat.
    await conta(a);
    const data = (await q('select privacidade_solicitar_exclusao($1) as data', [a]))[0].data;
    assert.equal(new Date((await q('select solicitar_exclusao_conta() as data'))[0].data).getTime(), new Date(data).getTime());
    const estado = (await q('select privacidade_estado($1) as r', [a]))[0].r;
    assert.equal(estado.pode_cancelar, true);
    const pedido = estado.pedido_id;
    await db.exec('reset role;set role service_role');
    assert.equal((await q('select * from lgpd_exclusao_reivindicar()')).length, 0);
    await db.exec(`reset role;update lgpd_exclusoes set executar_em=now()-interval '1 minute';set role service_role`);
    const reserva = (await q('select * from lgpd_exclusao_reivindicar()'))[0];
    assert.equal(reserva.user_id, a);
    assert.equal((await q('select * from lgpd_exclusao_reivindicar()')).length, 0);
    await conta(a);
    await assert.rejects(q('select privacidade_cancelar_exclusao($1,$2)', [a, pedido]), /não pode/);
    await assert.rejects(q('insert into storage.objects(bucket_id,name) values($1,$2)', ['pets', `${a}/novo.jpg`]), /em exclusão/);
    await db.exec('reset role');
    await assert.rejects(q('update storage.objects set name=$1', [`${b}/movida.jpg`]), /em exclusão/);
    await db.exec('set role service_role');
    await assert.rejects(q('select lgpd_exclusao_concluir($1,$2)', [pedido, reserva.lease]), /contém arquivos/);
    await db.exec(`reset role;update lgpd_exclusoes set lease_ate=now()-interval '1 minute';set role service_role`);
    await assert.rejects(q('select lgpd_exclusao_renovar($1,$2)', [pedido, reserva.lease]), /expirada/);
    const nova = (await q('select * from lgpd_exclusao_reivindicar()'))[0];
    assert.notEqual(nova.lease, reserva.lease);
    await assert.rejects(q('select lgpd_exclusao_concluir($1,$2)', [pedido, reserva.lease]), /expirada/);
    await q('select lgpd_exclusao_renovar($1,$2)', [pedido, nova.lease]);
    await db.exec('reset role;delete from storage.objects;set role service_role');
    await q('select lgpd_exclusao_concluir($1,$2)', [pedido, nova.lease]);
    await db.exec('reset role');
    assert.deepEqual((await q('select id from auth.users')).map(r => r.id), [b]);
    assert.equal((await q('select count(*)::int as n from profiles'))[0].n, 1);
    assert.equal((await q('select status from lgpd_exclusoes'))[0].status, 'concluida');
    assert.equal((await q('select user_id from lgpd_exclusoes'))[0].user_id, null);
    await assert.rejects(q('insert into storage.objects values(gen_random_uuid(),$1,$2)', ['pets', `${a}/upload-assinado-atrasado.jpg`]), /em exclusão/);
    await conta(b);
    await q('select privacidade_solicitar_exclusao($1)', [b]);
    const outro = (await q('select privacidade_estado($1) as r', [b]))[0].r.pedido_id;
    await q('select privacidade_cancelar_exclusao($1,$2)', [b, outro]);
    await q('select privacidade_cancelar_exclusao($1,$2)', [b, outro]);
    await q('insert into storage.objects(bucket_id,name) values($1,$2)', ['pets', `${b}/permitido.jpg`]);
    await db.exec('reset role;set role anon');
    await assert.rejects(q('select privacidade_estado($1)', [b]), /permission denied/);
    await assert.rejects(q('select lgpd_worker_disparar()'), /permission denied/);
    await db.exec(`reset role;create schema cron;create schema vault;create schema net;
      create table cron.job(jobid bigint,jobname text,active boolean);
      create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values(1,$1,true);return 1;end$$;
      create function cron.alter_job(p_job bigint,active boolean) returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      insert into vault.decrypted_secrets values('project_url','https://fixture.supabase.co'),('service_role_key','chave-ficticia-do-teste-sem-valor');
      create table net.chamadas(url text,body jsonb,headers jsonb);
      create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 1000)
       returns bigint language plpgsql as $$begin insert into net.chamadas values($1,$2,$4);return 1;end$$;
      update lgpd_worker_config set ativo=false;set role service_role;`);
    assert.equal((await q('select lgpd_worker_agendar() as id'))[0].id, 1);
    await q('select lgpd_worker_disparar()');
    await db.exec('reset role');
    assert.equal((await q('select active from cron.job'))[0].active, false);
    assert.equal((await q('select count(*)::int as n from net.chamadas'))[0].n, 0);
    await db.exec('update lgpd_worker_config set ativo=true;set role service_role');
    await q('select lgpd_worker_disparar()');
    await db.exec('reset role');
    assert.equal((await q('select url from net.chamadas'))[0].url, 'https://fixture.supabase.co/functions/v1/lgpd-delete');
    await db.exec(`update vault.decrypted_secrets set decrypted_secret='https://outro-destino.invalid' where name='project_url';set role service_role`);
    await assert.rejects(q('select lgpd_worker_disparar()'), /indisponível/);
    console.log(`OK LGPD ${legado ? 'legado' : 'app'}: flag, conta, prazo, idempotência, lease/retry, uploads, conclusão e cancelamento.`);
  } finally { await db.close(); }
}

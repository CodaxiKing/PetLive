import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const a='51000000-0000-4000-8000-000000000001', b='51000000-0000-4000-8000-000000000002';
for (const legado of [true, false]) {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon;
      create table lgpd_requests(id uuid primary key default gen_random_uuid(),user_id uuid,tipo text check(tipo in ('exportar','${legado?'excluir':'apagar'}')),
      status text default '${legado?'pendente':'novo'}' check(status in ('${legado?'pendente':'novo'}','concluido','cancelado','em_andamento')),
      criado_em timestamptz default now(),executar_em timestamptz,done_at timestamptz);
      grant all on lgpd_requests to authenticated,anon;
      insert into lgpd_requests(user_id,tipo) values('${a}','${legado?'excluir':'apagar'}'),('${b}','${legado?'excluir':'apagar'}');`);
    const sql=await readFile(new URL('../migrations/20261215000000_privacidade_compatibilidade.sql',import.meta.url),'utf8');
    await db.exec(sql);await db.exec(sql);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false)`);
    const r=(await db.query('select privacidade_estado($1) as r',[a])).rows[0].r;
    assert.equal(r.pode_solicitar,false);assert.equal(r.pode_cancelar,true);assert.equal(r.executar_em,null);
    await assert.rejects(db.query('select privacidade_estado($1)',[b]),/conta mudou/);
    await assert.rejects(db.query('select * from lgpd_requests'),/permission denied/);
    await db.query('select privacidade_registrar_exportacao($1)',[a]);
    await assert.rejects(db.query('select privacidade_registrar_exportacao($1)',[b]),/conta mudou/);
    await db.query('select privacidade_cancelar_exclusao($1,$2)',[a,r.pedido_id]);
    await db.query('select privacidade_cancelar_exclusao($1,$2)',[a,r.pedido_id]);
    assert.equal((await db.query('select privacidade_estado($1) as r',[a])).rows[0].r.pedido_id,null);
    await db.exec(`reset role;update lgpd_requests set status='em_andamento' where user_id='${b}';set role authenticated;select set_config('request.jwt.claim.sub','${b}',false)`);
    const rb=(await db.query('select privacidade_estado($1) as r',[b])).rows[0].r;
    assert.equal(rb.pode_cancelar,false);
    await assert.rejects(db.query('select privacidade_cancelar_exclusao($1,$2)',[b,rb.pedido_id]),/não pode/);
    await assert.rejects(db.query('select privacidade_cancelar_exclusao($1,$2)',[b,r.pedido_id]),/indisponível/);
    await db.exec('reset role;set role anon');
    await assert.rejects(db.query('select privacidade_estado($1)',[a]),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int as n from lgpd_requests where tipo='exportar' and status='concluido'")).rows[0].n,1);
    console.log(`OK schema ${legado?'produção legado':'app'}: isolamento, log, cancelamento idempotente, processamento bloqueado, sem exclusão ativada e reaplicação.`);
  } finally { await db.close(); }
}

// PostgreSQL em memória e HTTP falso. Não conecta ao Supabase ou ao Expo.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
assert(process.env.PGLITE_MODULE, 'Defina PGLITE_MODULE para dist/index.js do PGlite.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const a = '42000000-0000-4000-8000-000000000001', b = '42000000-0000-4000-8000-000000000002';
const agora = new Date(), dia = agora.toISOString().slice(0, 10);
// Horários UTC determinísticos, regiões válidas durante toda a bateria.
const hora = (hh) => `${dia}T${hh}:00:00Z`;
const entrar = async (uid, role = 'authenticated') => {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
};
const configurar = (uid, ativo = true, raio = 5, lat = -22.75, lng = -43.45) => db.query(
  'select public.eventos_regiao_configurar($1,$2,$3,$4,$5) as r', [uid, ativo, raio, lat, lng]);
const job = async (hh = '15') => {
  await db.exec('reset role');
  return (await db.query('select public.eventos_avisar_proximos($1) as n', [hora(hh)])).rows[0].n;
};
try {
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users on delete cascade,notificacoes_ativas boolean default true,fuso_horario text default 'UTC');
    create table public.notification_prefs(tutor_id uuid,tipo text,ativo boolean,nao_perturbe_inicio time,nao_perturbe_fim time,unique(tutor_id,tipo));
    create table public.notification_settings(tutor_id uuid primary key,horario_avisos time);
    create table public.places(id text primary key,lat double precision,lng double precision);
    create table public.pets(id uuid primary key,tutor_id uuid references auth.users);
    create table public.events(id uuid primary key default gen_random_uuid(),titulo text,status text,inicio_em timestamptz,lat double precision,lng double precision,place_id text,criado_por uuid,atualizado_em timestamptz default now());
    create table public.notification_log(user_id uuid,type text,title text,body text,deep_link text,sent_at timestamptz);
    create table public.push_tokens(tutor_id uuid,token text,ativo boolean);
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{"anterior":true}'::jsonb$$;
    insert into auth.users values('${a}'),('${b}');
    insert into profiles(id) values('${a}'),('${b}');
  `);
  // A nova exportação deve preservar também os passeios da entrega anterior.
  await db.exec(await readFile(new URL('../migrations/20261203000000_passeios_tutor.sql', import.meta.url), 'utf8'));
  const migration = await readFile(new URL('../migrations/20261204000000_eventos_por_regiao.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  await entrar(a);
  assert.equal((await db.query('select public.eventos_regiao_consultar($1) as r', [a])).rows[0].r.ativo, false);
  await assert.rejects(configurar(b), /nesta conta/);
  await assert.rejects(configurar(a, true, 3), /raio/);
  await assert.rejects(configurar(a, true, 5, 100), /Região inválida/);
  await assert.rejects(configurar(a, true, 5, null, null), /Atualize/);
  await configurar(a, true, 5, -22.753456, -43.451234);
  const regiao = (await db.query('select * from public.eventos_regioes')).rows[0];
  assert.equal(Number(regiao.lat), -22.75); assert.equal(Number(regiao.lng), -43.45);
  await configurar(a, true, 10, null, null);
  const novo = (await db.query('select * from public.eventos_regioes')).rows[0];
  assert.equal(novo.expira_em.getTime(), regiao.expira_em.getTime(), 'trocar raio não renova região antiga');
  await configurar(a, true, 2, null, null);
  await assert.rejects(db.exec('update public.eventos_regioes set raio_km=50'), /permission denied/);
  await assert.rejects(db.exec('select public.eventos_avisar_proximos()'), /permission denied/);
  await entrar(b);
  assert.equal((await db.query('select * from public.eventos_regioes')).rows.length, 0);
  await entrar('', 'anon');
  await assert.rejects(configurar(a), /permission denied/);
  await db.exec('reset role');
  await db.exec(`insert into places values('clinica',-22.75,-43.45);
    insert into events(titulo,status,inicio_em,lat,lng,place_id) values
      ('Perto','publicado',now()+interval '2 days',-22.751,-43.45,null),
      ('No lugar','publicado',now()+interval '2 days',null,null,'clinica'),
      ('A sete quilômetros','publicado',now()+interval '2 days',-22.69,-43.45,null),
      ('Longe','publicado',now()+interval '2 days',-20,-43,null),
      ('Recusado','recusado',now()+interval '2 days',-22.75,-43.45,null),
      ('Passado','publicado',now()-interval '2 days',-22.75,-43.45,null),
      ('Futuro distante','publicado',now()+interval '60 days',-22.75,-43.45,null);`);
  assert.equal(await job('08'), 0, 'antes do horário escolhido');
  assert.equal(await job('23'), 0, 'silêncio padrão atravessando meia-noite');
  assert.equal(await job(), 2, 'eventos próprios e lugares com coordenadas');
  assert.equal(await job(), 0, 'repetir job não duplica');
  assert.equal((await db.query('select * from notification_log')).rows.length, 2, 'caixa funciona sem push');
  await entrar(a);
  const exp = (await db.query('select public.exportar_meus_dados() as r')).rows[0].r;
  assert.equal(exp.anterior, true); assert.equal(exp.avisos_eventos_proximos.length, 2);
  assert.deepEqual(exp.passeios_nuvem, []);
  assert.equal(Number(exp.regiao_eventos.lat), -22.75);
  await assert.rejects(db.exec('select public.exportar_meus_dados_sem_regiao_eventos()'), /permission denied/);
  await db.exec('reset role');
  await db.exec(`create schema net;
    create table net.fila(body jsonb);
    create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 5000)
    returns bigint language plpgsql as $$begin insert into net.fila values(body); return 1; end$$;
    insert into push_tokens values('${a}','ExpoPushToken[falso]',true);`);
  await entrar(a); await configurar(a, true, 10, null, null);
  assert.equal(await job(), 1, 'aumentar raio inclui evento a sete quilômetros');
  assert.equal((await db.query('select * from net.fila')).rows.length, 1, 'push somente para token ativo');
  await db.exec(`insert into events(titulo,status,inicio_em,lat,lng) select 'Mais '||i,'publicado',now()+interval '2 days',-22.75,-43.45 from generate_series(1,4) i;`);
  assert.equal(await job(), 0, 'limite total de três avisos por dia');
  await db.exec(`delete from eventos_avisos_proximos; delete from notification_log;
    insert into notification_prefs values('${a}','eventos',false,null,null);`);
  assert.equal(await job(), 0, 'eventos desligados');
  await db.exec(`update notification_prefs set ativo=true,nao_perturbe_inicio='14:00',nao_perturbe_fim='16:00'`);
  assert.equal(await job(), 0, 'silêncio que não atravessa meia-noite');
  await db.exec(`update notification_prefs set nao_perturbe_inicio=null,nao_perturbe_fim=null; update profiles set notificacoes_ativas=false where id='${a}'`);
  assert.equal(await job(), 0, 'preferência global desligada');
  await db.exec(`update profiles set notificacoes_ativas=true,fuso_horario='invalido' where id='${a}';
    insert into notification_settings values('${a}','18:00');`);
  assert.equal(await job(), 0, 'fuso inválido usa Brasília; horário escolhido é respeitado');
  await entrar(a); await configurar(a, false);
  const apagada = (await db.query('select * from eventos_regioes')).rows[0];
  assert.equal(apagada.lat, null); assert.equal(apagada.lng, null); assert.equal(apagada.ativo, false);
  await configurar(a);
  await db.exec('reset role');
  await db.exec(`update eventos_regioes set expira_em=now()-interval '1 day'`);
  await job();
  assert.equal((await db.query('select * from eventos_regioes')).rows[0].lat, null, 'expiração remove coordenadas');
  await db.query('delete from auth.users where id=$1', [a]);
  assert.equal((await db.query('select * from eventos_regioes')).rows.length, 0);
  assert.equal((await db.query('select * from eventos_avisos_proximos')).rows.length, 0);
  console.log('Eventos próximos: RLS, opt-in, raio, horário, silêncio, expiração, deduplicação, limite diário, caixa/push falso, exportação e cascata OK.');
} catch (e) { console.error(e.code ?? '', e.message, e.position ?? '', e.where ?? ''); process.exitCode = 1; }
finally { await db.close(); }

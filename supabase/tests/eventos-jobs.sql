-- Executado após eventos.sql, na mesma transação com rollback.
-- Substitui o transporte HTTP dentro da transação: nenhum push real sai.
create temporary table pushes_eventos (body jsonb not null);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type":"application/json"}'::jsonb,
  timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$
begin
  insert into pg_temp.pushes_eventos(body) values (body);
  return 1;
end;
$$;

create function pg_temp.conferir(p_cond boolean, p_mensagem text)
returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception '%', p_mensagem; end if;
end;
$$;

-- Isola a seleção do job das presenças anteriores, tudo com rollback.
delete from public.event_rsvps;
insert into public.push_tokens(tutor_id, token, plataforma) values
  ('10000000-0000-4000-8000-000000000001', 'token-teste-eventos-1', 'android'),
  ('10000000-0000-4000-8000-000000000001', 'token-teste-eventos-2', 'ios');
insert into public.events(id, titulo, tipo, descricao, inicio_em, fim_em,
  local_nome, lat, lng, status)
select ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'Evento teste job', 'encontro', 'Encontro em parque público',
  now() + antecedencia, now() + antecedencia + interval '1 hour',
  'Parque', -22.9, -43.2, status
from (values
  (1, interval '1 day', 'publicado'),
  (2, interval '2 hours', 'publicado'),
  (3, interval '4 hours', 'publicado'),
  (4, interval '2 hours', 'cancelado'),
  (5, interval '-2 hours', 'publicado'),
  (6, interval '2 hours', 'em_analise')) v(n, antecedencia, status);
insert into public.event_rsvps(event_id, user_id)
select id, '10000000-0000-4000-8000-000000000001'
from public.events where id::text like '30000000-%';
insert into public.notification_prefs(tutor_id, tipo)
values ('10000000-0000-4000-8000-000000000001', 'eventos');
update public.profiles set notificacoes_ativas = true, fuso_horario = 'America/Sao_Paulo'
where id = '10000000-0000-4000-8000-000000000001';

-- Desligar avisos globais ou a categoria impede fila, log e envio.
update public.profiles set notificacoes_ativas = false
where id = '10000000-0000-4000-8000-000000000001';
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from pushes_eventos), 'Avisos globais desligados enviaram push');
update public.profiles set notificacoes_ativas = true
where id = '10000000-0000-4000-8000-000000000001';
update public.notification_prefs set ativo = false where tipo = 'eventos';
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from pushes_eventos), 'Categoria desligada enviou push');
update public.notification_prefs set ativo = true,
  nao_perturbe_inicio = '00:00', nao_perturbe_fim = '24:00' where tipo = 'eventos';
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from pushes_eventos), 'Não perturbe enviou push');
select pg_temp.conferir(not exists(select 1 from public.event_reminder_deliveries
  where event_id::text like '30000000-%'), 'Avisos bloqueados consumiram lembrete');

-- Token inativo não recebe nem consome o lembrete.
update public.notification_prefs set nao_perturbe_inicio = null, nao_perturbe_fim = null where tipo = 'eventos';
update public.push_tokens set ativo = false where token like 'token-teste-eventos-%';
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from pushes_eventos), 'Token inativo recebeu push');
select pg_temp.conferir(not exists(select 1 from public.event_reminder_deliveries
  where event_id::text like '30000000-%'), 'Token inativo consumiu lembrete');
update public.push_tokens set ativo = true where token like 'token-teste-eventos-%';

-- Janela que cruza meia-noite: escolhe um fuso válido em horário de silêncio.
update public.profiles set fuso_horario = (select name from pg_timezone_names
  where (now() at time zone name)::time >= time '22:00'
     or (now() at time zone name)::time < time '06:00' limit 1)
where id = '10000000-0000-4000-8000-000000000001';
update public.notification_prefs set nao_perturbe_inicio = '22:00', nao_perturbe_fim = '06:00' where tipo = 'eventos';
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from pushes_eventos), 'Não perturbe noturno enviou push');

-- Fuso inválido não derruba o job; limites iguais desativam o silêncio.
update public.profiles set fuso_horario = 'fuso-invalido' where id = '10000000-0000-4000-8000-000000000001';
update public.notification_prefs set nao_perturbe_inicio = '12:00', nao_perturbe_fim = '12:00' where tipo = 'eventos';
select public.eventos_enviar_lembretes();
select pg_temp.conferir((select count(*) = 4 from pushes_eventos), 'Esperados 2 lembretes em 2 dispositivos');
select pg_temp.conferir((select count(*) = 2 from public.event_reminder_deliveries
  where event_id::text like '30000000-%'), 'Esperados registros de 1d e 2h');
select pg_temp.conferir((select count(*) = 2 from public.notification_log
  where user_id = '10000000-0000-4000-8000-000000000001' and title = 'Evento chegando'), 'Esperados 2 avisos no histórico');
select pg_temp.conferir(not exists(select 1 from pushes_eventos
  where body #>> '{data,url}' <> '/eventos/' || (body #>> '{data,event_id}')), 'Push abre evento errado');
select public.eventos_enviar_lembretes();
select pg_temp.conferir((select count(*) = 4 from pushes_eventos), 'Reexecução duplicou lembretes');

-- Encerramento idempotente: só publicados vencidos mudam de estado.
select public.eventos_encerrar();
select public.eventos_encerrar();
select pg_temp.conferir((select status = 'encerrado' from public.events
  where id = '30000000-0000-4000-8000-000000000005'), 'Evento vencido não encerrou');
select pg_temp.conferir((select count(*) = 3 from public.events
  where id::text like '30000000-%' and status = 'publicado'), 'Job encerrou evento futuro');
select pg_temp.conferir((select status = 'cancelado' from public.events
  where id = '30000000-0000-4000-8000-000000000004'), 'Job alterou evento cancelado');
select pg_temp.conferir(not has_function_privilege('authenticated', 'public.eventos_enviar_lembretes()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.eventos_encerrar()', 'EXECUTE'), 'Jobs acessíveis pela API');
select pg_temp.conferir((select schedule = '*/15 * * * *' from cron.job
  where jobname = 'petlive-eventos-lembretes'), 'Cron dos lembretes incorreto');
select pg_temp.conferir((select schedule = '0 * * * *' from cron.job
  where jobname = 'petlive-eventos-encerrar'), 'Cron de encerramento incorreto');
select 'OK: jobs, preferências, silêncio, duplicidade, encerramento e cron' as resultado;

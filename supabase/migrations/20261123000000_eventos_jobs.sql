-- Jobs de eventos: lembretes a cada 15 minutos e encerramento a cada hora.
create or replace function public.eventos_enviar_lembretes()
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare l record; v_token text; v_body text;
begin
  for l in
    select r.event_id, r.user_id, e.titulo, janela.intervalo
    from public.event_rsvps r
    join public.events e on e.id = r.event_id
    join public.profiles p on p.id = r.user_id
    left join public.notification_prefs np on np.tutor_id = r.user_id and np.tipo = 'eventos'
    left join pg_catalog.pg_timezone_names tz on tz.name = p.fuso_horario
    cross join (values ('1d', interval '1 day'), ('2h', interval '2 hours')) janela(intervalo, antecedencia)
    where e.status = 'publicado' and e.inicio_em > now()
      and e.inicio_em between now() + janela.antecedencia - interval '10 minutes'
        and now() + janela.antecedencia + interval '10 minutes'
      and p.notificacoes_ativas and np.ativo is distinct from false
      and not coalesce(np.nao_perturbe_inicio is not null and np.nao_perturbe_fim is not null and
        case when np.nao_perturbe_inicio <= np.nao_perturbe_fim then
          (now() at time zone coalesce(tz.name, 'America/Sao_Paulo'))::time >= np.nao_perturbe_inicio
          and (now() at time zone coalesce(tz.name, 'America/Sao_Paulo'))::time < np.nao_perturbe_fim
        else
          (now() at time zone coalesce(tz.name, 'America/Sao_Paulo'))::time >= np.nao_perturbe_inicio
          or (now() at time zone coalesce(tz.name, 'America/Sao_Paulo'))::time < np.nao_perturbe_fim
        end, false)
      and exists(select 1 from public.push_tokens t where t.tutor_id = r.user_id and t.ativo)
      and not exists(select 1 from public.event_reminder_deliveries d
        where d.event_id = r.event_id and d.user_id = r.user_id and d.intervalo = janela.intervalo)
  loop
    -- A chave única garante uma única fila por evento/pessoa/antecedência,
    -- mesmo se duas execuções do job se sobrepuserem.
    insert into public.event_reminder_deliveries(event_id, user_id, intervalo)
      values (l.event_id, l.user_id, l.intervalo) on conflict do nothing;
    if not found then continue; end if;
    v_body := 'Lembrete: ' || l.titulo || ' começa em '
      || case when l.intervalo = '1d' then '1 dia.' else '2 horas.' end;
    insert into public.notification_log(user_id, type, title, body, deep_link)
      values (l.user_id, 'sistema', 'Evento chegando', v_body, '/eventos/' || l.event_id);
    for v_token in select t.token from public.push_tokens t where t.tutor_id = l.user_id and t.ativo loop
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', v_token, 'title', 'Evento chegando',
          'body', v_body, 'sound', 'default',
          'data', jsonb_build_object('tipo', 'evento', 'url', '/eventos/' || l.event_id, 'event_id', l.event_id)),
        headers := jsonb_build_object('Content-Type', 'application/json'));
    end loop;
  end loop;
end;
$$;

create or replace function public.eventos_encerrar()
returns void language sql security definer set search_path = public
as $$
  update public.events set status = 'encerrado', atualizado_em = now()
  where status = 'publicado' and fim_em <= now()
$$;

-- Somente o dono do banco/cron pode executar os jobs, nunca clientes da API.
revoke all on function public.eventos_enviar_lembretes() from public, anon, authenticated, service_role;
revoke all on function public.eventos_encerrar() from public, anon, authenticated, service_role;

do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('petlive-eventos-lembretes', '*/15 * * * *', 'select public.eventos_enviar_lembretes();');
    perform cron.schedule('petlive-eventos-encerrar', '0 * * * *', 'select public.eventos_encerrar();');
  end if;
end;
$$;

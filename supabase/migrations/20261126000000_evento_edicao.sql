create or replace function public.evento_atualizar(p_event_id uuid, p_evento jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_event events; v_inicio timestamptz; v_fim timestamptz; v_local text; v_mudou boolean; v_reagendou boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para editar um evento.'; end if;
  if p_evento is null or jsonb_typeof(p_evento) <> 'object' then raise exception 'Informe os dados do evento.'; end if;
  select * into v_event from events where id = p_event_id and criado_por = auth.uid() for update;
  if not found or v_event.status not in ('em_analise','publicado','ajuste_solicitado') then raise exception 'Este evento não pode mais ser editado.'; end if;
  v_inicio := coalesce((p_evento ->> 'inicio_em')::timestamptz, v_event.inicio_em);
  v_fim := coalesce((p_evento ->> 'fim_em')::timestamptz, v_event.fim_em);
  v_local := coalesce(nullif(trim(p_evento ->> 'local_nome'), ''), v_event.local_nome);
  if v_inicio <= now() or v_fim <= v_inicio or v_fim > v_inicio + interval '7 days' then raise exception 'Revise o horário do evento.'; end if;
  if char_length(v_local) not between 2 and 160 or char_length(coalesce(p_evento ->> 'titulo', v_event.titulo)) not between 3 and 100 or
    char_length(coalesce(p_evento ->> 'descricao', v_event.descricao)) not between 10 and 3000 then raise exception 'Revise título, descrição e nome do local.'; end if;
  if coalesce(p_evento ->> 'tipo', v_event.tipo) not in ('adocao','vacinacao','passeio','encontro','palestra','outro') then raise exception 'Tipo de evento inválido.'; end if;
  if coalesce(p_evento ->> 'gratuito', v_event.gratuito::text)::boolean then
    if (p_evento ? 'ingresso_url' and nullif(p_evento ->> 'ingresso_url','') is not null) or
      (p_evento ? 'preco_centavos' and nullif(p_evento ->> 'preco_centavos','') is not null) then raise exception 'Evento gratuito não deve ter link ou preço de ingresso.'; end if;
  elsif coalesce((p_evento ->> 'preco_centavos')::integer, v_event.preco_centavos, 0) <= 0 or
    coalesce(nullif(p_evento ->> 'ingresso_url',''), v_event.ingresso_url, '') !~ '^https://[^[:space:]]+$' then
    raise exception 'Eventos pagos precisam de preço e link HTTPS.';
  end if;
  if p_evento ? 'lat' and nullif(p_evento ->> 'lat','') is not null and ((p_evento ->> 'lat')::double precision not between -90 and 90 or (p_evento ->> 'lng')::double precision not between -180 and 180) then raise exception 'Coordenadas inválidas.'; end if;
  if p_evento ? 'vagas' and nullif(p_evento ->> 'vagas','') is not null and (p_evento ->> 'vagas')::integer not between 1 and 100000 then raise exception 'Número de vagas inválido.'; end if;
  if p_evento ? 'vagas' and p_evento ->> 'vagas' is not null and
    (p_evento ->> 'vagas')::integer < (select count(*) from event_rsvps where event_id = p_event_id) then
    raise exception 'O limite de vagas não pode ser menor que as presenças já confirmadas.';
  end if;
  v_reagendou := v_inicio is distinct from v_event.inicio_em or v_fim is distinct from v_event.fim_em;
  v_mudou := v_reagendou or v_local is distinct from v_event.local_nome
    or (p_evento ? 'place_id' and nullif(trim(p_evento ->> 'place_id'), '') is distinct from v_event.place_id)
    or (p_evento ? 'lat' and (p_evento ->> 'lat')::double precision is distinct from v_event.lat)
    or (p_evento ? 'lng' and (p_evento ->> 'lng')::double precision is distinct from v_event.lng);
  update events set
    titulo = coalesce(nullif(trim(p_evento ->> 'titulo'), ''), titulo),
    tipo = coalesce(p_evento ->> 'tipo', tipo),
    descricao = coalesce(nullif(trim(p_evento ->> 'descricao'), ''), descricao),
    inicio_em = v_inicio, fim_em = v_fim, local_nome = v_local,
    place_id = case when p_evento ? 'place_id' then nullif(trim(p_evento ->> 'place_id'), '') else place_id end,
    lat = case when p_evento ? 'lat' then (p_evento ->> 'lat')::double precision else lat end,
    lng = case when p_evento ? 'lng' then (p_evento ->> 'lng')::double precision else lng end,
    gratuito = coalesce((p_evento ->> 'gratuito')::boolean, gratuito),
    preco_centavos = case when coalesce((p_evento ->> 'gratuito')::boolean, gratuito) then null when p_evento ? 'preco_centavos' then (p_evento ->> 'preco_centavos')::integer else preco_centavos end,
    ingresso_url = case when coalesce((p_evento ->> 'gratuito')::boolean, gratuito) then null when p_evento ? 'ingresso_url' then nullif(trim(p_evento ->> 'ingresso_url'), '') else ingresso_url end,
    vagas = case when p_evento ? 'vagas' then (p_evento ->> 'vagas')::integer else vagas end,
    status = case when v_mudou or v_event.status = 'ajuste_solicitado' then 'em_analise' else status end,
    motivo_status = case when v_mudou or v_event.status = 'ajuste_solicitado' then null else motivo_status end,
    atualizado_em = now()
  where id = p_event_id;
  if v_reagendou then
    delete from event_reminder_deliveries where event_id = p_event_id;
  end if;
  if v_mudou then
    insert into public.notification_log(user_id, type, title, body, deep_link)
      select user_id, 'sistema', 'Evento atualizado',
        v_event.titulo || ' teve data, horário ou local alterado e voltou para análise.', '/eventos/' || p_event_id
      from public.event_rsvps where event_id = p_event_id;
  end if;
end;
$$;

revoke all on function public.evento_atualizar(uuid,jsonb) from public, anon;
grant execute on function public.evento_atualizar(uuid,jsonb) to authenticated;

create or replace function public.evento_cancelar(p_event_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_event events; v_user uuid; v_token text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para cancelar um evento.'; end if;
  select * into v_event from events where id = p_event_id and criado_por = auth.uid() for update;
  if found and v_event.status = 'cancelado' then return; end if;
  if not found or v_event.status not in ('em_analise','publicado','ajuste_solicitado') then raise exception 'Evento não encontrado ou não pode mais ser cancelado.'; end if;
  update events set status = 'cancelado', atualizado_em = now() where id = p_event_id;
  for v_user in select user_id from event_rsvps where event_id = p_event_id loop
    insert into notification_log(user_id, type, title, body, deep_link)
      values (v_user, 'sistema', 'Evento cancelado', v_event.titulo || ' foi cancelado pelo organizador.', '/eventos/' || p_event_id);
    for v_token in select token from push_tokens where tutor_id = v_user and ativo loop
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', v_token, 'title', 'Evento cancelado', 'body', v_event.titulo || ' foi cancelado pelo organizador.',
          'sound', 'default', 'data', jsonb_build_object('tipo', 'evento', 'url', '/eventos/' || p_event_id, 'event_id', p_event_id)),
        headers := jsonb_build_object('Content-Type', 'application/json'));
    end loop;
  end loop;
end;
$$;

revoke all on function public.evento_cancelar(uuid) from public, anon;
grant execute on function public.evento_cancelar(uuid) to authenticated;

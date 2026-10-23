-- PetLive: base segura para eventos pet (BUSINESS.md §5.16).
-- Itens do board: tabelas events, event_rsvps, event_reports e organizers com RLS.

create table public.organizers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_publico text not null check (char_length(trim(nome_publico)) between 2 and 100),
  verificado boolean not null default false,
  verificado_em timestamptz,
  verificado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint organizers_verificacao_consistente check (
    (verificado and verificado_em is not null) or (not verificado and verificado_em is null)
  )
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizador_id uuid references auth.users(id) on delete set null,
  oficial boolean not null default false,
  titulo text not null check (char_length(trim(titulo)) between 3 and 100),
  tipo text not null check (tipo in ('adocao','vacinacao','passeio','encontro','palestra','outro')),
  descricao text not null check (char_length(trim(descricao)) between 10 and 3000),
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  local_nome text not null check (char_length(trim(local_nome)) between 2 and 160),
  place_id text,
  lat double precision,
  lng double precision,
  foto_url text,
  gratuito boolean not null default true,
  preco_centavos integer,
  ingresso_url text,
  vagas integer check (vagas is null or vagas between 1 and 100000),
  status text not null default 'em_analise'
    check (status in ('em_analise','publicado','ajuste_solicitado','recusado','cancelado','encerrado','oculto')),
  motivo_status text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint events_horario_valido check (fim_em > inicio_em),
  constraint events_local_valido check (
    (place_id is not null and lat is null and lng is null) or
    (place_id is null and lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180)
  ),
  constraint events_preco_valido check (
    (gratuito and preco_centavos is null) or
    (not gratuito and preco_centavos is not null and preco_centavos > 0 and ingresso_url is not null)
  )
);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  motivo text not null check (motivo in ('spam','inadequado','fraude','local_privado','informacao_falsa','outro')),
  detalhe text check (detalhe is null or char_length(detalhe) <= 500),
  criado_em timestamptz not null default now(),
  unique (event_id, user_id)
);

create index events_status_inicio_idx on public.events (status, inicio_em);
create index events_organizador_idx on public.events (organizador_id, criado_em desc);
create index events_geo_idx on public.events (lat, lng) where status = 'publicado';
create index event_rsvps_user_idx on public.event_rsvps (user_id, criado_em desc);
create index event_reports_event_idx on public.event_reports (event_id, criado_em);

create table public.event_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  acao text not null check (acao in ('publicado','ajuste_solicitado','recusado','revisado','oculto')),
  motivo text,
  criado_em timestamptz not null default now()
);
alter table public.event_moderation_actions enable row level security;
revoke all on public.event_moderation_actions from anon, authenticated;

alter table public.notification_prefs drop constraint if exists notification_prefs_tipo_check;
alter table public.notification_prefs add constraint notification_prefs_tipo_check
  check (tipo in ('vacina', 'vermifugo', 'consulta', 'banho_tosa', 'remedio', 'outro', 'eventos'));

create table public.event_reminder_deliveries (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  intervalo text not null check (intervalo in ('1d','2h')),
  enviado_em timestamptz not null default now(),
  primary key(event_id, user_id, intervalo)
);
alter table public.event_reminder_deliveries enable row level security;
revoke all on public.event_reminder_deliveries from anon, authenticated;

-- Eventos passam a ser uma categoria configurável na tela de avisos.
alter table public.organizers enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_reports enable row level security;

-- Organizador só vê seu próprio perfil; verificação é exclusiva do backend/admin.
create policy "organizers: leitura do próprio perfil" on public.organizers
  for select to authenticated using (user_id = auth.uid());
-- Eventos publicados são públicos; criadores veem também a fila e o histórico próprios.
create policy "events: publicados ou próprios" on public.events
  for select using (status = 'publicado' or criado_por = auth.uid());
-- Lista de presença nunca é exposta; cada usuário só lê sua confirmação.
create policy "event_rsvps: próprio" on public.event_rsvps
  for select to authenticated using (user_id = auth.uid());
-- Denúncias são privadas para quem denunciou e para a equipe via service role.
create policy "event_reports: própria" on public.event_reports
  for select to authenticated using (user_id = auth.uid());

revoke all on public.organizers, public.events, public.event_rsvps, public.event_reports from anon, authenticated;
grant select on public.organizers, public.events, public.event_rsvps, public.event_reports to authenticated;
grant select on public.events to anon;

create or replace function public.eventos_por_perto(
  p_lat double precision,
  p_lng double precision,
  p_raio_km double precision default 50,
  p_inicio timestamptz default now(),
  p_fim timestamptz default now() + interval '30 days',
  p_tipo text default null,
  p_periodo text default 'mes',
  p_limite integer default 100
)
returns table (
  id uuid, titulo text, tipo text, descricao text, inicio_em timestamptz,
  fim_em timestamptz, local_nome text, place_id text, lat double precision,
  lng double precision, foto_url text, gratuito boolean, preco_centavos integer,
  ingresso_url text, vagas integer, confirmados bigint, distancia_km double precision
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180 then
    raise exception 'Coordenadas inválidas.';
  end if;
  if p_raio_km is null or p_raio_km <= 0 or p_raio_km > 500 then raise exception 'Raio de busca inválido.'; end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio or p_fim > now() + interval '180 days' then raise exception 'Período de busca inválido.'; end if;
  if p_tipo is not null and p_tipo not in ('adocao','vacinacao','passeio','encontro','palestra','outro') then raise exception 'Tipo de evento inválido.'; end if;
  if p_periodo not in ('hoje','semana','mes') then raise exception 'Período de eventos inválido.'; end if;
  return query
  select e.id, e.titulo, e.tipo, e.descricao, e.inicio_em, e.fim_em,
    e.local_nome, e.place_id, e.lat, e.lng, e.foto_url, e.gratuito,
    e.preco_centavos, e.ingresso_url, e.vagas,
    (select count(*) from event_rsvps r where r.event_id = e.id),
    case when e.lat is null then null else (6371 * 2 * asin(sqrt(
      power(sin(radians(e.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(e.lat)) *
      power(sin(radians(e.lng - p_lng) / 2), 2)
    ))) end
  from events e
  where e.status = 'publicado' and e.fim_em > now()
    and e.inicio_em >= p_inicio and e.inicio_em <= p_fim
    and (p_periodo <> 'hoje' or (e.inicio_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date)
    and (p_periodo <> 'semana' or e.inicio_em <= now() + interval '7 days')
    and (p_tipo is null or e.tipo = p_tipo)
    -- Eventos com Google Place ID não persistem coordenadas (BUSINESS.md §5.16).
    -- Até haver uma resolução de Place Details no cliente, só pontos próprios
    -- podem ser filtrados com precisão pelo raio do mapa.
    and e.lat is not null
    and e.lat between p_lat - p_raio_km / 110.0 and p_lat + p_raio_km / 110.0
    and e.lng between p_lng - p_raio_km / 80.0 and p_lng + p_raio_km / 80.0
    and 6371 * 2 * asin(sqrt(
      power(sin(radians(e.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(e.lat)) *
      power(sin(radians(e.lng - p_lng) / 2), 2)
    )) <= p_raio_km
  order by e.inicio_em asc
  limit greatest(1, least(coalesce(p_limite, 100), 200));
end;
$$;

create or replace function public.evento_criar(
  p_titulo text, p_tipo text, p_descricao text,
  p_inicio_em timestamptz, p_fim_em timestamptz, p_local_nome text,
  p_place_id text default null, p_lat double precision default null,
  p_lng double precision default null, p_foto_url text default null,
  p_gratuito boolean default true, p_preco_centavos integer default null,
  p_ingresso_url text default null, p_vagas integer default null,
  p_oficial boolean default false
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_verificado boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para criar um evento.'; end if;
  if p_titulo is null or char_length(trim(p_titulo)) not between 3 and 100 or
    p_descricao is null or char_length(trim(p_descricao)) not between 10 and 3000 or
    p_local_nome is null or char_length(trim(p_local_nome)) not between 2 and 160 then
    raise exception 'Revise o título, a descrição e o nome do local.';
  end if;
  if p_inicio_em is null or p_fim_em is null or p_inicio_em <= now() or p_fim_em <= p_inicio_em or p_fim_em > p_inicio_em + interval '7 days' then raise exception 'Informe datas futuras e um evento com duração de até 7 dias.'; end if;
  if p_tipo not in ('adocao','vacinacao','passeio','encontro','palestra','outro') then raise exception 'Tipo de evento inválido.'; end if;
  if p_place_id is null and (p_lat is null or p_lng is null) then raise exception 'Informe um local do mapa ou um lugar do Google.'; end if;
  if p_place_id is not null and (p_lat is not null or p_lng is not null) then raise exception 'Para lugares do Google, envie apenas o place_id.'; end if;
  if p_foto_url is not null and p_foto_url !~ '^https://[^[:space:]]+$' then raise exception 'A foto do evento precisa usar um endereço HTTPS válido.'; end if;
  if p_gratuito and (p_preco_centavos is not null or p_ingresso_url is not null) then raise exception 'Eventos gratuitos não devem ter preço ou link de ingresso.'; end if;
  if not p_gratuito and (coalesce(p_preco_centavos, 0) <= 0 or coalesce(p_ingresso_url, '') !~ '^https://[^[:space:]]+$') then raise exception 'Eventos pagos precisam de preço e link externo HTTPS.'; end if;
  if p_place_id is not null and char_length(trim(p_place_id)) not between 1 and 255 then raise exception 'Google Place ID inválido.'; end if;
  if p_vagas is not null and p_vagas not between 1 and 100000 then raise exception 'O número de vagas precisa estar entre 1 e 100.000.'; end if;
  if p_oficial then perform public.admin_exigir(array['moderacao']); end if;
  -- Serializa criações da mesma pessoa: duas requisições simultâneas não
  -- podem ler a mesma contagem e ultrapassar o limite mensal.
  perform 1 from profiles where id = auth.uid() for update;
  if not found then raise exception 'Perfil do organizador não encontrado.'; end if;
  select exists(select 1 from organizers where user_id = auth.uid() and verificado)
    into v_verificado;
  if not p_oficial and (select count(*) from events e where e.criado_por = auth.uid()
      and e.criado_em >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')) >= 3 then
    raise exception 'Você atingiu o limite de 3 eventos neste mês.';
  end if;
  insert into events (
    organizador_id, criado_por, oficial, titulo, tipo, descricao, inicio_em, fim_em,
    local_nome, place_id, lat, lng, foto_url, gratuito, preco_centavos,
    ingresso_url, vagas, status
  ) values (
    auth.uid(), auth.uid(), p_oficial, trim(p_titulo), p_tipo, trim(p_descricao), p_inicio_em,
    p_fim_em, trim(p_local_nome), nullif(trim(p_place_id), ''), p_lat, p_lng,
    p_foto_url, p_gratuito, p_preco_centavos, p_ingresso_url, p_vagas,
    case when p_oficial or v_verificado then 'publicado' else 'em_analise' end
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.evento_confirmar_presenca(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_event events; v_ja_existe boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para confirmar presença.'; end if;
  select * into v_event from events e where e.id = p_event_id and e.status = 'publicado' for update;
  if not found or v_event.fim_em <= now() then raise exception 'Este evento não está aceitando confirmações.'; end if;
  select exists(select 1 from event_rsvps r where r.event_id = p_event_id and r.user_id = auth.uid()) into v_ja_existe;
  if v_ja_existe then
    delete from event_rsvps where event_id = p_event_id and user_id = auth.uid();
    insert into public.event_reminder_deliveries(event_id, user_id, intervalo)
      values (p_event_id, auth.uid(), '1d'), (p_event_id, auth.uid(), '2h') on conflict do nothing;
    return false;
  end if;
  if v_event.vagas is not null and (select count(*) from event_rsvps where event_id = p_event_id) >= v_event.vagas then
    raise exception 'As vagas deste evento estão esgotadas.';
  end if;
  insert into event_rsvps(event_id, user_id) values (p_event_id, auth.uid());
  insert into notification_log (user_id, type, title, body, deep_link)
  values (auth.uid(), 'sistema', 'Presença confirmada', 'Você vai a ' || v_event.titulo || '.', '/eventos/' || v_event.id);
  return true;
end;
$$;

create or replace function public.eventos_enviar_lembretes()
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare l record; v_token text; v_intervalo interval;
begin
  for l in
    select r.event_id, r.user_id, e.titulo, e.inicio_em, e.id,
      p.fuso_horario,
      np.nao_perturbe_inicio, np.nao_perturbe_fim,
      case when e.inicio_em between now() + interval '1 hour 50 minutes' and now() + interval '2 hours 10 minutes' then '2h' else '1d' end as intervalo
    from public.event_rsvps r
    join public.events e on e.id = r.event_id and e.status = 'publicado'
    join public.profiles p on p.id = r.user_id
    left join public.notification_prefs np on np.tutor_id = r.user_id and np.tipo = 'eventos'
    where e.inicio_em > now()
      and ((not exists(select 1 from public.event_reminder_deliveries d where d.event_id = e.id and d.user_id = r.user_id and d.intervalo = '1d')
        and e.inicio_em between now() + interval '23 hours 50 minutes' and now() + interval '24 hours 10 minutes'
        or (not exists(select 1 from public.event_reminder_deliveries d where d.event_id = e.id and d.user_id = r.user_id and d.intervalo = '2h')
        and e.inicio_em between now() + interval '1 hour 50 minutes' and now() + interval '2 hours 10 minutes')))
      and (np.ativo is distinct from false)
      and exists(select 1 from public.push_tokens t where t.tutor_id = r.user_id and t.ativo)
  loop
    v_intervalo := case when l.intervalo = '2h' then interval '2 hours' else interval '1 day' end;
    if l.nao_perturbe_inicio is not null and l.nao_perturbe_fim is not null and
      (case when l.nao_perturbe_inicio <= l.nao_perturbe_fim then
        (now() at time zone l.fuso_horario)::time between l.nao_perturbe_inicio and l.nao_perturbe_fim
       else ((now() at time zone l.fuso_horario)::time >= l.nao_perturbe_inicio or
        (now() at time zone l.fuso_horario)::time < l.nao_perturbe_fim) end) then
      continue;
    end if;
    if exists(select 1 from public.event_reminder_deliveries d where d.event_id = l.id and d.user_id = l.user_id and d.intervalo = l.intervalo) then
      continue;
    end if;
    insert into public.event_reminder_deliveries(event_id, user_id, intervalo) values (l.id, l.user_id, l.intervalo)
      on conflict do nothing;
    if not found then continue; end if;
    insert into public.notification_log(user_id, type, title, body, deep_link)
      values (l.user_id, 'sistema', 'Evento chegando', 'Lembrete: ' || l.titulo || ' começa em ' || case when v_intervalo = interval '1 day' then '1 dia.' else '2 horas.' end, '/eventos/' || l.id);
    for v_token in select t.token from public.push_tokens t where t.tutor_id = l.user_id and t.ativo loop
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', v_token, 'title', 'Evento chegando',
          'body', 'Lembrete: ' || l.titulo || ' começa em ' || case when v_intervalo = interval '1 day' then '1 dia.' else '2 horas.' end,
          'sound', 'default', 'data', jsonb_build_object('tipo', 'evento', 'url', '/eventos/meus', 'event_id', l.id)),
        headers := jsonb_build_object('Content-Type', 'application/json'));
    end loop;
  end loop;
end;
$$;

revoke all on function public.eventos_enviar_lembretes() from public, anon, authenticated, service_role;
do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('petlive-eventos-lembretes', '*/10 * * * *', 'select public.eventos_enviar_lembretes();');
  end if;
end;
$$;

create or replace function public.evento_denunciar(p_event_id uuid, p_motivo text, p_detalhe text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_total integer;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para denunciar.'; end if;
  if p_motivo not in ('spam','inadequado','fraude','local_privado','informacao_falsa','outro') or coalesce(char_length(p_detalhe), 0) > 500 then raise exception 'Informe um motivo de denúncia válido.'; end if;
  if not exists(select 1 from events where id = p_event_id and status = 'publicado') then
    raise exception 'Evento não encontrado ou já encerrado.';
  end if;
  insert into event_reports(event_id, user_id, motivo, detalhe)
    values (p_event_id, auth.uid(), p_motivo, nullif(trim(p_detalhe), ''))
  on conflict(event_id, user_id) do nothing;
  select count(*) into v_total from event_reports where event_id = p_event_id;
  if v_total >= 3 then update events set status = 'oculto', atualizado_em = now() where id = p_event_id and status = 'publicado'; end if;
end;
$$;

create or replace function public.evento_cancelar(p_event_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_event events; v_user uuid; v_token text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para cancelar um evento.'; end if;
  select * into v_event from events where id = p_event_id and criado_por = auth.uid() for update;
  if not found or v_event.status not in ('em_analise','publicado','ajuste_solicitado') then raise exception 'Evento não encontrado ou não pode mais ser cancelado.'; end if;
  update events set status = 'cancelado', atualizado_em = now() where id = p_event_id;
  for v_user in select user_id from event_rsvps where event_id = p_event_id loop
    insert into notification_log(user_id, type, title, body, deep_link)
      values (v_user, 'sistema', 'Evento cancelado', v_event.titulo || ' foi cancelado pelo organizador.', '/eventos/meus');
    for v_token in select token from push_tokens where tutor_id = v_user and ativo loop
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object('to', v_token, 'title', 'Evento cancelado', 'body', v_event.titulo || ' foi cancelado pelo organizador.',
          'sound', 'default', 'data', jsonb_build_object('tipo', 'evento', 'url', '/eventos/meus', 'event_id', p_event_id)),
        headers := jsonb_build_object('Content-Type', 'application/json'));
    end loop;
  end loop;
end;
$$;

create or replace function public.eventos_encerrar()
returns void language sql security definer set search_path = public
as $$
  update events set status = 'encerrado', atualizado_em = now()
  where status = 'publicado' and fim_em <= now()
$$;
revoke all on function public.eventos_encerrar() from public, anon, authenticated, service_role;
do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('petlive-eventos-encerrar', '*/15 * * * *', 'select public.eventos_encerrar();');
  end if;
end;
$$;

create or replace function public.meus_eventos()
returns table (
  id uuid, titulo text, tipo text, inicio_em timestamptz, fim_em timestamptz,
  local_nome text, status text, motivo_status text, confirmados bigint
)
language sql stable security definer set search_path = public
as $$
  select e.id, e.titulo, e.tipo, e.inicio_em, e.fim_em, e.local_nome,
    e.status, e.motivo_status, (select count(*) from event_rsvps r where r.event_id = e.id)
  from events e where e.criado_por = auth.uid()
  order by e.criado_em desc
$$;

create or replace function public.meu_evento_detalhe(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo, 'descricao', e.descricao,
    'inicio_em', e.inicio_em, 'fim_em', e.fim_em, 'local_nome', e.local_nome,
    'place_id', e.place_id, 'lat', e.lat, 'lng', e.lng, 'gratuito', e.gratuito,
    'preco_centavos', e.preco_centavos, 'ingresso_url', e.ingresso_url, 'vagas', e.vagas,
    'status', e.status, 'motivo_status', e.motivo_status
  ) from events e where e.id = p_event_id and e.criado_por = auth.uid()
$$;

create or replace function public.evento_atualizar(p_event_id uuid, p_evento jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_event events; v_inicio timestamptz; v_fim timestamptz; v_local text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para editar um evento.'; end if;
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
  update events set
    titulo = coalesce(nullif(trim(p_evento ->> 'titulo'), ''), titulo),
    tipo = coalesce(p_evento ->> 'tipo', tipo),
    descricao = coalesce(nullif(trim(p_evento ->> 'descricao'), ''), descricao),
    inicio_em = v_inicio, fim_em = v_fim, local_nome = v_local,
    place_id = case when p_evento ? 'place_id' then nullif(trim(p_evento ->> 'place_id'), '') else place_id end,
    lat = case when p_evento ? 'lat' then (p_evento ->> 'lat')::double precision else lat end,
    lng = case when p_evento ? 'lng' then (p_evento ->> 'lng')::double precision else lng end,
    gratuito = coalesce((p_evento ->> 'gratuito')::boolean, gratuito),
    preco_centavos = case when p_evento ? 'preco_centavos' then (p_evento ->> 'preco_centavos')::integer else preco_centavos end,
    ingresso_url = case when p_evento ? 'ingresso_url' then nullif(trim(p_evento ->> 'ingresso_url'), '') else ingresso_url end,
    vagas = case when p_evento ? 'vagas' then (p_evento ->> 'vagas')::integer else vagas end,
    status = case when v_inicio is distinct from v_event.inicio_em or v_fim is distinct from v_event.fim_em or v_local is distinct from v_event.local_nome then 'em_analise' else status end,
    atualizado_em = now()
  where id = p_event_id;
  if v_inicio is distinct from v_event.inicio_em or v_fim is distinct from v_event.fim_em or v_local is distinct from v_event.local_nome then
    delete from event_reminder_deliveries where event_id = p_event_id;
  end if;
end;
$$;

create or replace function public.evento_moderar(p_event_id uuid, p_acao text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'Entre na conta administrativa para moderar eventos.'; end if;
  perform public.admin_exigir(array['moderacao']);
  if p_acao not in ('publicado','ajuste_solicitado','recusado','revisado','oculto') then raise exception 'Ação de moderação inválida.'; end if;
  select status into v_status from events where id = p_event_id for update;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if (p_acao = 'revisado' and v_status <> 'oculto') or
    (p_acao = 'publicado' and v_status not in ('em_analise','ajuste_solicitado')) or
    (p_acao = 'ajuste_solicitado' and v_status not in ('em_analise','publicado')) or
    (p_acao = 'recusado' and v_status not in ('em_analise','ajuste_solicitado')) or
    (p_acao = 'oculto' and v_status <> 'publicado') then
    raise exception 'Esta ação não é permitida no estado atual do evento.';
  end if;
  if p_acao in ('ajuste_solicitado','recusado','oculto') and nullif(trim(p_motivo), '') is null then raise exception 'Informe o motivo da decisão.'; end if;
  update events set status = case when p_acao = 'revisado' then 'publicado' else p_acao end,
    motivo_status = case when p_acao in ('ajuste_solicitado','recusado','oculto') then nullif(trim(p_motivo), '') else null end,
    atualizado_em = now()
  where id = p_event_id and status in ('em_analise','publicado','ajuste_solicitado','recusado','oculto');
  if not found then raise exception 'Evento não encontrado ou estado não permite moderação.'; end if;
  insert into event_moderation_actions(event_id, admin_id, acao, motivo) values (p_event_id, auth.uid(), p_acao, nullif(trim(p_motivo), ''));
  perform public.admin_registrar('evento_' || p_acao, 'event', p_event_id::text, jsonb_build_object('motivo', nullif(trim(p_motivo), '')));
end;
$$;

create or replace function public.admin_eventos(p_status text default 'em_analise')
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_resultado jsonb;
begin
  perform public.admin_exigir(array['moderacao','leitura']);
  if p_status not in ('em_analise','publicado','ajuste_solicitado','recusado','cancelado','encerrado','oculto') then
    raise exception 'Filtro de eventos inválido.';
  end if;
  select jsonb_build_object(
    'em_analise', (select count(*) from events where status = 'em_analise'),
    'ocultos', (select count(*) from events where status = 'oculto'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo, 'descricao', e.descricao,
      'inicio_em', e.inicio_em, 'fim_em', e.fim_em, 'local_nome', e.local_nome,
      'place_id', e.place_id, 'lat', e.lat, 'lng', e.lng, 'gratuito', e.gratuito,
      'preco_centavos', e.preco_centavos, 'ingresso_url', e.ingresso_url,
      'vagas', e.vagas, 'status', e.status, 'motivo_status', e.motivo_status,
      'criado_em', e.criado_em, 'organizador', coalesce(p.nome, 'Conta removida'),
      'confirmados', (select count(*) from event_rsvps r where r.event_id = e.id),
      'denuncias', (select count(*) from event_reports d where d.event_id = e.id)
    ) order by e.criado_em) from events e left join profiles p on p.id = e.criado_por where e.status = p_status), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;

revoke all on function public.eventos_por_perto(double precision,double precision,double precision,timestamptz,timestamptz,text,text,integer) from public;
revoke all on function public.evento_criar(text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,text,boolean,integer,text,integer,boolean) from public, anon;
revoke all on function public.evento_confirmar_presenca(uuid) from public, anon;
revoke all on function public.evento_denunciar(uuid,text,text) from public, anon;
revoke all on function public.evento_cancelar(uuid) from public, anon;
revoke all on function public.evento_moderar(uuid,text,text) from public, anon;
revoke all on function public.meus_eventos() from public, anon;
revoke all on function public.admin_eventos(text) from public, anon;
revoke all on function public.meu_evento_detalhe(uuid) from public, anon;
revoke all on function public.evento_atualizar(uuid,jsonb) from public, anon;
grant execute on function public.eventos_por_perto(double precision,double precision,double precision,timestamptz,timestamptz,text,text,integer) to anon, authenticated;
grant execute on function public.evento_criar(text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,text,boolean,integer,text,integer,boolean) to authenticated;
grant execute on function public.evento_confirmar_presenca(uuid) to authenticated;
grant execute on function public.evento_denunciar(uuid,text,text) to authenticated;
grant execute on function public.evento_cancelar(uuid) to authenticated;
grant execute on function public.evento_moderar(uuid,text,text) to authenticated;
grant execute on function public.meus_eventos() to authenticated;
grant execute on function public.admin_eventos(text) to authenticated;
grant execute on function public.meu_evento_detalhe(uuid) to authenticated;
grant execute on function public.evento_atualizar(uuid,jsonb) to authenticated;

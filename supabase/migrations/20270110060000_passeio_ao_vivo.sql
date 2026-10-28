-- Passeio ao vivo (BUSINESS.md 19.7 e 20.7): o passeador da loja inicia o
-- passeio, manda pontos de GPS, fotos e registros (xixi, cocô, água) e
-- encerra. O tutor acompanha em tempo real (Realtime com RLS) e recebe o
-- resumo. agendado → iniciado → em_andamento → encerrado → avaliado; sem
-- início até 30 min depois do horário, vira perdido e avisa loja e tutor.

create table if not exists public.walks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  walker_id uuid references auth.users (id) on delete set null,
  status text not null default 'agendado' check (status in ('agendado', 'iniciado', 'em_andamento', 'encerrado', 'avaliado', 'perdido')),
  fase text not null default 'buscou' check (fase in ('buscou', 'passeando', 'voltando', 'entregue')),
  started_at timestamptz,
  ended_at timestamptz,
  distance_m int not null default 0 check (distance_m >= 0),
  summary text check (char_length(summary) <= 600),
  ultimo_lat double precision,
  ultimo_lng double precision,
  criado_em timestamptz not null default now()
);
alter table public.walks enable row level security;
revoke all on public.walks from public, anon, authenticated;
grant select on public.walks to authenticated;
-- Quem pode ver o passeio: o tutor da reserva ou a equipe da loja.
create or replace function public.passeio_visivel(p_walk uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from walks w join requests r on r.id = w.request_id
                 where w.id = p_walk and (r.user_id = auth.uid() or public.loja_membro(w.store_id)));
$$;
revoke all on function public.passeio_visivel(uuid) from public, anon;
grant execute on function public.passeio_visivel(uuid) to authenticated;

drop policy if exists walks_partes on public.walks;
create policy walks_partes on public.walks for select to authenticated using (public.passeio_visivel(id));

create table if not exists public.walk_points (
  id bigint generated always as identity primary key,
  walk_id uuid not null references public.walks (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  at timestamptz not null
);
create index if not exists walk_points_walk on public.walk_points (walk_id, at);
alter table public.walk_points enable row level security;
revoke all on public.walk_points from public, anon, authenticated;
grant select on public.walk_points to authenticated;
drop policy if exists walk_points_partes on public.walk_points;
create policy walk_points_partes on public.walk_points for select to authenticated
  using (public.passeio_visivel(walk_id));

create table if not exists public.walk_events (
  id bigint generated always as identity primary key,
  walk_id uuid not null references public.walks (id) on delete cascade,
  type text not null check (type in ('foto', 'xixi', 'coco', 'agua')),
  media_path text,
  at timestamptz not null default now()
);
create index if not exists walk_events_walk on public.walk_events (walk_id, at);
alter table public.walk_events enable row level security;
revoke all on public.walk_events from public, anon, authenticated;
grant select on public.walk_events to authenticated;
drop policy if exists walk_events_partes on public.walk_events;
create policy walk_events_partes on public.walk_events for select to authenticated
  using (public.passeio_visivel(walk_id));

-- Fotos do passeio: pasta = id do passeio; quem vê o passeio vê a foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passeios-loja', 'passeios-loja', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "passeios-loja: passeador envia" on storage.objects;
create policy "passeios-loja: passeador envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'passeios-loja' and exists (select 1 from public.walks w where w.id::text = (storage.foldername(name))[1] and public.loja_membro(w.store_id)));
drop policy if exists "passeios-loja: partes leem" on storage.objects;
create policy "passeios-loja: partes leem" on storage.objects for select to authenticated
  using (bucket_id = 'passeios-loja' and public.passeio_visivel(((storage.foldername(name))[1])::uuid));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'walk_points') then
      alter publication supabase_realtime add table public.walk_points;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'walk_events') then
      alter publication supabase_realtime add table public.walk_events;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'walks') then
      alter publication supabase_realtime add table public.walks;
    end if;
  end if;
end $$;

-- Passeador: equipe da loja (dono, gerente ou quem tem a função passeador).
create or replace function public.passeio_walker_ok(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members m where m.store_id = p_store and m.user_id = auth.uid() and m.active
                 and (m.role in ('owner', 'manager') or m.funcao = 'passeador'));
$$;

create or replace function public.passeio_iniciar(p_request uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r requests; w walks; v_pet text;
begin
  select * into r from requests where id = p_request for update;
  if r.id is null or r.kind <> 'servico' or not exists (select 1 from walk_rules where service_id = r.service_id) then
    raise exception 'Reserva de passeio não encontrada.' using errcode = '22023';
  end if;
  if not public.passeio_walker_ok(r.store_id) then raise exception 'Só o passeador da loja inicia o passeio.' using errcode = '42501'; end if;
  if r.status <> 'confirmada' then raise exception 'Confirme a reserva antes de iniciar.' using errcode = '22023'; end if;
  insert into walks (request_id, store_id, walker_id, status, started_at) values (r.id, r.store_id, auth.uid(), 'iniciado', now())
  on conflict (request_id) do update set status = 'iniciado', walker_id = auth.uid(), started_at = coalesce(walks.started_at, now())
    where walks.status in ('agendado', 'perdido')
  returning * into w;
  if w.id is null then raise exception 'Este passeio já começou.' using errcode = '22023'; end if;
  perform public.solicitacao_mudar(r.id, 'em_andamento', null, null);
  select nome into v_pet from pets where id = r.pet_id;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (r.user_id, 'pedido', 'O passeio começou', coalesce(v_pet, 'Seu pet') || ' saiu para passear. Acompanhe ao vivo.', '/pedidos/' || r.id || '/passeio');
  return w.id;
end;
$$;

create or replace function public.passeio_fase(p_walk uuid, p_fase text)
returns void language plpgsql security definer set search_path = public as $$
declare w walks;
begin
  select * into w from walks where id = p_walk for update;
  if w.id is null or not public.passeio_walker_ok(w.store_id) then raise exception 'Passeio não disponível.' using errcode = '42501'; end if;
  if w.status not in ('iniciado', 'em_andamento') then raise exception 'O passeio não está em andamento.' using errcode = '22023'; end if;
  update walks set fase = p_fase, status = 'em_andamento' where id = w.id;
end;
$$;

-- Lote de pontos (o app do passeador manda a cada poucos segundos). Pontos fora de ordem ou saltos irreais não contam na distância.
create or replace function public.passeio_pontos(p_walk uuid, p_pontos jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare w walks; p jsonb; v_lat double precision; v_lng double precision; v_at timestamptz; v_dist double precision := 0;
  v_ult_lat double precision; v_ult_lng double precision; v_ult_at timestamptz; v_d double precision; v_n int := 0;
begin
  select * into w from walks where id = p_walk for update;
  if w.id is null or not public.passeio_walker_ok(w.store_id) then raise exception 'Passeio não disponível.' using errcode = '42501'; end if;
  if w.status not in ('iniciado', 'em_andamento') then raise exception 'O passeio não está em andamento.' using errcode = '22023'; end if;
  if jsonb_typeof(p_pontos) <> 'array' or jsonb_array_length(p_pontos) > 500 then raise exception 'Lote inválido.' using errcode = '22023'; end if;
  v_ult_lat := w.ultimo_lat; v_ult_lng := w.ultimo_lng;
  select max(at) into v_ult_at from walk_points where walk_id = w.id;
  for p in select * from jsonb_array_elements(p_pontos) loop
    v_lat := (p->>'lat')::double precision; v_lng := (p->>'lng')::double precision; v_at := (p->>'at')::timestamptz;
    if v_lat not between -90 and 90 or v_lng not between -180 and 180 or v_at > now() + interval '1 minute' then continue; end if;
    if v_ult_at is not null and v_at <= v_ult_at then continue; end if;
    if v_ult_lat is not null then
      v_d := public.perdido_distancia_km(v_ult_lat, v_ult_lng, v_lat, v_lng) * 1000;
      -- Mais de 15 m/s (54 km/h) é ruído de GPS: o ponto entra, mas não soma distância.
      if v_ult_at is null or v_d / greatest(extract(epoch from (v_at - v_ult_at)), 1) <= 15 then v_dist := v_dist + v_d; end if;
    end if;
    insert into walk_points (walk_id, lat, lng, at) values (w.id, v_lat, v_lng, v_at);
    v_ult_lat := v_lat; v_ult_lng := v_lng; v_ult_at := v_at; v_n := v_n + 1;
  end loop;
  update walks set distance_m = distance_m + round(v_dist)::int, ultimo_lat = v_ult_lat, ultimo_lng = v_ult_lng, status = 'em_andamento' where id = w.id;
  return v_n;
end;
$$;

create or replace function public.passeio_registro(p_walk uuid, p_tipo text, p_media_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare w walks;
begin
  select * into w from walks where id = p_walk;
  if w.id is null or not public.passeio_walker_ok(w.store_id) then raise exception 'Passeio não disponível.' using errcode = '42501'; end if;
  if w.status not in ('iniciado', 'em_andamento') then raise exception 'O passeio não está em andamento.' using errcode = '22023'; end if;
  if p_tipo = 'foto' and split_part(coalesce(p_media_path, ''), '/', 1) <> w.id::text then raise exception 'Foto inválida.' using errcode = '22023'; end if;
  insert into walk_events (walk_id, type, media_path) values (w.id, p_tipo, case when p_tipo = 'foto' then p_media_path end);
end;
$$;

create or replace function public.passeio_encerrar(p_walk uuid, p_resumo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare w walks; r requests; v_pet text;
begin
  select * into w from walks where id = p_walk for update;
  if w.id is null or not public.passeio_walker_ok(w.store_id) then raise exception 'Passeio não disponível.' using errcode = '42501'; end if;
  if w.status not in ('iniciado', 'em_andamento') then raise exception 'O passeio não está em andamento.' using errcode = '22023'; end if;
  update walks set status = 'encerrado', fase = 'entregue', ended_at = now(), summary = nullif(left(btrim(coalesce(p_resumo, '')), 600), '') where id = w.id;
  select * into r from requests where id = w.request_id;
  perform public.solicitacao_mudar(r.id, 'concluida', null, null);
  select nome into v_pet from pets where id = r.pet_id;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (r.user_id, 'pedido', 'Passeio concluído', coalesce(v_pet, 'Seu pet') || ' voltou: ' || round(w.distance_m / 1000.0, 1) || ' km. Veja o resumo e avalie.', '/pedidos/' || r.id || '/passeio');
end;
$$;

-- Passeios não iniciados 30 min depois do horário (cron a cada 10 min).
create or replace function public.passeios_perdidos()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  for r in select q.id, q.user_id, q.store_id from requests q join walk_rules wr on wr.service_id = q.service_id
           where q.kind = 'servico' and q.status = 'confirmada' and q.starts_at < now() - interval '30 minutes'
             and not exists (select 1 from walks w where w.request_id = q.id) loop
    insert into walks (request_id, store_id, status) values (r.id, r.store_id, 'perdido') on conflict (request_id) do nothing;
    insert into notification_log (user_id, type, title, body, deep_link)
    values (r.user_id, 'pedido', 'O passeio não começou', 'O passeador não iniciou o passeio no horário. Fale com a loja pela conversa do pedido.', '/pedidos/' || r.id);
    insert into notification_log (user_id, type, title, body, deep_link)
    select m.user_id, 'pedido', 'Passeio não iniciado', 'Um passeio passou 30 min do horário sem começar.', '/loja-painel/pedido/' || r.id
    from store_members m where m.store_id = r.store_id and m.active and (m.role in ('owner', 'manager') or m.funcao = 'passeador');
    v := v + 1;
  end loop;
  return v;
end;
$$;

-- Tutor (ou a loja): o passeio da reserva, com pontos e registros.
create or replace function public.passeio_ao_vivo(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r requests; w walks;
begin
  select * into r from requests where id = p_request;
  if r.id is null or not (r.user_id = auth.uid() or public.loja_membro(r.store_id)) then return jsonb_build_object('disponivel', false); end if;
  select * into w from walks where request_id = r.id;
  return jsonb_build_object('disponivel', true, 'request_id', r.id, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'request_status', r.status,
    'pet', (select nome from pets where id = r.pet_id), 'loja', (select name from stores where id = r.store_id),
    'passeador', case when w.walker_id is not null then public.comunidade_nome(w.walker_id) end,
    'walk', case when w.id is null then null else jsonb_build_object('id', w.id, 'status', w.status, 'fase', w.fase, 'started_at', w.started_at,
      'ended_at', w.ended_at, 'distance_m', w.distance_m, 'summary', w.summary) end,
    'pontos', coalesce((select jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'at', at) order by at) from walk_points where walk_id = w.id), '[]'::jsonb),
    'registros', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'type', type, 'media_path', media_path, 'at', at) order by at) from walk_events where walk_id = w.id), '[]'::jsonb));
end;
$$;

-- Avaliar o passeio marca o passeio como avaliado.
create or replace function public.walk_marcar_avaliado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update walks set status = 'avaliado' where request_id = new.request_id and status = 'encerrado';
  return new;
end;
$$;
drop trigger if exists reviews_walk_avaliado on public.reviews;
create trigger reviews_walk_avaliado after insert on public.reviews for each row execute function public.walk_marcar_avaliado();

revoke all on function public.passeio_walker_ok(uuid), public.passeios_perdidos(), public.walk_marcar_avaliado() from public, anon, authenticated;
revoke all on function public.passeio_iniciar(uuid), public.passeio_fase(uuid, text), public.passeio_pontos(uuid, jsonb), public.passeio_registro(uuid, text, text),
  public.passeio_encerrar(uuid, text), public.passeio_ao_vivo(uuid) from public, anon;
grant execute on function public.passeio_iniciar(uuid), public.passeio_fase(uuid, text), public.passeio_pontos(uuid, jsonb), public.passeio_registro(uuid, text, text),
  public.passeio_encerrar(uuid, text), public.passeio_ao_vivo(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-passeios-perdidos') where exists (select 1 from cron.job where jobname = 'petlive-passeios-perdidos');
    perform cron.schedule('petlive-passeios-perdidos', '*/10 * * * *', 'select public.passeios_perdidos()');
  end if;
end $$;

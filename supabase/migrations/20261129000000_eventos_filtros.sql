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
  if p_periodo is null or p_periodo not in ('hoje','semana','mes') then raise exception 'Período de eventos inválido.'; end if;
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
    and e.fim_em > p_inicio and e.inicio_em <= p_fim
    and (p_periodo <> 'hoje' or e.inicio_em < ((date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'))
    and (p_periodo <> 'semana' or e.inicio_em < ((date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo'))
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

revoke all on function public.eventos_por_perto(double precision,double precision,double precision,timestamptz,timestamptz,text,text,integer) from public;
grant execute on function public.eventos_por_perto(double precision,double precision,double precision,timestamptz,timestamptz,text,text,integer) to anon, authenticated;

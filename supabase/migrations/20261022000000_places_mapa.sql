-- PetLive: mapa — lugares pet do OpenStreetMap e consulta por perto.
-- Tarefas: [BACKEND] "Importar lugares do OpenStreetMap (Overpass) para a
-- tabela places, Rio de Janeiro" e [BACKEND] "Consulta de lugares por
-- distância e tipo".
--
-- places guarda os POIs pet importados (clínicas, banho e tosa, petshop),
-- com a flag "aberto_24h" derivada do opening_hours do OSM. A importação
-- é um script Node (scripts/importar-lugares-osm.mjs) que gera SQL de
-- upsert; só o dono do banco grava (sem policy de escrita).
--
-- lugares_por_perto devolve os lugares ordenados pela distância de um
-- ponto, com caixa-busca (bounding box + fórmula de haversine) para não
-- varrer a tabela inteira.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  -- Identidade no OpenStreetMap, para o upsert da importação ser idempotente.
  osm_type text not null check (osm_type in ('node', 'way', 'relation')),
  osm_id bigint not null,
  nome text not null,
  categoria text not null check (categoria in ('clinica', 'banho_tosa', 'petshop')),
  endereco text,
  telefone text,
  -- opening_hours cru do OSM, ex.: "Mo-Fr 08:00-22:00; Sa 08:00-18:00".
  horario text,
  website text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- Derivado do opening_hours ("24/7") na importação.
  aberto_24h boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (osm_type, osm_id)
);

comment on table public.places is
  'Lugares pet do OpenStreetMap (clínicas, banho e tosa, petshop) para o mapa.';

-- Caixa-busca por latitude/longitude antes do haversine.
create index places_lat_lng_idx on public.places (lat, lng);
create index places_categoria_idx on public.places (categoria) where categoria is not null;

alter table public.places enable row level security;

-- Leitura pública (mesma ideia do calendário de vacinas): o mapa pode
-- listar lugares sem sessão; a escrita é exclusiva da importação.
create policy "places: leitura publica"
  on public.places
  for select
  using (true);

create trigger places_touch_updated_at
  before update on public.places
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Consulta por perto (tipo, busca, 24h e raio)
-- ============================================================
create or replace function public.lugares_por_perto(
  p_lat double precision,
  p_lng double precision,
  p_categoria text default null,
  p_busca text default null,
  p_raio_km double precision default 10,
  p_aberto_24h boolean default null,
  p_limite integer default 50
)
returns table (
  id uuid,
  nome text,
  categoria text,
  endereco text,
  telefone text,
  horario text,
  website text,
  lat double precision,
  lng double precision,
  aberto_24h boolean,
  distancia_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  -- Caixa geográfica (aproximação em graus) + haversine para ordenar.
  select
    p.id,
    p.nome,
    p.categoria,
    p.endereco,
    p.telefone,
    p.horario,
    p.website,
    p.lat,
    p.lng,
    p.aberto_24h,
    (2 * 6371 * asin(sqrt(
      power(sin(radians(p.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(p.lat)) *
      power(sin(radians(p.lng - p_lng) / 2), 2)
    ))) as distancia_km
  from public.places p
  where p.lat between p_lat - (p_raio_km / 111.0)
                 and p_lat + (p_raio_km / 111.0)
    and p.lng between p_lng - (p_raio_km / (111.0 * greatest(cos(radians(p_lat)), 0.05)))
                 and p_lng + (p_raio_km / (111.0 * greatest(cos(radians(p_lat)), 0.05)))
    and (p_categoria is null or p.categoria = p_categoria)
    and (p_aberto_24h is null or p.aberto_24h = p_aberto_24h)
    and (p_busca is null or p.nome ilike '%' || p_busca || '%')
  order by distancia_km
  limit least(coalesce(p_limite, 50), 200);
$$;

comment on function public.lugares_por_perto is
  'Mapa: lugares pet por perto de um ponto, com filtro de tipo, busca, 24h e raio (km), ordenados pela distância.';

revoke all on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer) from public;
grant execute on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer) to authenticated;

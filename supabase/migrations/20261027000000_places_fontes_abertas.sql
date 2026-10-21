-- PetLive: lugares de fontes abertas (OpenStreetMap + Overture Maps).
-- A tabela places deixa de ser só do OpenStreetMap: cada linha tem a fonte
-- e o id nela (upsert idempotente do scripts/importar-lugares.py), mais as
-- categorias de creche, hotelzinho e pet friendly (BUSINESS.md 5.15 e 5.19).

alter table public.places
  add column fonte text not null default 'osm' check (fonte in ('osm', 'overture')),
  add column fonte_id text,
  -- Pet friendly: o lugar informa que aceita cães (OSM dog=yes/leashed).
  add column aceita_caes boolean,
  -- Parque com área própria para cães (OSM leisure=dog_park, Overture dog_park).
  add column area_caes boolean not null default false;

-- Linhas já importadas do OSM: fonte_id = "tipo/id", como o script novo grava.
update public.places set fonte_id = osm_type || '/' || osm_id where fonte_id is null;

alter table public.places
  alter column fonte_id set not null,
  alter column osm_type drop not null,
  alter column osm_id drop not null,
  add constraint places_fonte_fonte_id_key unique (fonte, fonte_id);

alter table public.places drop constraint places_categoria_check;
alter table public.places add constraint places_categoria_check check (categoria in (
  'clinica', 'banho_tosa', 'petshop', 'creche', 'hotelzinho',
  'parque', 'praia', 'restaurante', 'hotel'
));

comment on table public.places is
  'Lugares pet de fontes abertas (OpenStreetMap e Overture Maps): serviços e pet friendly, para o mapa.';

-- ============================================================
-- Consulta por perto: agora com o grupo (serviços ou pet friendly)
-- ============================================================
drop function if exists public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer);

create or replace function public.lugares_por_perto(
  p_lat double precision,
  p_lng double precision,
  p_categoria text default null,
  p_busca text default null,
  p_raio_km double precision default 10,
  p_aberto_24h boolean default null,
  p_limite integer default 50,
  -- Sem categoria: 'servicos' (clínica, petshop, banho e tosa, creche,
  -- hotelzinho) ou 'pet_friendly' (parque, praia, restaurante, hotel).
  p_grupo text default 'servicos'
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
  aceita_caes boolean,
  area_caes boolean,
  fonte text,
  distancia_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nome, p.categoria, p.endereco, p.telefone, p.horario, p.website,
    p.lat, p.lng, p.aberto_24h, p.aceita_caes, p.area_caes, p.fonte,
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
    and (
      (p_categoria is not null and p.categoria = p_categoria)
      or (p_categoria is null and p_grupo = 'pet_friendly'
          and p.categoria in ('parque', 'praia', 'restaurante', 'hotel'))
      or (p_categoria is null and coalesce(p_grupo, 'servicos') <> 'pet_friendly'
          and p.categoria in ('clinica', 'petshop', 'banho_tosa', 'creche', 'hotelzinho'))
    )
    and (p_aberto_24h is null or p.aberto_24h = p_aberto_24h)
    and (p_busca is null or p.nome ilike '%' || p_busca || '%')
  order by distancia_km
  limit least(coalesce(p_limite, 50), 200);
$$;

comment on function public.lugares_por_perto is
  'Mapa: lugares pet por perto de um ponto (serviços ou pet friendly), com filtro de tipo, busca, 24h e raio (km), ordenados pela distância.';

revoke all on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer, text) from public, anon;
grant execute on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer, text) to authenticated;

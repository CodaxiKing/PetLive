-- Repara ambientes que receberam o schema sem as policies/RPC do tutor.
-- Pode ser executada novamente. Não remove pets nem lugares existentes.
begin;
alter table public.pets enable row level security;
grant select, insert, update, delete on public.pets to authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pets' and policyname='pets: cadastro leitura propria') then
    create policy "pets: cadastro leitura propria" on public.pets for select to authenticated using(tutor_id=auth.uid());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pets' and policyname='pets: cadastro insercao propria') then
    create policy "pets: cadastro insercao propria" on public.pets for insert to authenticated with check(tutor_id=auth.uid());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pets' and policyname='pets: cadastro atualizacao propria') then
    create policy "pets: cadastro atualizacao propria" on public.pets for update to authenticated using(tutor_id=auth.uid()) with check(tutor_id=auth.uid());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pets' and policyname='pets: cadastro exclusao propria') then
    create policy "pets: cadastro exclusao propria" on public.pets for delete to authenticated using(tutor_id=auth.uid());
  end if;
end $$;

-- Colunas utilizadas pelo importador e pela busca, em schemas antigos.
alter table public.places
  add column if not exists osm_type text,
  add column if not exists osm_id bigint,
  add column if not exists fonte text not null default 'osm',
  add column if not exists fonte_id text,
  add column if not exists aceita_caes boolean,
  add column if not exists aceita_gatos boolean,
  add column if not exists area_caes boolean not null default false,
  add column if not exists endereco text,
  add column if not exists telefone text,
  add column if not exists horario text,
  add column if not exists website text,
  add column if not exists aberto_24h boolean not null default false;
alter table public.places alter column osm_type drop not null, alter column osm_id drop not null;
alter table public.places drop constraint if exists places_fonte_check;
alter table public.places add constraint places_fonte_check check(fonte in ('osm','overture','tutor'));
alter table public.places drop constraint if exists places_categoria_check;
alter table public.places add constraint places_categoria_check check(categoria in ('clinica','banho_tosa','petshop','creche','hotelzinho','parque','praia','restaurante','hotel'));
create unique index if not exists places_fonte_fonte_id_key on public.places(fonte,fonte_id);
create index if not exists places_lat_lng_idx on public.places(lat,lng);
alter table public.places enable row level security;
grant select on public.places to authenticated;
revoke insert, update, delete on public.places from anon, authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='places' and policyname='places: mapa leitura') then
    create policy "places: mapa leitura" on public.places for select to authenticated using(true);
  end if;
end $$;

-- Elimina a assinatura anterior para evitar ambiguidade no PostgREST.
drop function if exists public.lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer);
drop function if exists public.lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer,text);
create function public.lugares_por_perto(
  p_lat double precision, p_lng double precision, p_categoria text default null,
  p_busca text default null, p_raio_km double precision default 10,
  p_aberto_24h boolean default null, p_limite integer default 50, p_grupo text default 'servicos'
) returns table(
  id uuid,nome text,categoria text,endereco text,telefone text,horario text,website text,
  lat double precision,lng double precision,aberto_24h boolean,aceita_caes boolean,
  aceita_gatos boolean,area_caes boolean,fonte text,distancia_km double precision
) language sql stable security definer set search_path=public as $$
  select * from (select p.id,p.nome,p.categoria,p.endereco,p.telefone,p.horario,p.website,
    p.lat,p.lng,p.aberto_24h,p.aceita_caes,p.aceita_gatos,p.area_caes,p.fonte,
    2*6371*asin(least(1.0,sqrt(
      power(sin(radians(p.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-p_lng)/2),2)
    ))) as distancia_km
  from public.places p
  where auth.uid() is not null
    and p_raio_km>0 and p_lat between -90 and 90 and p_lng between -180 and 180
    and p.lat between p_lat-least(p_raio_km,100)/111.0 and p_lat+least(p_raio_km,100)/111.0
    and p.lng between p_lng-least(p_raio_km,100)/(111.0*greatest(cos(radians(p_lat)),0.05))
      and p_lng+least(p_raio_km,100)/(111.0*greatest(cos(radians(p_lat)),0.05))
    and ((p_categoria is not null and p.categoria=p_categoria)
      or (p_categoria is null and p_grupo='pet_friendly' and p.categoria in ('parque','praia','restaurante','hotel'))
      or (p_categoria is null and coalesce(p_grupo,'servicos')<>'pet_friendly' and p.categoria in ('clinica','petshop','banho_tosa','creche','hotelzinho')))
    and (p_aberto_24h is null or p.aberto_24h=p_aberto_24h)
    and (nullif(trim(p_busca),'') is null or p.nome ilike '%'||trim(p_busca)||'%')
  ) candidatos where candidatos.distancia_km<=least(p_raio_km,100)
  order by distancia_km
  limit greatest(0,least(coalesce(p_limite,50),200));
$$;
revoke all on function public.lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer,text) from public,anon;
grant execute on function public.lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;

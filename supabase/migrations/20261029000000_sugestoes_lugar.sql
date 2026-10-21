-- PetLive: tutores indicam lugares pet friendly (restaurantes, hotéis,
-- praias e parques), que as fontes abertas quase não marcam (docs/dados-abertos.md).
--
-- Mesma regra dos eventos enviados por usuário (BUSINESS.md 5.16): a
-- indicação fica "em análise" e só aparece no mapa depois de aprovada pela
-- equipe. Até o painel admin (Fase 2), a equipe aprova ou recusa com as
-- funções aprovar_sugestao_lugar / recusar_sugestao_lugar (service role).

-- Lugares podem vir de indicação de tutor e dizer se aceitam gatos.
alter table public.places drop constraint places_fonte_check;
alter table public.places add constraint places_fonte_check check (fonte in ('osm', 'overture', 'tutor'));
alter table public.places add column aceita_gatos boolean;

create table public.sugestoes_lugar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  categoria text not null check (categoria in ('restaurante', 'hotel', 'praia', 'parque')),
  aceita text not null check (aceita in ('caes', 'gatos', 'caes_e_gatos')),
  endereco text check (char_length(endereco) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  observacao text check (char_length(observacao) <= 300),
  status text not null default 'em_analise' check (status in ('em_analise', 'aprovada', 'recusada')),
  motivo_recusa text check (char_length(motivo_recusa) <= 200),
  place_id uuid references public.places (id) on delete set null,
  criado_em timestamptz not null default now(),
  revisado_em timestamptz
);

create index sugestoes_lugar_user on public.sugestoes_lugar (user_id, criado_em desc);
create index sugestoes_lugar_fila on public.sugestoes_lugar (criado_em) where status = 'em_analise';

alter table public.sugestoes_lugar enable row level security;

-- O tutor vê e cria só as suas; a criação entra sempre "em análise".
create policy "sugestoes_lugar: tutor le as suas"
  on public.sugestoes_lugar for select to authenticated
  using (user_id = auth.uid());

create policy "sugestoes_lugar: tutor indica"
  on public.sugestoes_lugar for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'em_analise'
    and place_id is null
    and motivo_recusa is null
    and revisado_em is null
  );

revoke all on public.sugestoes_lugar from anon;
revoke update, delete on public.sugestoes_lugar from authenticated;
grant select, insert on public.sugestoes_lugar to authenticated;

-- Limite: 5 indicações por tutor por dia (evita spam na fila da equipe).
create or replace function public.limitar_sugestoes_lugar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from sugestoes_lugar
      where user_id = new.user_id and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Você já indicou 5 lugares hoje. Tente amanhã.' using errcode = 'P0001';
  end if;
  new.nome := trim(new.nome);
  return new;
end;
$$;

create trigger sugestoes_lugar_limite
  before insert on public.sugestoes_lugar
  for each row execute function public.limitar_sugestoes_lugar();

-- ============================================================
-- Moderação (service role: painel do Supabase até o admin da Fase 2)
-- ============================================================
create or replace function public.aprovar_sugestao_lugar(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sugestoes_lugar;
  v_place uuid;
begin
  select * into s from sugestoes_lugar where id = p_id for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if s.status <> 'em_analise' then raise exception 'Indicação já revisada (%).', s.status; end if;

  insert into places (fonte, fonte_id, nome, categoria, endereco, lat, lng, aceita_caes, aceita_gatos)
  values (
    'tutor', s.id::text, s.nome, s.categoria, s.endereco, s.lat, s.lng,
    s.aceita in ('caes', 'caes_e_gatos'), s.aceita in ('gatos', 'caes_e_gatos')
  )
  returning id into v_place;

  update sugestoes_lugar set status = 'aprovada', place_id = v_place, revisado_em = now() where id = p_id;
  return v_place;
end;
$$;

create or replace function public.recusar_sugestao_lugar(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sugestoes_lugar
     set status = 'recusada', motivo_recusa = left(p_motivo, 200), revisado_em = now()
   where id = p_id and status = 'em_analise';
  if not found then raise exception 'Indicação não encontrada ou já revisada.'; end if;
end;
$$;

revoke all on function public.aprovar_sugestao_lugar(uuid) from public, anon, authenticated;
revoke all on function public.recusar_sugestao_lugar(uuid, text) from public, anon, authenticated;
grant execute on function public.aprovar_sugestao_lugar(uuid) to service_role;
grant execute on function public.recusar_sugestao_lugar(uuid, text) to service_role;

-- A busca por perto passa a devolver se o lugar aceita gatos.
drop function if exists public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer, text);

create or replace function public.lugares_por_perto(
  p_lat double precision,
  p_lng double precision,
  p_categoria text default null,
  p_busca text default null,
  p_raio_km double precision default 10,
  p_aberto_24h boolean default null,
  p_limite integer default 50,
  p_grupo text default 'servicos'
)
returns table (
  id uuid, nome text, categoria text, endereco text, telefone text, horario text, website text,
  lat double precision, lng double precision, aberto_24h boolean, aceita_caes boolean,
  aceita_gatos boolean, area_caes boolean, fonte text, distancia_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.nome, p.categoria, p.endereco, p.telefone, p.horario, p.website,
    p.lat, p.lng, p.aberto_24h, p.aceita_caes, p.aceita_gatos, p.area_caes, p.fonte,
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

revoke all on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer, text) from public, anon;
grant execute on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer, text) to authenticated;

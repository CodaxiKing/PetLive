-- Apenas para um banco descartável: reproduz as dependências ausentes.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,anon;
create table public.profiles(id uuid primary key,nome text not null);
create table public.pets(
  id uuid primary key default gen_random_uuid(),tutor_id uuid not null references public.profiles(id),
  nome text not null,especie text not null,ativo boolean not null default true,
  nascimento date,peso_atual numeric(5,2),sexo text,raca text,castrado boolean,foto_url text
);
alter table public.pets enable row level security;
create table public.places(
  id uuid primary key default gen_random_uuid(),nome text not null,
  categoria text not null check(categoria in ('clinica','petshop','banho_tosa')),
  lat double precision not null,lng double precision not null
);

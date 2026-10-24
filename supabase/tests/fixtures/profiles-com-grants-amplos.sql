-- Exclusivamente para banco descartável. Inclui grants antigos amplos.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
create table public.profiles (
  id uuid primary key, nome text not null, telefone text, cidade text,
  whatsapp boolean default true, contato_emergencia_nome text, contato_emergencia_telefone text,
  aceite_termos boolean default false, aceite_termos_em timestamptz,
  plano text not null default 'gratis', role text not null default 'tutor',
  provider text default 'email', email text, criado_em timestamptz default now()
);
alter table public.profiles enable row level security;
create policy permissiva_antiga on public.profiles for all to authenticated using(true) with check(true);
grant all on public.profiles to authenticated, service_role;
grant insert(plano,role), update(plano,role) on public.profiles to public, anon, authenticated;
insert into public.profiles(id,nome) values
 ('42000000-0000-4000-8000-000000000001','Tutor A'),
 ('42000000-0000-4000-8000-000000000002','Tutor B');

-- Representa o cadastro confiável por trigger SECURITY DEFINER do Auth.
create table auth.users(id uuid primary key,nome text);
create function public.fixture_cadastro_perfil() returns trigger language plpgsql
security definer set search_path=public as $$
begin insert into public.profiles(id,nome) values(new.id,new.nome); return new; end $$;
revoke all on function public.fixture_cadastro_perfil() from public,anon,authenticated;
create trigger cadastro after insert on auth.users for each row execute function public.fixture_cadastro_perfil();

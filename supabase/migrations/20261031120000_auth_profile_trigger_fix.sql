-- Restore account profile creation in the production Auth flow.
alter table public.profiles
  add column if not exists role text not null default 'tutor'
    check (role in ('tutor','store_owner','store_manager','store_staff','admin_super','admin_finance','admin_support','admin_moderation','admin_marketing','admin_readonly','ngo','caregiver'));
alter table public.profiles
  add column if not exists provider text not null default 'email'
    check (provider in ('email','google','apple'));
create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.aceites_termos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  termos_vigentes text not null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  primary key (user_id, termos_vigentes)
);
alter table public.aceites_termos enable row level security;
drop policy if exists "tutor ve os proprios aceites" on public.aceites_termos;
drop policy if exists "tutor registra o proprio aceite" on public.aceites_termos;
create policy "tutor ve os proprios aceites" on public.aceites_termos
  for select to authenticated using (auth.uid() = user_id);
create policy "tutor registra o proprio aceite" on public.aceites_termos
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text;
  v_aceite_em timestamptz;
begin
  -- Use the provider name ('email', 'google', 'apple'), not provider_id,
  -- which identifies the user within that provider.
  select lower(i.provider) into v_provider
    from auth.identities i
   where i.user_id = new.id
   order by i.created_at
   limit 1;
  v_provider := case
    when v_provider in ('email','google','apple') then v_provider
    when lower(coalesce(new.raw_app_meta_data ->> 'provider','')) in ('email','google','apple')
      then lower(new.raw_app_meta_data ->> 'provider')
    else 'email'
  end;
  v_aceite_em := (new.raw_user_meta_data ->> 'aceite_termos_em')::timestamptz;

  insert into public.profiles (id,nome,email,telefone,role,provider,aceite_termos,aceite_termos_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome',new.raw_user_meta_data ->> 'full_name',new.raw_user_meta_data ->> 'name',split_part(new.email,'@',1)),
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'telefone','')),20),''),
    'tutor',v_provider,v_aceite_em is not null,v_aceite_em
  )
  on conflict (id) do nothing;

  if v_aceite_em is not null then
    insert into public.aceites_termos(user_id,termos_vigentes,versao,aceito_em)
    values (new.id,'termos_de_uso','1.0',v_aceite_em)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

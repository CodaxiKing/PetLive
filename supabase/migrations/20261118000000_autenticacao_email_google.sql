-- PetLive: autenticação por e-mail e Google (BASE, Fase F1).
-- Tarefa: [BACKEND] Base: "Autenticação por e-mail e Google"
-- Adiciona papel (role) e provedor ao perfil, para vincular contas de
-- provedores diferentes ao mesmo e-mail sem criar duplicatas.
-- Referência: seção 7 e 17 do BUSINESS.md.

-- ============================================================
-- Papel do tutor no perfil
-- ============================================================
-- Fase 1: só existe 'tutor'. Lojas e admin entram nas fases 2 e 3.
alter table public.profiles
  add column if not exists role text not null default 'tutor'
    check (role in ('tutor', 'store_owner', 'store_manager', 'store_staff', 'admin_super', 'admin_finance', 'admin_support', 'admin_moderation', 'admin_marketing', 'admin_readonly', 'ngo', 'caregiver'));

comment on column public.profiles.role is 'Papel do usuário no PetLive. Fase 1: apenas tutor.';

-- ============================================================
-- Provedor de autenticação (email, google, apple)
-- ============================================================
alter table public.profiles
  add column if not exists provider text not null default 'email'
    check (provider in ('email', 'google', 'apple'));

comment on column public.profiles.provider is 'Provedor usado para autenticar (email, google, apple).';

-- ============================================================
-- Índice de busca por e-mail (login e verificação de duplicidade)
-- ============================================================
create index if not exists profiles_email_idx on public.profiles (email);

-- ============================================================
-- Perfil automático no cadastro: detecta provedor e grava
-- dados do cadastro (nome, email, telefone, aceite de termos, role, provider).
-- ============================================================
-- Esta função consolida as versões anteriores das migrations:
--   - 20261020000001 (schema inicial: id, nome, email)
--   - 20261020160000 (aceite termos: + aceite_termos, aceite_termos_em)
--   - 20261116000000 (dados do tutor: + telefone)
--   - 20261118000000 (autenticação: + provider, role)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text := 'email';
  v_aceite_em timestamptz;
begin
  -- O provedor vem da primeira identidade do usuário (email = senha, google = OAuth, apple = Apple).
  select lower(identity.provider_id)
    into v_provider
    from auth.identities identity
   where identity.user_id = new.id
   limit 1;

  -- Data do aceite de termos, se enviada nos metadados do cadastro.
  v_aceite_em := (new.raw_user_meta_data ->> 'aceite_termos_em')::timestamptz;

  insert into public.profiles (id, nome, email, telefone, role, provider, aceite_termos, aceite_termos_em)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nome',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), 20), ''),
    'tutor',
    coalesce(v_provider, 'email'),
    v_aceite_em is not null,
    v_aceite_em
  )
  on conflict (id) do nothing;

  -- Registra o aceite de termos na auditoria LGPD, se houver.
  if v_aceite_em is not null then
    insert into public.aceites_termos (user_id, termos_vigentes, versao, aceito_em)
    values (new.id, 'termos_de_uso', '1.0', v_aceite_em)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

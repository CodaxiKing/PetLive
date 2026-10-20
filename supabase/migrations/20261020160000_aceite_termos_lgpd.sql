-- PetLive: aceite de termos de uso e LGPD (P0).
-- Tarefa: [TUTOR] "Aceite de termos de uso e LGPD com registro de consentimento"
--   -> checkbox obrigatório no cadastro + modal de termos com botão aceitar.
-- O app envia `aceite_termos_em` nos metadados do signUp; este trigger grava
--   aceite_termos/aceite_termos_em no perfil e registra a auditoria do consentimento.

-- ============================================================
-- Auditoria de consentimento
-- ============================================================
create table public.aceites_termos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  termos_vigentes text not null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  primary key (user_id, termos_vigentes)
);

comment on table public.aceites_termos
  is 'Registro de consentimento (LGPD): qual termo o usuário aceitou e quando.';

alter table public.aceites_termos enable row level security;

create policy "tutor ve os proprios aceites" on public.aceites_termos
  for select using (auth.uid() = user_id);

create policy "tutor registra o proprio aceite" on public.aceites_termos
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- Perfil automático no cadastro, agora com o aceite
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aceite_em timestamptz;
begin
  aceite_em := (new.raw_user_meta_data ->> 'aceite_termos_em')::timestamptz;

  insert into public.profiles (id, nome, email, aceite_termos, aceite_termos_em)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nome',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    aceite_em is not null,
    aceite_em
  )
  on conflict (id) do nothing;

  if aceite_em is not null then
    insert into public.aceites_termos (user_id, termos_vigentes, versao, aceito_em)
    values (new.id, 'termos_de_uso', '1.0', aceite_em)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

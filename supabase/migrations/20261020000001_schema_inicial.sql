-- PetLive: schema inicial do MVP (backend).
-- Tarefas: [BACKEND] Base: "Schema: profiles, pets, vaccinations, dewormings,
-- weights, visits, medications, reminders e push_tokens"
--          [BACKEND] Base: "Regras de acesso (RLS) por tutor"
--          [BACKEND] Base: "Autenticação por e-mail e Google" (chaves do provedor
--          são configuradas no painel do Supabase; o app usa auth.users).
-- Referência: seção 7 do BUSINESS.md.

-- Extensões necessárias.
create extension if not exists "pgcrypto";

-- ============================================================
-- Perfis
-- ============================================================
-- Um por usuário do Auth. O id é o mesmo de auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  avatar_url text,
  -- Aceite de termos e LGPD, obrigatório no cadastro.
  aceite_termos boolean not null default false,
  aceite_termos_em timestamptz,
  -- Plano do tutor: gratis ou premium (limites na seção 10 do BUSINESS.md).
  plano text not null default 'gratis' check (plano in ('gratis', 'premium')),
  notificacoes_ativas boolean not null default true,
  -- Horário local usado para lembretes e "Não perturbe".
  fuso_horario text not null default 'America/Sao_Paulo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do tutor. Um registro por usuário do Auth.';

-- ============================================================
-- Pets
-- ============================================================
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  especie text not null check (especie in ('cao', 'gato')),
  raca text,
  nascimento date,
  sexo text check (sexo in ('macho', 'femea')),
  peso_atual numeric(5, 2),
  castrado boolean,
  foto_url text,
  -- Cores usadas na etiqueta e no QR da coleira.
  cor_etiqueta text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index pets_tutor_id_idx on public.pets (tutor_id) where ativo;
comment on table public.pets is 'Pets do tutor. Cada tutor só vê os seus.';

-- ============================================================
-- Vacinas
-- ============================================================
create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  -- Nome livre, mas calibrado com o calendário sugerido.
  nome text not null,
  aplicada_em date not null,
  -- Próxima dose: base do aviso de "vacina vencendo".
  proxima_dose date,
  lote text,
  local text,
  observacao text,
  criado_em timestamptz not null default now()
);

create index vaccinations_pet_id_idx on public.vaccinations (pet_id, aplicada_em desc);
create index vaccinations_proxima_dose_idx on public.vaccinations (proxima_dose) where proxima_dose is not null;
comment on table public.vaccinations is 'Vacinas aplicadas, com a próxima dose agendada.';

-- Calendário sugerido por espécie e idade (dados do servidor, P0).
create table public.vaccine_schedule (
  id uuid primary key default gen_random_uuid(),
  especie text not null check (especie in ('cao', 'gato')),
  nome text not null,
  -- Idade mínima da primeira dose, em meses.
  primeira_dose_meses int not null check (primeira_dose_meses >= 0),
  -- Intervalo entre doses seguintes, em meses. Null = dose única.
  reforco_meses int check (reforco_meses > 0),
  descricao text,
  ordem int not null default 0
);

create index vaccine_schedule_especie_idx on public.vaccine_schedule (especie, ordem);
comment on table public.vaccine_schedule is 'Calendário sugerido de vacinas por espécie e idade.';

-- ============================================================
-- Vermífugo, peso e consultas
-- ============================================================
create table public.dewormings (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  aplicado_em date not null,
  produto text,
  proxima_dose date,
  observacao text,
  criado_em timestamptz not null default now()
);

create index dewormings_pet_id_idx on public.dewormings (pet_id, aplicado_em desc);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  peso numeric(5, 2) not null check (peso > 0 and peso < 300),
  medido_em date not null,
  criado_em timestamptz not null default now()
);

create index weights_pet_id_idx on public.weights (pet_id, medido_em desc);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  motivo text not null,
  realizada_em date not null,
  local text,
  veterinario text,
  diagnostico text,
  valor numeric(10, 2),
  observacao text,
  criado_em timestamptz not null default now()
);

create index visits_pet_id_idx on public.visits (pet_id, realizada_em desc);

-- ============================================================
-- Remédios e lembretes
-- ============================================================
-- O remédio é o tratamento; as doses acontecem e são confirmadas.
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  nome text not null,
  -- Ex.: "1/4 de comprimido", "2 ml".
  dose text not null,
  -- Ex.: "a cada 8 horas", "2x ao dia". O horário real fica em horarios.
  frequencia text not null,
  horarios time[] not null default '{}',
  inicio date not null,
  fim date,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now()
);

create index medications_pet_id_idx on public.medications (pet_id) where ativo;

-- Cada dose tem a sua confirmação, para o progresso do dia.
create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  -- Dia e horário previstos da dose.
  prevista_para timestamptz not null,
  confirmada_em timestamptz,
  -- Pulada pelo tutor, para não ficar pendente para sempre.
  pulada boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (medication_id, prevista_para)
);

create index medication_doses_pendentes_idx
  on public.medication_doses (prevista_para)
  where confirmada_em is null and not pulada;

-- Lembretes: vacina, vermífugo, consulta, banho e tosa e personalizados.
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete cascade,
  tipo text not null check (tipo in ('vacina', 'vermifugo', 'consulta', 'banho_tosa', 'outro')),
  titulo text not null,
  -- Datas repetidas: "em breve" é só a próxima.
  proxima_em timestamptz not null,
  -- Ex.: "a cada 15 dias", "todo mês", "uma vez".
  repetir text check (repetir in ('nao', 'diario', 'semanal', 'mensal', 'anual', 'customizado')),
  intervalo_dias int check (intervalo_dias > 0),
  ativo boolean not null default true,
  -- Último aviso enviado, para não repetir notificação.
  ultimo_aviso_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index reminders_proxima_em_idx on public.reminders (proxima_em) where ativo;
create index reminders_tutor_idx on public.reminders (tutor_id, proxima_em);

-- ============================================================
-- Notificações
-- ============================================================
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('ios', 'android', 'web')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index push_tokens_tutor_idx on public.push_tokens (tutor_id) where ativo;

-- Preferências por tipo: a tela "Avisos" liga e desliga por tipo,
-- horário e "Não perturbe".
create table public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('vacina', 'vermifugo', 'consulta', 'banho_tosa', 'remedio', 'outro')),
  ativo boolean not null default true,
  -- Janela de silêncio do "Não perturbe".
  nao_perturbe_inicio time,
  nao_perturbe_fim time,
  unique (tutor_id, tipo)
);

comment on table public.notification_prefs is 'Preferências de aviso por tipo, com Não perturbe.';

-- ============================================================
-- Perfil automático no cadastro
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger pets_touch before update on public.pets
  for each row execute function public.touch_updated_at();
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

-- Tabelas consultadas pelo painel Sistema. São criadas vazias quando o
-- ambiente ainda não recebeu as migrations de push/caixa de avisos.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('ios', 'android', 'web')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists push_tokens_tutor_idx on public.push_tokens (tutor_id) where ativo;
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete set null,
  type text not null check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha')),
  title text not null,
  body text,
  deep_link text,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notification_log_user_sent on public.notification_log (user_id, sent_at desc);
create index if not exists notification_log_user_nao_lidos on public.notification_log (user_id) where read_at is null;
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

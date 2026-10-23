-- Repair production projects where admin_members was created without its
-- creation timestamp. admin_equipe orders members by this column.
alter table public.admin_members
  add column if not exists criado_em timestamptz not null default now();

create index if not exists admin_members_criado_em_idx
  on public.admin_members (criado_em desc);

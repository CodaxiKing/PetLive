-- PetLive: consentimentos separados e revogáveis (LGPD, P0).
-- Tarefa board: [BACKEND] Conta e privacidade: Tabela de consentimentos com versão dos termos.
--   -> "Tela de termos e política com consentimentos separados" grava aqui uma
--      linha por consentimento; revogar = nova linha com aceito = false.
--   -> `aceites_termos` (cadastro) continua como auditoria do aceite inicial.

create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (
    tipo in ('termos_uso', 'politica_privacidade', 'avisos_push', 'localizacao')
  ),
  versao text not null,
  aceito boolean not null,
  origem text not null default 'app' check (origem in ('app', 'web', 'admin')),
  registrado_em timestamptz not null default now()
);

comment on table public.consentimentos
  is 'Log append-only de consentimentos (LGPD): o estado atual de cada tipo é a linha mais recente.';

create index consentimentos_tutor_tipo_idx
  on public.consentimentos (tutor_id, tipo, registrado_em desc);

alter table public.consentimentos enable row level security;

-- Append-only: sem policy de update/delete — revogação é uma nova linha.
create policy "tutor ve os proprios consentimentos" on public.consentimentos
  for select using (auth.uid() = tutor_id);

create policy "tutor registra o proprio consentimento" on public.consentimentos
  for insert with check (auth.uid() = tutor_id);

-- Estado atual (última linha) por tipo, para a tela de privacidade.
create or replace function public.meus_consentimentos()
returns table (
  tipo text,
  versao text,
  aceito boolean,
  registrado_em timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (c.tipo)
    c.tipo, c.versao, c.aceito, c.registrado_em
  from public.consentimentos c
  where c.tutor_id = auth.uid()
  order by c.tipo, c.registrado_em desc
$$;

-- Padrão do projeto: RPC sem acesso anônimo.
revoke execute on function public.meus_consentimentos() from public, anon;
grant execute on function public.meus_consentimentos() to authenticated;

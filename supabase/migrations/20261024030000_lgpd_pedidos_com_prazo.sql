-- PetLive: pedidos de privacidade com prazo (BUSINESS.md 12 e 20.10).
-- Tarefa: [BACKEND] "Conta e privacidade: Funções de exportar os dados e
-- excluir a conta com prazo".
--
-- * Exportar continua na hora (exportar_meus_dados), mas cada exportação
--   fica registrada como pedido concluído.
-- * Excluir vira um pedido agendado: a conta e os dados são removidos em
--   30 dias (executar_em), e o tutor pode cancelar até lá. A Edge Function
--   `lgpd-delete`, chamada todo dia pelo pg_cron, apaga os arquivos do
--   Storage e o usuário do Auth (o resto cai em cascata).
-- * O pedido não tem FK para profiles: ele sobrevive à conta como prova
--   de que o pedido foi atendido.

create table public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  tipo text not null check (tipo in ('exportar', 'apagar', 'corrigir')),
  status text not null default 'novo'
    check (status in ('novo', 'aguardando_confirmacao', 'em_andamento', 'concluido', 'cancelado')),
  -- Prazo legal para atender o pedido.
  due_at timestamptz not null default now() + interval '15 days',
  -- Exclusão: quando os dados são de fato apagados.
  executar_em timestamptz,
  done_at timestamptz,
  criado_em timestamptz not null default now()
);

comment on table public.lgpd_requests is
  'Pedidos de privacidade (LGPD): exportar, apagar, corrigir. Sobrevive à conta como registro.';

create index lgpd_requests_user_idx on public.lgpd_requests (user_id, criado_em desc);
create index lgpd_requests_execucao_idx on public.lgpd_requests (executar_em)
  where tipo = 'apagar' and status = 'novo';

-- Só um pedido de exclusão em aberto por pessoa.
create unique index lgpd_requests_apagar_aberto_key on public.lgpd_requests (user_id)
  where tipo = 'apagar' and status in ('novo', 'aguardando_confirmacao', 'em_andamento');

alter table public.lgpd_requests enable row level security;

-- Leitura dos próprios pedidos; escrita só pelas funções abaixo.
create policy "lgpd_requests: tutor ve os proprios" on public.lgpd_requests
  for select using (auth.uid() = user_id);

-- ============================================================
-- Funções do app
-- ============================================================

/** Agenda a exclusão da conta. Devolve a data em que os dados serão apagados. */
create or replace function public.solicitar_exclusao_conta()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
  v_executar timestamptz;
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  select executar_em into v_executar
    from public.lgpd_requests
    where user_id = v_tutor and tipo = 'apagar' and status = 'novo';
  if v_executar is not null then
    return v_executar;
  end if;

  insert into public.lgpd_requests (user_id, email, tipo, executar_em)
  values (
    v_tutor,
    (select email from auth.users where id = v_tutor),
    'apagar',
    now() + interval '30 days'
  )
  returning executar_em into v_executar;

  return v_executar;
end;
$$;

/** Cancela a exclusão agendada (o tutor mudou de ideia dentro do prazo). */
create or replace function public.cancelar_exclusao_conta()
returns void
language sql
security definer
set search_path = public
as $$
  update public.lgpd_requests
    set status = 'cancelado', done_at = now()
    where user_id = auth.uid() and tipo = 'apagar' and status = 'novo';
$$;

/** Registra uma exportação feita na hora pelo app. */
create or replace function public.registrar_exportacao()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lgpd_requests (user_id, email, tipo, status, done_at)
  select auth.uid(), u.email, 'exportar', 'concluido', now()
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all on function public.solicitar_exclusao_conta() from public, anon;
revoke all on function public.cancelar_exclusao_conta() from public, anon;
revoke all on function public.registrar_exportacao() from public, anon;
grant execute on function public.solicitar_exclusao_conta() to authenticated;
grant execute on function public.cancelar_exclusao_conta() to authenticated;
grant execute on function public.registrar_exportacao() to authenticated;

-- ============================================================
-- Execução (usada pela Edge Function lgpd-delete, com service_role)
-- ============================================================

/** Pedidos de exclusão vencidos, já marcados como em andamento. */
create or replace function public.lgpd_exclusoes_vencidas()
returns table (id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  update public.lgpd_requests r
    set status = 'em_andamento'
    where r.tipo = 'apagar'
      and (r.status = 'novo' and r.executar_em <= now()
           -- Retoma as que pararam no meio (ex.: falha ao apagar arquivos).
           or r.status = 'em_andamento')
    returning r.id, r.user_id;
$$;

/** Apaga o usuário (cascata em profiles e tudo do tutor) e conclui o pedido. */
create or replace function public.lgpd_concluir_exclusao(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.lgpd_requests
    where id = p_pedido and tipo = 'apagar' and status = 'em_andamento';
  if v_user is null then
    return;
  end if;
  delete from auth.users where id = v_user;
  update public.lgpd_requests set status = 'concluido', done_at = now() where id = p_pedido;
end;
$$;

revoke all on function public.lgpd_exclusoes_vencidas() from public, anon, authenticated;
revoke all on function public.lgpd_concluir_exclusao(uuid) from public, anon, authenticated;
grant execute on function public.lgpd_exclusoes_vencidas() to service_role;
grant execute on function public.lgpd_concluir_exclusao(uuid) to service_role;

-- ============================================================
-- Agendamento: todo dia às 06:00 UTC (03:00 em Brasília).
-- URL e chave vêm do Vault (secrets project_url e service_role_key),
-- criados uma vez por ambiente; ver supabase/README.md.
-- ============================================================
select cron.schedule(
  'petlive-lgpd-delete',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/lgpd-delete',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $$
);

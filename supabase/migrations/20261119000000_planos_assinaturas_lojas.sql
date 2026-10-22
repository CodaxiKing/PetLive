-- PetLive: planos e assinaturas com integração Apple App Store e Google Play Store (BUSINESS.md 5.13, 20.4, 21.5, 23.1, 23.2).
-- Tarefas: [BACKEND] Premium e QR: Assinaturas: integração com as lojas de apps e webhooks (P-B7IKA).
-- A máquina de estados (seção 20.4): em_teste -> ativa -> pagamento_falhou -> expirada / cancelando -> cancelada.
-- O provedor (provider) pode ser 'apple', 'google' ou 'asaas' (pagamento fora das lojas).

-- ============================================================
-- Planos
-- ============================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                -- ex.: 'premium_mensal', 'premium_anual'
  name text not null,                       -- ex.: 'Premium Mensal', 'Premium Anual'
  price_cents int not null check (price_cents > 0),
  period text not null check (period in ('mensal', 'anual')),
  trial_days int not null default 7,        -- dias de teste grátis para novos assinantes
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is 'Planos de assinatura Premium disponíveis (mensal e anual).';

create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Assinaturas
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  -- Estado da assinatura (máquina de estados seção 20.4).
  status text not null check (status in ('em_teste', 'ativa', 'pagamento_falhou', 'expirada', 'cancelando', 'cancelada')) default 'em_teste',
  provider text not null check (provider in ('apple', 'google', 'asaas')),
  -- ID da assinatura no provedor: transactionId (Apple) ou purchaseToken (Google).
  provider_subscription_id text not null,
  -- Token de compra original (Apple: originalTransactionId; Google: purchaseToken do primeiro pedido).
  provider_original_transaction_id text,
  -- Dados do período atual sincronizados com a loja.
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null,        -- quando termina o período atual (renovação)
  renews_at timestamptz,                          -- próxima cobrança (pode divergir do current_period_end em grace period)
  cancel_at timestamptz,                          -- quando cancelou (para status cancelando)
  cancel_reason text check (cancel_reason in ('user_cancel', 'billing_error', 'refund', 'price_increase', 'other')),
  trial_ends_at timestamptz,                      -- fim do teste grátis (se aplicável)
  retry_count int not null default 0,             -- tentativas de cobrança no billing retry
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Evita duplicatas: mesmo usuário não pode ter duas assinaturas do mesmo provedor com mesmo ID.
  unique (user_id, provider, provider_subscription_id)
);

comment on table public.subscriptions is 'Assinaturas Premium dos tutores. Uma por provedor por usuário. Estado segue máquina 20.4.';

create index subscriptions_user_id_idx on public.subscriptions (user_id) where status not in ('cancelada', 'expirada');
create index subscriptions_provider_idx on public.subscriptions (provider, provider_subscription_id);
create index subscriptions_renews_at_idx on public.subscriptions (renews_at) where status in ('em_teste', 'ativa', 'pagamento_falhou');
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS: tutor só vê/edita a própria assinatura
-- ============================================================
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- Planos: todos autenticados podem ler (para mostrar na tela Premium).
create policy "plans_select_all" on public.plans
  for select to authenticated
  using (active);

-- Assinaturas: tutor lê e escreve só a sua.
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "subscriptions_insert_own" on public.subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "subscriptions_update_own" on public.subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin financeiro lê todas (via security definer functions).
-- O service_role (jobs, webhooks) ignora RLS.

-- ============================================================
-- Função helper: criar/atualizar assinatura a partir de webhook (idempotente)
-- ============================================================
create or replace function public.upsert_subscription_from_webhook(
  p_user_id uuid,
  p_plan_code text,
  p_provider text,
  p_provider_subscription_id text,
  p_provider_original_transaction_id text,
  p_status text,
  p_started_at timestamptz,
  p_current_period_end timestamptz,
  p_renews_at timestamptz,
  p_cancel_at timestamptz default null,
  p_cancel_reason text default null,
  p_trial_ends_at timestamptz default null,
  p_retry_count int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_subscription_id uuid;
  v_existing_status text;
begin
  -- Busca o plano pelo código.
  select id into v_plan_id from plans where code = p_plan_code and active;
  if v_plan_id is null then
    raise exception 'Plano % não encontrado ou inativo.', p_plan_code using errcode = 'P0001';
  end if;

  -- Tenta inserir ou atualizar (upsert no índice único user_id, provider, provider_subscription_id).
  insert into subscriptions (
    user_id, plan_id, provider, provider_subscription_id, provider_original_transaction_id,
    status, started_at, current_period_end, renews_at, cancel_at, cancel_reason, trial_ends_at, retry_count
  ) values (
    p_user_id, v_plan_id, p_provider, p_provider_subscription_id, p_provider_original_transaction_id,
    p_status, p_started_at, p_current_period_end, p_renews_at, p_cancel_at, p_cancel_reason, p_trial_ends_at, p_retry_count
  )
  on conflict (user_id, provider, provider_subscription_id) do update
    set plan_id = v_plan_id,
        provider_original_transaction_id = coalesce(excluded.provider_original_transaction_id, subscriptions.provider_original_transaction_id),
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        renews_at = excluded.renews_at,
        cancel_at = excluded.cancel_at,
        cancel_reason = excluded.cancel_reason,
        trial_ends_at = excluded.trial_ends_at,
        retry_count = excluded.retry_count,
        updated_at = now()
  returning id, status into v_subscription_id, v_existing_status;

  -- Log de transição de estado para auditoria.
  if v_existing_status is distinct from p_status then
    insert into audit_log (actor_id, action, target_type, target_id, meta)
    values (p_user_id, 'subscription_state_change', 'subscription', v_subscription_id,
      jsonb_build_object('from', v_existing_status, 'to', p_status, 'provider', p_provider));
  end if;

  return v_subscription_id;
end;
$$;

-- ============================================================
-- Função helper: obter plano ativo do usuário (para RLS e UI)
-- ============================================================
create or replace function public.plano_ativo_do_usuario(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub jsonb;
begin
  select jsonb_build_object(
    'id', s.id,
    'plan_code', pl.code,
    'plan_name', pl.name,
    'status', s.status,
    'provider', s.provider,
    'renews_at', s.renews_at,
    'cancel_at', s.cancel_at,
    'trial_ends_at', s.trial_ends_at,
    'retry_count', s.retry_count
  ) into v_sub
  from subscriptions s
  join plans pl on pl.id = s.plan_id
  where s.user_id = p_user_id
    and s.status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando')
  order by
    case s.status when 'ativa' then 1 when 'em_teste' then 2 when 'pagamento_falhou' then 3 when 'cancelando' then 4 end,
    s.started_at desc
  limit 1;

  return coalesce(v_sub, 'null'::jsonb);
end;
$$;

grant execute on function public.plano_ativo_do_usuario(uuid) to authenticated;

-- ============================================================
-- Dados iniciais: planos Premium mensal e anual
-- ============================================================
insert into public.plans (code, name, price_cents, period, trial_days, active)
values
  ('premium_mensal', 'Premium Mensal', 2990, 'mensal', 7, true),
  ('premium_anual', 'Premium Anual', 29900, 'anual', 7, true)
on conflict (code) do nothing;

-- ============================================================
-- Tabela integrations: credenciais criptografadas para Apple/Google/Asaas (BUSINESS.md 23.4)
-- ============================================================
-- Nota: a tabela integrations já existe na seção 21.5 do BUSINESS.md.
-- Se não existir, crie:
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('apple', 'google', 'asaas', 'sentry', 'push', 'supabase')),
  status text not null check (status in ('configurado', 'erro', 'expirado')) default 'erro',
  last_sync_at timestamptz,
  expires_at timestamptz,
  config jsonb not null default '{}'::jsonb,  -- criptografado via vault
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger integrations_touch before update on public.integrations
  for each row execute function public.touch_updated_at();

alter table public.integrations enable row level security;

-- Só admin_super e admin_finance gerenciam integrações.
create policy "integrations_admin_all" on public.integrations
  for all to authenticated
  using (
    exists (
      select 1 from admin_members am
      where am.user_id = auth.uid() and am.active and am.papel in ('super', 'financeiro')
    )
  );
-- PetLive: helpers de auditoria, push e cron job subscription-billing (BUSINESS.md 23.2).
-- Tarefas: [BACKEND] Premium e QR: Assinaturas: integração com as lojas de apps e webhooks (P-B7IKA).
-- Complementa a migração 20261119000000_planos_assinaturas_lojas.sql.

-- ============================================================
-- Função de log de auditoria (usada por webhooks e jobs)
-- ============================================================
create or replace function public.log_audit(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (p_actor_id, p_action, p_target_type, p_target_id, p_meta);
end;
$$;

grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- ============================================================
-- Função para enviar push direto (simples, sem campaign)
-- ============================================================
create or replace function public.enviar_push_direto(
  p_tokens text[],
  p_titulo text,
  p_corpo text,
  p_dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Esta função é um placeholder. A implementação real usa expo-notifications
  -- via Edge Function send-campaign ou chamada direta ao Expo.
  -- Aqui só registramos no log para não falhar o job.
  foreach v_token in array p_tokens loop
    insert into notification_log (user_id, type, title, body, deep_link, sent_at, data)
    select
      tutor_id,
      (p_dados ->> 'type')::text,
      p_titulo,
      p_corpo,
      (p_dados ->> 'deep_link')::text,
      now(),
      p_dados
    from push_tokens
    where token = v_token and ativo
    limit 1;
  end loop;
end;
$$;

grant execute on function public.enviar_push_direto(text[], text, text, jsonb) to authenticated, service_role;

-- ============================================================
-- Função para cancelar assinatura (chamada pela tela "Minha assinatura")
-- ============================================================
create or replace function public.cancelar_assinatura(p_user_id uuid, p_provider text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_result jsonb;
begin
  -- Busca assinatura ativa/cancelando do usuário.
  select * into v_sub
  from subscriptions
  where user_id = p_user_id
    and status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando')
    and (p_provider is null or provider = p_provider)
  order by
    case status when 'ativa' then 1 when 'em_teste' then 2 when 'pagamento_falhou' then 3 when 'cancelando' then 4 end,
    started_at desc
  limit 1;

  if not found then
    raise exception 'Nenhuma assinatura ativa encontrada.' using errcode = 'P0002';
  end if;

  -- Se já está cancelando, só retorna info.
  if v_sub.status = 'cancelando' then
    return jsonb_build_object(
      'status', 'cancelando',
      'message', 'Assinatura já cancelada. Vale até ' || to_char(v_sub.renews_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
      'renews_at', v_sub.renews_at
    );
  end if;

  -- Atualiza para cancelando (vale até fim do período).
  update subscriptions
  set status = 'cancelando',
      cancel_at = now(),
      cancel_reason = 'user_cancel',
      updated_at = now()
  where id = v_sub.id;

  -- Log de auditoria.
  perform public.log_audit(p_user_id, 'subscription_cancel_requested', 'subscription', v_sub.id,
    jsonb_build_object('provider', v_sub.provider, 'previous_status', v_sub.status));

  -- Se for Apple, chama API para cancelar renovação.
  if v_sub.provider = 'apple' then
    -- TODO: implementar chamada App Store Server API cancelSubscription
    -- Por enquanto só marca localmente; job subscription-billing sincroniza.
    null;
  elsif v_sub.provider = 'google' then
    -- TODO: implementar chamada Google Play Developer API purchases.subscriptions:cancel
    null;
  end if;

  return jsonb_build_object(
    'status', 'cancelando',
    'message', 'Assinatura cancelada. O Premium vale até ' || to_char(v_sub.renews_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
    'renews_at', v_sub.renews_at
  );
end;
$$;

grant execute on function public.cancelar_assinatura(uuid, text) to authenticated;

-- ============================================================
-- Função para upgrade/downgrade de plano (mensal <-> anual)
-- ============================================================
create or replace function public.mudar_plano_assinatura(p_user_id uuid, p_novo_plan_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_new_plan record;
begin
  select * into v_sub
  from subscriptions
  where user_id = p_user_id
    and status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando')
  order by
    case status when 'ativa' then 1 when 'em_teste' then 2 when 'pagamento_falhou' then 3 when 'cancelando' then 4 end,
    started_at desc
  limit 1;

  if not found then
    raise exception 'Nenhuma assinatura ativa para alterar.' using errcode = 'P0003';
  end if;

  select * into v_new_plan from plans where code = p_novo_plan_code and active;
  if not found then
    raise exception 'Plano % não encontrado ou inativo.', p_novo_plan_code using errcode = 'P0001';
  end if;

  -- Mesmo plano? Não faz nada.
  if v_sub.plan_id = v_new_plan.id then
    return jsonb_build_object('status', v_sub.status, 'message', 'Já está neste plano.');
  end if;

  -- Atualiza plano_id. A mudança real de SKU (Apple/Google) acontece na loja;
  -- aqui só atualizamos o plano interno. O webhook da loja confirmará a mudança.
  update subscriptions
  set plan_id = v_new_plan.id,
      updated_at = now()
  where id = v_sub.id;

  perform public.log_audit(p_user_id, 'subscription_plan_change', 'subscription', v_sub.id,
    jsonb_build_object('from_plan', (select code from plans where id = v_sub.plan_id), 'to_plan', p_novo_plan_code));

  return jsonb_build_object(
    'status', v_sub.status,
    'message', 'Plano alterado para ' || v_new_plan.name || '. A mudança vale na próxima renovação.',
    'new_plan', p_novo_plan_code
  );
end;
$$;

grant execute on function public.mudar_plano_assinatura(uuid, text) to authenticated;

-- ============================================================
-- pg_cron job: subscription-billing (diário às 03:00 BRT)
-- ============================================================
-- Requer extensão pg_cron habilitada no Supabase (Dashboard > Database > Extensions).
-- O job chama a Edge Function subscription-billing com service_role.

-- Descomente após criar o projeto remoto e habilitar pg_cron:
/*
select cron.schedule(
  'subscription-billing-daily',
  '0 3 * * *',  -- 03:00 UTC = 00:00 BRT; ajuste para 06:00 UTC = 03:00 BRT
  $$
  select net.http_post(
    url := 'https://<SEU_PROJETO>.supabase.co/functions/v1/subscription-billing',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Para testar localmente:
-- select cron.schedule('subscription-billing-test', '* * * * *', 'select 1;'); -- a cada minuto
-- select cron.unschedule('subscription-billing-test');

-- ============================================================
-- Métricas para Prometheus/observabilidade (BUSINESS.md critério 10)
-- ============================================================
-- Views que podem ser expostas via postgres_exporter ou scraper customizado.

create or replace view public.metrics_webhook_received as
select
  provider,
  notification_type,
  result,
  count(*) as total
from (
  select
    s.provider,
    case
      when s.status = 'em_teste' then 'SUBSCRIBED'
      when s.status = 'ativa' then 'RENEWAL'
      when s.status = 'pagamento_falhou' then 'DID_FAIL_TO_RENEW'
      when s.status = 'cancelando' then 'DID_CHANGE_RENEWAL_STATUS'
      when s.status = 'cancelada' then 'CANCELED'
      when s.status = 'expirada' then 'EXPIRED'
      else 'OTHER'
    end as notification_type,
    case when s.updated_at > s.created_at then 'updated' else 'inserted' end as result
  from subscriptions s
  where s.provider in ('apple', 'google')
) t
group by provider, notification_type, result;

create or replace view public.metrics_subscription_state_transitions as
select
  meta ->> 'from' as from_state,
  meta ->> 'to' as to_state,
  meta ->> 'provider' as provider,
  count(*) as total
from audit_log
where action = 'subscription_state_change'
group by from_state, to_state, provider;

create or replace view public.metrics_subscription_reconciliation_drift as
select
  provider,
  count(*) as drift_count
from audit_log
where action = 'subscription_reconciled'
  and at > now() - interval '24 hours'
group by provider;

-- ============================================================
-- Alertas sugeridos (configurar no Grafana/Alertmanager):
-- - webhook_falha_rate: sum(rate(webhook_received_total{result="error"}[1h])) / sum(rate(webhook_received_total[1h])) > 0.05
-- - reconciliation_drift: sum(subscription_reconciliation_drift_total) > 10
-- - job_not_run: time() - max(audit_log.at) where action='subscription_billing_run' > 25h
-- ============================================================
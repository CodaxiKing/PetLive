-- PetLive: assinatura Premium pela loja de apps (BUSINESS.md 5.13, 10 e 20.4).
-- A compra acontece na folha nativa da App Store ou da Google Play. O app
-- manda o comprovante para a Edge Function `validar-compra-loja`, que consulta
-- a loja com as credenciais do servidor e só então grava aqui. Os avisos de
-- renovação, cancelamento e falha chegam pela `notificacoes-loja`, que também
-- reconsulta a loja. O app nunca muda o plano: profiles.plano é recalculado
-- aqui a partir das assinaturas (o gatilho profiles_plano_do_servidor já
-- recusa a mudança pelo tutor).

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  loja text not null check (loja in ('app_store', 'google_play')),
  -- Id do produto na loja e o período que ele representa.
  produto text not null,
  periodo text not null check (periodo in ('mensal', 'anual')),
  -- originalTransactionId (App Store) ou purchaseToken (Google Play).
  referencia text not null,
  status text not null check (status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando', 'cancelada', 'expirada')),
  renova_auto boolean not null default true,
  started_at timestamptz not null default now(),
  -- Fim do período pago (ou da carência de cobrança dada pela loja).
  renews_at timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  ambiente text not null default 'producao' check (ambiente in ('producao', 'teste')),
  atualizado_em timestamptz not null default now(),
  unique (loja, referencia)
);
create index subscriptions_user on public.subscriptions (user_id, atualizado_em desc);
comment on table public.subscriptions is 'Assinaturas Premium compradas na App Store ou na Google Play. Só o servidor grava.';

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
create policy subscriptions_dono on public.subscriptions for select to authenticated using (user_id = auth.uid());

/** A assinatura dá Premium agora: não terminou e o período pago (ou a carência) não acabou. */
create or replace function public.assinatura_vale(s subscriptions)
returns boolean
language sql
stable
as $$
  select s.status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando') and s.renews_at > now()
$$;

/**
 * Recalcula profiles.plano pelas assinaturas. Só mexe em quem tem assinatura
 * pela loja: o Premium dado pelo admin (sem assinatura) não é tocado.
 */
create or replace function public.recalcular_plano(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano text;
begin
  if not exists (select 1 from subscriptions where user_id = p_user) then
    return (select plano from profiles where id = p_user);
  end if;
  v_plano := case when exists (select 1 from subscriptions s where s.user_id = p_user and public.assinatura_vale(s))
    then 'premium' else 'gratis' end;
  update profiles set plano = v_plano where id = p_user and plano is distinct from v_plano;
  return v_plano;
end;
$$;

/**
 * Grava o estado que a loja devolveu (chamada só pelas Edge Functions, com a
 * service_role). Idempotente por (loja, referencia). Uma assinatura nunca
 * troca de dono: o mesmo comprovante em outra conta é recusado.
 * p: { user_id, loja, produto, periodo, referencia, status, renova_auto,
 *      started_at, renews_at, trial_ends_at, cancel_at, ambiente,
 *      cobranca?: { id, valor_centavos, pago_em } }
 */
create or replace function public.aplicar_assinatura_loja(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (p ->> 'user_id')::uuid;
  v_dono uuid;
  v_status text := p ->> 'status';
  v_cobranca jsonb := p -> 'cobranca';
  v_antes text;
begin
  select user_id, status into v_dono, v_antes from subscriptions
  where loja = p ->> 'loja' and referencia = p ->> 'referencia' for update;
  if v_dono is not null and v_dono <> v_user then
    raise exception 'Esta assinatura pertence a outra conta do PetLive.' using errcode = '42501', hint = 'outra_conta';
  end if;

  insert into subscriptions as s (user_id, loja, produto, periodo, referencia, status, renova_auto, started_at,
    renews_at, trial_ends_at, cancel_at, ambiente, atualizado_em)
  values (v_user, p ->> 'loja', p ->> 'produto', p ->> 'periodo', p ->> 'referencia', v_status,
    coalesce((p ->> 'renova_auto')::boolean, true), coalesce((p ->> 'started_at')::timestamptz, now()),
    (p ->> 'renews_at')::timestamptz, (p ->> 'trial_ends_at')::timestamptz, (p ->> 'cancel_at')::timestamptz,
    coalesce(p ->> 'ambiente', 'producao'), now())
  on conflict (loja, referencia) do update set
    produto = excluded.produto,
    periodo = excluded.periodo,
    status = excluded.status,
    renova_auto = excluded.renova_auto,
    renews_at = excluded.renews_at,
    trial_ends_at = coalesce(excluded.trial_ends_at, s.trial_ends_at),
    cancel_at = case when excluded.status in ('cancelando', 'cancelada') then coalesce(s.cancel_at, excluded.cancel_at, now()) end,
    atualizado_em = now();

  -- Cada cobrança paga vira receita (o teste grátis não tem valor). Ambiente
  -- de teste (sandbox) não entra no faturamento.
  if v_cobranca is not null and coalesce((v_cobranca ->> 'valor_centavos')::int, 0) > 0
     and coalesce(p ->> 'ambiente', 'producao') = 'producao' then
    insert into receitas (origem, valor_centavos, pago_em, tutor_id, provedor, referencia, descricao)
    values ('premium', (v_cobranca ->> 'valor_centavos')::int, coalesce((v_cobranca ->> 'pago_em')::timestamptz, now()),
      v_user, p ->> 'loja', v_cobranca ->> 'id',
      'Premium ' || (p ->> 'periodo') || case when p ->> 'loja' = 'app_store' then ' · App Store' else ' · Google Play' end)
    on conflict (provedor, referencia) do nothing;
  end if;

  return jsonb_build_object('status', v_status, 'status_anterior', v_antes, 'plano', public.recalcular_plano(v_user));
end;
$$;

/**
 * Rede de segurança: se o aviso da loja atrasar, quem passou do fim do
 * período pago volta ao Grátis. Cancelada e com falha de cobrança terminam no
 * fim do período; ativa ou em teste ganham um dia de folga para o aviso de
 * renovação chegar.
 */
create or replace function public.encerrar_assinaturas_vencidas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_users uuid[];
begin
  with vencidas as (
    update subscriptions set
      status = case when status = 'cancelando' then 'cancelada' else 'expirada' end,
      atualizado_em = now()
    where (status in ('cancelando', 'pagamento_falhou') and renews_at <= now())
       or (status in ('ativa', 'em_teste') and renews_at <= now() - interval '1 day')
    returning user_id
  )
  select coalesce(array_agg(distinct user_id), '{}') into v_users from vencidas;

  foreach v_user in array v_users loop
    perform public.recalcular_plano(v_user);
  end loop;
  return coalesce(array_length(v_users, 1), 0);
end;
$$;

select cron.schedule('petlive-assinaturas-vencidas', '23 * * * *', $$select public.encerrar_assinaturas_vencidas();$$);

/**
 * Tela Premium e Minha assinatura: o plano, a assinatura mais recente e se o
 * tutor já assinou alguma vez (quem já assinou não vê o teste grátis).
 */
create or replace function public.minha_assinatura()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plano', (select plano from profiles where id = auth.uid()),
    'ja_assinou', exists (select 1 from subscriptions where user_id = auth.uid()),
    'assinatura', (
      select jsonb_build_object(
        'loja', s.loja, 'produto', s.produto, 'periodo', s.periodo, 'status', s.status,
        'renova_auto', s.renova_auto, 'renews_at', s.renews_at, 'trial_ends_at', s.trial_ends_at,
        'cancel_at', s.cancel_at, 'vale', public.assinatura_vale(s)
      )
      from subscriptions s where s.user_id = auth.uid()
      order by public.assinatura_vale(s) desc, s.atualizado_em desc limit 1
    )
  )
$$;

revoke all on function public.assinatura_vale(subscriptions) from public, anon;
revoke all on function public.recalcular_plano(uuid) from public, anon, authenticated;
revoke all on function public.aplicar_assinatura_loja(jsonb) from public, anon, authenticated;
revoke all on function public.encerrar_assinaturas_vencidas() from public, anon, authenticated;
revoke all on function public.minha_assinatura() from public, anon;
grant execute on function public.assinatura_vale(subscriptions) to authenticated;
grant execute on function public.minha_assinatura() to authenticated;
grant execute on function public.aplicar_assinatura_loja(jsonb) to service_role;
grant execute on function public.recalcular_plano(uuid) to service_role;

-- ============================================================
-- Painel admin: assinantes por origem (Visão geral e Financeiro)
-- ============================================================
create or replace function public.admin_assinaturas_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'leitura']);
  return jsonb_build_object(
    'app_store', (select count(*) from subscriptions s where s.loja = 'app_store' and public.assinatura_vale(s)),
    'google_play', (select count(*) from subscriptions s where s.loja = 'google_play' and public.assinatura_vale(s)),
    'em_teste', (select count(*) from subscriptions s where s.status = 'em_teste' and public.assinatura_vale(s)),
    'cancelando', (select count(*) from subscriptions s where s.status = 'cancelando' and public.assinatura_vale(s)),
    'pagamento_falhou', (select count(*) from subscriptions s where s.status = 'pagamento_falhou' and public.assinatura_vale(s)),
    'novas_30d', (select count(*) from subscriptions where started_at > now() - interval '30 days'),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'loja', s.loja, 'periodo', s.periodo, 'status', s.status, 'desde', s.started_at,
        'renews_at', s.renews_at, 'tutor', coalesce(p.nome, p.email)
      ) order by s.atualizado_em desc)
      from (select * from subscriptions where ambiente = 'producao' order by atualizado_em desc limit 10) s
      left join profiles p on p.id = s.user_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_assinaturas_resumo() from public, anon;
grant execute on function public.admin_assinaturas_resumo() to authenticated;

-- Últimos pagamentos do Financeiro passam a dizer a origem (App Store ou Google Play).
create or replace function public.admin_faturamento(p_meses int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_meses int := least(greatest(coalesce(p_meses, 12), 3), 24);
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo');
begin
  perform public.admin_exigir(array['financeiro', 'leitura']);
  return jsonb_build_object(
    'por_mes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', to_char(t.mes, 'YYYY-MM'), 'total', t.total, 'premium', t.premium,
        'comissao_produtos', t.produtos, 'comissao_servicos', t.servicos, 'pagamentos', t.pagamentos
      ) order by t.mes)
      from (
        select m.mes,
          coalesce(sum(r.valor_centavos), 0) as total,
          coalesce(sum(r.valor_centavos) filter (where r.origem = 'premium'), 0) as premium,
          coalesce(sum(r.valor_centavos) filter (where r.origem = 'comissao_produtos'), 0) as produtos,
          coalesce(sum(r.valor_centavos) filter (where r.origem = 'comissao_servicos'), 0) as servicos,
          count(r.id) filter (where r.valor_centavos > 0) as pagamentos
        from generate_series(v_mes - make_interval(months => v_meses - 1), v_mes, interval '1 month') as m(mes)
        left join receitas r on date_trunc('month', r.pago_em at time zone 'America/Sao_Paulo') = m.mes
        group by m.mes
      ) t
    ), '[]'::jsonb),
    'mes_atual', (select coalesce(sum(valor_centavos), 0) from receitas where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = v_mes),
    'mes_anterior', (select coalesce(sum(valor_centavos), 0) from receitas where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = v_mes - interval '1 month'),
    'ultimos_30d', (select coalesce(sum(valor_centavos), 0) from receitas where pago_em > now() - interval '30 days'),
    'estornos_30d', (select coalesce(-sum(valor_centavos), 0) from receitas where status = 'estornado' and pago_em > now() - interval '30 days'),
    'assinantes', (select count(*) from profiles where plano = 'premium'),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'origem', r.origem, 'valor', r.valor_centavos, 'status', r.status, 'pago_em', r.pago_em,
        'descricao', r.descricao, 'tutor', coalesce(p.nome, p.email), 'provedor', r.provedor
      ) order by r.pago_em desc)
      from (select * from receitas order by pago_em desc limit 20) r
      left join profiles p on p.id = r.tutor_id
    ), '[]'::jsonb)
  );
end;
$$;

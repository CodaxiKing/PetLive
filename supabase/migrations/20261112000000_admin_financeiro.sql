-- PetLive: faturamento no painel admin (protótipo AdminFinanceiro e card de
-- receita da Visão geral). Cada entrada de dinheiro vira uma linha em
-- `receitas`: Premium (Fase 2, pelo webhook do Asaas ou da loja de apps) e
-- comissões do marketplace (Fase 3). Ninguém insere pela API: só o servidor.

create table public.receitas (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('premium', 'comissao_produtos', 'comissao_servicos')),
  valor_centavos int not null check (valor_centavos <> 0),
  -- Estorno entra como linha negativa com status estornado.
  status text not null default 'pago' check (status in ('pago', 'estornado')),
  pago_em timestamptz not null default now(),
  tutor_id uuid references public.profiles (id) on delete set null,
  -- Id da cobrança no provedor (Asaas, Google Play, App Store): evita lançar duas vezes.
  provedor text,
  referencia text,
  descricao text,
  criado_em timestamptz not null default now(),
  unique (provedor, referencia)
);
create index receitas_pago_em on public.receitas (pago_em);
alter table public.receitas enable row level security;
revoke all on public.receitas from anon, authenticated;

/**
 * Faturamento por mês (últimos p_meses, mês atual incluído), por origem, e
 * os números do topo: mês atual, mês anterior e 30 dias.
 */
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
        'descricao', r.descricao, 'tutor', coalesce(p.nome, p.email)
      ) order by r.pago_em desc)
      from (select * from receitas order by pago_em desc limit 20) r
      left join profiles p on p.id = r.tutor_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_faturamento(int) from public, anon;
grant execute on function public.admin_faturamento(int) to authenticated;

-- A Visão geral também mostra a receita do mês (papéis que já veem a visão).
create or replace function public.admin_receita_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mes timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo');
begin
  perform public.admin_exigir(array['financeiro', 'leitura']);
  return jsonb_build_object(
    'mes_atual', (select coalesce(sum(valor_centavos), 0) from receitas where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = v_mes),
    'mes_anterior', (select coalesce(sum(valor_centavos), 0) from receitas where date_trunc('month', pago_em at time zone 'America/Sao_Paulo') = v_mes - interval '1 month')
  );
end;
$$;
revoke all on function public.admin_receita_resumo() from public, anon;
grant execute on function public.admin_receita_resumo() to authenticated;

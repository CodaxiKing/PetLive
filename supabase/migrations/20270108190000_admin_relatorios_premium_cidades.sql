-- Relatórios do admin (BUSINESS.md 12): funil até o Premium (teste grátis e
-- primeiro pagamento) e onde estão os tutores, pela cidade do perfil. Bairro
-- não é coletado; a cidade é o recorte mais fino que existe.

create or replace function public.admin_relatorios(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 730));
begin
  perform public.admin_exigir(array['financeiro', 'marketing', 'leitura']);
  return jsonb_build_object(
    -- Funil de quem criou a conta no período.
    'funil', (
      select jsonb_build_object(
        'contas', count(*),
        'com_pet', count(*) filter (where exists (select 1 from pets p where p.tutor_id = c.id)),
        'com_vacina', count(*) filter (where exists (
          select 1 from vaccinations v join pets p on p.id = v.pet_id where p.tutor_id = c.id
        )),
        'com_lembrete', count(*) filter (where exists (select 1 from reminders r where r.tutor_id = c.id)),
        'voltou_7d', count(*) filter (where exists (
          select 1 from eventos_uso e
          where e.user_id = c.id and e.evento = 'app_aberto' and e.ocorreu_em >= c.criado_em + interval '7 days'
        )),
        -- Até o Premium: começou o teste grátis e pagou ao menos um período.
        'premium_teste', count(*) filter (where exists (select 1 from subscriptions s where s.tutor_id = c.id)),
        'premium_pago', count(*) filter (where exists (
          select 1 from subscriptions s where s.tutor_id = c.id and s.status <> 'em_teste'
            and not (s.status in ('cancelada', 'expirada') and coalesce(s.valor_centavos, 0) = 0)
        ))
      )
      from profiles c where c.criado_em >= v_desde
    ),
    -- Retenção por mês de entrada, nos últimos 6 meses: % da turma que abriu
    -- o app em cada mês seguinte. O mês 0 é a própria entrada (100%).
    'retencao', coalesce((
      select jsonb_agg(jsonb_build_object('mes', t.mes, 'tutores', t.tutores, 'meses', t.meses) order by t.mes)
      from (
        select m.mes, count(c.id) as tutores, (
          select jsonb_agg(
            case when k = 0 then 100
            else round(100.0 * (
              select count(distinct e.user_id) from eventos_uso e
              join profiles c2 on c2.id = e.user_id
              where e.evento = 'app_aberto'
                and date_trunc('month', c2.criado_em) = m.mes
                and date_trunc('month', e.ocorreu_em) = m.mes + make_interval(months => k)
            ) / nullif(count(c.id), 0)) end
            order by k
          )
          from generate_series(0, (extract(year from age(date_trunc('month', now()), m.mes)) * 12
            + extract(month from age(date_trunc('month', now()), m.mes)))::int) k
        ) as meses
        from (
          select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as mes
        ) m
        left join profiles c on date_trunc('month', c.criado_em) = m.mes
        group by m.mes
      ) t
    ), '[]'::jsonb),
    -- Onde estão os tutores (cidade do perfil), sem nomes. Cidades com menos de 5 tutores ficam juntas em "Outras".
    'cidades', coalesce((
      select jsonb_agg(jsonb_build_object('cidade', z.cidade, 'tutores', z.tutores, 'premium', z.premium) order by z.outras, z.tutores desc)
      from (
        select case when y.tutores >= 5 then y.cidade else 'Outras' end as cidade, y.tutores < 5 as outras,
               sum(y.tutores)::int as tutores, sum(y.premium)::int as premium
        from (
          select min(btrim(c.cidade)) as cidade, count(*) as tutores, count(*) filter (where c.plano = 'premium') as premium
          from profiles c where nullif(btrim(c.cidade), '') is not null
          group by lower(btrim(c.cidade))
        ) y
        group by 1, 2
      ) z
    ), '[]'::jsonb),
    'sem_cidade', (select count(*) from profiles where nullif(btrim(cidade), '') is null),
    -- Dias entre cadastrar o pet e registrar a 1ª vacina (mediana).
    'dias_ate_vacina', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (v.primeira - p.criado_em)) / 86400))::numeric, 1)
      from pets p
      join (select pet_id, min(criado_em) as primeira from vaccinations group by pet_id) v on v.pet_id = p.id
      where p.criado_em >= v_desde
    ),
    'pets_com_vacina_pct', (
      select round(100.0 * count(*) filter (where exists (select 1 from vaccinations v where v.pet_id = p.id)) / nullif(count(*), 0))
      from pets p where p.ativo
    ),
    'especies', jsonb_build_object(
      'cao', (select count(*) from pets where ativo and especie = 'cao'),
      'gato', (select count(*) from pets where ativo and especie = 'gato')
    ),
    -- No lugar de "tutores por bairro" (o app não pede endereço): raças mais comuns.
    'racas', coalesce((
      select jsonb_agg(jsonb_build_object('raca', r.raca, 'pets', r.pets, 'pct', r.pct) order by r.pets desc)
      from (
        select coalesce(nullif(trim(raca), ''), 'Sem raça definida') as raca, count(*) as pets,
          round(100.0 * count(*) / sum(count(*)) over ()) as pct
        from pets where ativo group by 1 order by 2 desc limit 5
      ) r
    ), '[]'::jsonb),
    -- Novas contas por dia no período (para o CSV e o gráfico).
    'contas_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'contas', coalesce(n.contas, 0)) order by d.dia)
      from (select generate_series(v_desde::date, current_date, interval '1 day')::date as dia) d
      left join (select criado_em::date as dia, count(*) as contas from profiles group by 1) n using (dia)
    ), '[]'::jsonb)
  );
end;
$$;

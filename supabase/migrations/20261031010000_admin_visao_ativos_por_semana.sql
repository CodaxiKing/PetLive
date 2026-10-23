-- Corrige o resumo do painel: a tela de Visão geral precisa do conjunto
-- semanal para renderizar o gráfico de tutores ativos.
create or replace function public.admin_visao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'tutores', (select count(*) from profiles),
    'tutores_novos_30d', (select count(*) from profiles where criado_em > now() - interval '30 days'),
    'ativos_7d', (select count(distinct user_id) from eventos_uso where evento = 'app_aberto' and ocorreu_em > now() - interval '7 days'),
    'ativos_30d', (select count(distinct user_id) from eventos_uso where evento = 'app_aberto' and ocorreu_em > now() - interval '30 days'),
    'pets', (select count(*) from pets where ativo),
    'pets_caes', (select count(*) from pets where ativo and especie = 'cao'),
    'pets_gatos', (select count(*) from pets where ativo and especie = 'gato'),
    'lembretes_concluidos_30d', (select count(*) from eventos_uso where evento = 'lembrete_concluido' and ocorreu_em > now() - interval '30 days'),
    'doses_confirmadas_30d', (select count(*) from medication_doses where confirmada_em > now() - interval '30 days'),
    'doses_pela_notificacao_30d', (select count(*) from medication_doses where confirmada_em > now() - interval '30 days' and origem = 'notificacao'),
    'sos_30d', (select count(*) from eventos_uso where evento = 'sos_aberto' and ocorreu_em > now() - interval '30 days'),
    'sos_ligacoes_30d', (select count(*) from eventos_uso where evento = 'sos_ligou' and ocorreu_em > now() - interval '30 days'),
    'com_lembrete_ativo', (select count(distinct tutor_id) from reminders where ativo),
    'atencao', jsonb_build_object(
      'indicacoes_em_analise', (select count(*) from sugestoes_lugar where status = 'em_analise'),
      'lgpd_pendentes', (select count(*) from lgpd_requests where status not in ('concluido', 'cancelado')),
      'contatos_7d', (select count(*) from site_contacts where criado_em > now() - interval '7 days'),
      'lojistas_interessados', (select count(*) from site_contacts where tipo = 'lojista')
    ),
    'ativos_por_semana', (
      select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'tutores', coalesce(a.tutores, 0)) order by s.semana), '[]'::jsonb)
      from (
        select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week')::date as semana
      ) s
      left join (
        select date_trunc('week', ocorreu_em)::date as semana, count(distinct user_id) as tutores
        from eventos_uso where evento = 'app_aberto' group by 1
      ) a using (semana)
    )
  );
end;
$$;

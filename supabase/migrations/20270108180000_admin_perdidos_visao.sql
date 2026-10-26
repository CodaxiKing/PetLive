-- Painel admin (BUSINESS.md 5.29 e 12): pets perdidos na Moderação (ver os
-- alertas e encerrar um alerta abusivo, avisando o tutor) e os números de
-- assinantes e de pets perdidos na Visão geral.

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
    'assinantes', (select count(*) from profiles where plano = 'premium'),
    'perdidos', jsonb_build_object(
      'ativos', (select count(*) from lost_alerts where status = 'ativo'),
      'encontrados_30d', (select count(*) from lost_alerts where status = 'encontrado' and encerrado_em > now() - interval '30 days'),
      'avistamentos_7d', (select count(*) from lost_alert_sightings where criado_em > now() - interval '7 days')
    ),
    'atencao', jsonb_build_object(
      'indicacoes_em_analise', (select count(*) from sugestoes_lugar where status = 'em_analise'),
      'lgpd_pendentes', (select count(*) from lgpd_requests where status not in ('concluido', 'cancelado')),
      'contatos_7d', (select count(*) from site_contacts where criado_em > now() - interval '7 days'),
      'lojistas_interessados', (select count(*) from site_contacts where tipo = 'lojista'),
      'perdidos_ativos', (select count(*) from lost_alerts where status = 'ativo')
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

create or replace function public.admin_perdidos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['moderacao', 'suporte', 'leitura']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'status', a.status, 'pet', p.nome, 'especie', p.especie, 'foto', p.foto_url,
      'tutor', coalesce(pr.nome, split_part(u.email, '@', 1)), 'mensagem', a.mensagem, 'raio_km', a.raio_km,
      'lat', round(a.lat::numeric, 3), 'lng', round(a.lng::numeric, 3),
      'mostrar_telefone', a.mostrar_telefone, 'reconhecimento', a.reconhecimento,
      'criado_em', a.criado_em, 'expira_em', a.expira_em, 'encerrado_em', a.encerrado_em,
      'avisados', (select count(*) from lost_alert_receipts r where r.alert_id = a.id),
      'avistamentos', (select count(*) from lost_alert_sightings s where s.alert_id = a.id),
      'alertas_do_tutor_30d', (select count(*) from lost_alerts x where x.tutor_id = a.tutor_id and x.criado_em > now() - interval '30 days')
    ) order by (a.status = 'ativo') desc, a.criado_em desc)
    from (select * from lost_alerts where status = 'ativo' or criado_em > now() - interval '30 days' order by criado_em desc limit 200) a
    join pets p on p.id = a.pet_id
    left join profiles pr on pr.id = a.tutor_id
    left join auth.users u on u.id = a.tutor_id), '[]'::jsonb);
end;
$$;

-- Encerra um alerta abusivo (pet que não é do tutor, texto ofensivo, golpe) e avisa o tutor com o motivo.
create or replace function public.admin_perdido_encerrar(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare a lost_alerts;
begin
  perform public.admin_exigir(array['moderacao']);
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escreva o motivo: o tutor vê no app.'; end if;
  update lost_alerts set status = 'encerrado', encerrado_em = now() where id = p_id and status = 'ativo' returning * into a;
  if a.id is null then raise exception 'Este alerta já não está ativo.'; end if;
  insert into notification_log (user_id, pet_id, type, title, body, deep_link)
  values (a.tutor_id, a.pet_id, 'perdido', 'Alerta encerrado pela equipe',
          'Encerramos o alerta de pet perdido: ' || left(btrim(p_motivo), 200) || '. Fale com o suporte se for engano.', '/pet-perdido/' || a.id);
  perform public.admin_registrar('encerrou alerta de pet perdido', 'lost_alerts', a.id::text, jsonb_build_object('motivo', left(btrim(p_motivo), 200)));
end;
$$;

revoke all on function public.admin_perdidos(), public.admin_perdido_encerrar(uuid, text) from public, anon;
grant execute on function public.admin_perdidos(), public.admin_perdido_encerrar(uuid, text) to authenticated;

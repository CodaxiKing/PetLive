insert into public.events(id, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng, vagas, status)
values ('60000000-0000-4000-8000-000000000001', 'Presença segura', 'encontro', 'Encontro em parque público',
  now() + interval '2 hours', now() + interval '3 hours', 'Parque', -22, -43, 1, 'publicado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
declare v jsonb; v_id uuid := '60000000-0000-4000-8000-000000000001';
begin
  v := public.evento_definir_presenca(v_id, true);
  if (v->>'eu_vou')::boolean is distinct from true or (v->>'confirmados')::int is distinct from 1 then
    raise exception 'Presença não refletida na ficha';
  end if;
  v := public.evento_definir_presenca(v_id, true);
  if (v->>'eu_vou')::boolean is distinct from true or (v->>'confirmados')::int is distinct from 1 then
    raise exception 'Repetição desfez ou duplicou confirmação';
  end if;
  if (select count(*) from public.notification_log where deep_link = '/eventos/' || v_id) <> 1 then
    raise exception 'Repetição duplicou aviso';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
do $$
declare v_id uuid := '60000000-0000-4000-8000-000000000001';
begin
  if (public.evento_detalhe(v_id)->>'eu_vou')::boolean is distinct from false then
    raise exception 'Presença de outra pessoa vazou';
  end if;
  begin
    perform public.evento_definir_presenca(v_id, true);
    raise exception 'Lotação ultrapassada';
  exception when raise_exception then
    if sqlerrm <> 'As vagas deste evento estão esgotadas.' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
declare v jsonb; v_id uuid := '60000000-0000-4000-8000-000000000001';
begin
  perform public.evento_definir_presenca(v_id, false);
  v := public.evento_definir_presenca(v_id, false);
  if (v->>'eu_vou')::boolean is distinct from false or (v->>'confirmados')::int is distinct from 0 then
    raise exception 'Cancelamento não idempotente';
  end if;
end;
$$;
reset role;
select public.eventos_enviar_lembretes();
select pg_temp.conferir(not exists(select 1 from public.event_reminder_deliveries
  where event_id = '60000000-0000-4000-8000-000000000001'), 'Cancelamento gerou lembretes');
set local role authenticated;
select public.evento_definir_presenca('60000000-0000-4000-8000-000000000001', true) is not null;
reset role;
select public.eventos_enviar_lembretes();
select pg_temp.conferir((select count(*) = 1 from public.event_reminder_deliveries
  where event_id = '60000000-0000-4000-8000-000000000001'), 'Reconfirmação não recebeu lembrete pendente');
set local role authenticated;
select public.evento_definir_presenca('60000000-0000-4000-8000-000000000001', false) is not null;
select public.evento_definir_presenca('60000000-0000-4000-8000-000000000001', true) is not null;
reset role;
select public.eventos_enviar_lembretes();
select pg_temp.conferir((select count(*) = 2 from pushes_eventos
  where body #>> '{data,event_id}' = '60000000-0000-4000-8000-000000000001'), 'Reconfirmação duplicou push já enviado');
select pg_temp.conferir(not has_function_privilege('anon', 'public.evento_definir_presenca(uuid,boolean)', 'EXECUTE'), 'Visitante pode alterar presença');
select 'OK: presença idempotente, lotação, privacidade e lembretes após cancelamento' as resultado;

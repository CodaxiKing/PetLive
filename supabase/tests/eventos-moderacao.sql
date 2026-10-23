-- Complementa eventos.sql: moderação exige papel e sessão com 2FA.
insert into auth.users(id, email, raw_user_meta_data) values
  ('40000000-0000-4000-8000-000000000001', 'moderador-evento@example.invalid', '{"nome":"Moderação"}');
insert into public.admin_members(user_id, papel)
values ('40000000-0000-4000-8000-000000000001', 'moderacao');
insert into public.events(id, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng)
values ('40000000-0000-4000-8000-000000000002', 'Evento para moderar', 'encontro',
  'Encontro em parque público', now() + interval '2 days', now() + interval '2 days 1 hour', 'Parque', -22, -43);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
begin
  begin
    perform public.admin_eventos();
    raise exception 'Moderador sem 2FA acessou fila';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","aal":"aal2"}', true);
do $$
declare v_id uuid := '40000000-0000-4000-8000-000000000002';
begin
  if jsonb_array_length(public.admin_eventos()->'itens') < 1 then raise exception 'Fila vazia'; end if;
  begin
    perform public.evento_moderar(v_id, 'recusado');
    raise exception 'Recusa sem motivo aceita';
  exception when raise_exception then
    if sqlerrm <> 'Informe o motivo da decisão.' then raise; end if;
  end;
  perform public.evento_moderar(v_id, 'publicado');
  perform public.evento_moderar(v_id, 'oculto', 'Revisar denúncia');
  perform public.evento_moderar(v_id, 'revisado');
  perform public.evento_moderar(v_id, 'ajuste_solicitado', 'Detalhar o local');
  perform public.evento_moderar(v_id, 'recusado', 'Local inadequado');
  begin
    perform public.evento_moderar(v_id, 'publicado');
    raise exception 'Recusado foi republicado';
  exception when raise_exception then
    if sqlerrm <> 'Esta ação não é permitida no estado atual do evento.' then raise; end if;
  end;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.event_moderation_actions where event_id = '40000000-0000-4000-8000-000000000002') <> 5 then
    raise exception 'Histórico de decisões incorreto';
  end if;
  if (select count(*) from public.audit_log where alvo_id = '40000000-0000-4000-8000-000000000002') <> 5 then
    raise exception 'Auditoria incompleta';
  end if;
end;
$$;
update public.admin_members set papel = 'leitura' where user_id = '40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
begin
  perform public.admin_eventos('recusado');
  begin
    perform public.evento_moderar('40000000-0000-4000-8000-000000000002', 'publicado');
    raise exception 'Leitura conseguiu moderar';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'OK: fila, 2FA, permissões, decisões, motivos e auditoria' as resultado;

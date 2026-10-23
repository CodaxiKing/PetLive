insert into public.organizers(user_id, nome_publico, verificado, verificado_em)
values ('40000000-0000-4000-8000-000000000001', 'Parque Pet', true, now());
insert into public.events(id, organizador_id, criado_por, titulo, tipo, descricao,
  inicio_em, fim_em, local_nome, lat, lng, vagas, status, gratuito, preco_centavos, ingresso_url)
values ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001', 'Ficha pública', 'encontro', 'Encontro em parque público',
  now() + interval '2 days', now() + interval '2 days 1 hour', 'Parque Pet', -22, -43, 20,
  'publicado', false, 2500, 'https://example.invalid/ingresso');
insert into public.event_rsvps(event_id, user_id)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
do $$
declare v jsonb;
begin
  v := public.evento_detalhe('50000000-0000-4000-8000-000000000001');
  if v->>'organizador' <> 'Parque Pet' or (v->>'organizador_verificado')::boolean is not true
    or (v->>'confirmados')::int <> 1 or (v->>'preco_centavos')::int <> 2500
    or (v->>'vagas')::int <> 20 then raise exception 'Ficha incompleta'; end if;
  if v ?| array['user_id','organizador_id','criado_por','participantes','email','telefone'] then
    raise exception 'Ficha expôs dados privados';
  end if;
  if public.evento_detalhe('00000000-0000-4000-8000-000000000000') is not null then
    raise exception 'ID inexistente retornou ficha';
  end if;
end;
$$;
reset role;
do $$
declare v_status text;
begin
  foreach v_status in array array['em_analise','ajuste_solicitado','recusado','cancelado','encerrado','oculto'] loop
    update public.events set status = v_status where id = '50000000-0000-4000-8000-000000000001';
    if public.evento_detalhe('50000000-0000-4000-8000-000000000001') is not null then
      raise exception 'Ficha de evento privado exposta: %', v_status;
    end if;
  end loop;
  update public.events set status = 'publicado', inicio_em = now() - interval '2 hours', fim_em = now() - interval '1 hour'
  where id = '50000000-0000-4000-8000-000000000001';
  if public.evento_detalhe('50000000-0000-4000-8000-000000000001') is not null then
    raise exception 'Evento vencido exposto antes do cron';
  end if;
  if has_function_privilege('anon', 'public.evento_detalhe(uuid)', 'EXECUTE') then
    raise exception 'Visitante tem acesso à consulta do app';
  end if;
end;
$$;
select 'OK: ficha, organizador, contagem, preço e privacidade' as resultado;

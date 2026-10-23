-- Executar depois da migração de eventos, dentro de BEGIN/ROLLBACK.
-- Usuários descartáveis: não depende de seed nem envia push.
insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'evento-teste-1@example.invalid', '{"nome":"Teste eventos"}'),
  ('10000000-0000-4000-8000-000000000002', 'evento-teste-2@example.invalid', '{"nome":"Teste verificado"}');

create function pg_temp.criar_evento(p_oficial boolean default false)
returns uuid language sql as $$
  select public.evento_criar('Encontro pet', 'encontro', 'Encontro em local público',
    now() + interval '2 days', now() + interval '2 days 2 hours', 'Parque público',
    p_lat => -22.9, p_lng => -43.2, p_oficial => p_oficial)
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
declare v_id uuid;
begin
  v_id := pg_temp.criar_evento();
  if (select status from public.events where id = v_id) <> 'em_analise' then
    raise exception 'Usuário comum publicou sem análise';
  end if;
  begin
    perform pg_temp.criar_evento(true);
    raise exception 'Oficial sem admin foi aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organizers(user_id, nome_publico, verificado, verificado_em)
      values (auth.uid(), 'Autoverificação', true, now());
    raise exception 'Autoverificação foi aceita';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.criar_evento();
  perform pg_temp.criar_evento();
  begin
    perform pg_temp.criar_evento();
    raise exception 'Quarto evento foi aceito';
  exception when raise_exception then
    if sqlerrm <> 'Você atingiu o limite de 3 eventos neste mês.' then raise; end if;
  end;
end;
$$;
reset role;

insert into public.organizers(user_id, nome_publico, verificado, verificado_em)
  values ('10000000-0000-4000-8000-000000000002', 'Organizador verificado', true, now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
do $$
declare v_id uuid;
begin
  if exists(select 1 from public.events where criado_por <> auth.uid()) then
    raise exception 'Evento em análise vazou para outro usuário';
  end if;
  v_id := pg_temp.criar_evento();
  if (select status from public.events where id = v_id) <> 'publicado' then
    raise exception 'Verificado não publicou direto';
  end if;
  if (select oficial from public.events where id = v_id) then
    raise exception 'Verificado virou evento oficial';
  end if;
  perform pg_temp.criar_evento();
  perform pg_temp.criar_evento();
  begin
    perform pg_temp.criar_evento();
    raise exception 'Verificado ultrapassou limite mensal';
  exception when raise_exception then
    if sqlerrm <> 'Você atingiu o limite de 3 eventos neste mês.' then raise; end if;
  end;
end;
$$;
reset role;

-- Revogação da verificação passa a valer imediatamente; mês anterior
-- não consome cota, mas cancelamento no mês atual continua consumindo.
update public.events set criado_em = date_trunc('month', now() at time zone 'America/Sao_Paulo')
  at time zone 'America/Sao_Paulo' - interval '1 second'
  where criado_por = '10000000-0000-4000-8000-000000000002';
update public.organizers set verificado = false, verificado_em = null
  where user_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$
declare v_id uuid;
begin
  v_id := pg_temp.criar_evento();
  if (select status from public.events where id = v_id) <> 'em_analise' then
    raise exception 'Verificação revogada continuou publicando direto';
  end if;
  perform public.evento_cancelar(v_id);
  perform pg_temp.criar_evento();
  perform pg_temp.criar_evento();
  begin
    perform pg_temp.criar_evento();
    raise exception 'Cancelamento liberou a cota';
  exception when raise_exception then
    if sqlerrm <> 'Você atingiu o limite de 3 eventos neste mês.' then raise; end if;
  end;
end;
$$;
reset role;

-- Presença limitada, cancelamento e privacidade da lista e das denúncias.
insert into public.events(id, criado_por, titulo, tipo, descricao, inicio_em,
  fim_em, local_nome, lat, lng, vagas, status)
values ('20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', 'Evento com uma vaga', 'encontro',
  'Encontro em parque público', now() + interval '2 days', now() + interval '2 days 1 hour',
  'Parque', -22.9, -43.2, 1, 'publicado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
begin
  if not public.evento_confirmar_presenca('20000000-0000-4000-8000-000000000001') then
    raise exception 'Presença não confirmada';
  end if;
  perform public.evento_denunciar('20000000-0000-4000-8000-000000000001', 'spam');
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
do $$
begin
  if exists(select 1 from public.event_rsvps) or exists(select 1 from public.event_reports) then
    raise exception 'Lista de presença ou denúncias vazaram';
  end if;
  begin
    perform public.evento_confirmar_presenca('20000000-0000-4000-8000-000000000001');
    raise exception 'Lotação ultrapassada';
  exception when raise_exception then
    if sqlerrm <> 'As vagas deste evento estão esgotadas.' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
begin
  if public.evento_confirmar_presenca('20000000-0000-4000-8000-000000000001') then
    raise exception 'Presença não cancelada';
  end if;
end;
$$;
reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
begin
  if exists(select 1 from public.events where status <> 'publicado') then
    raise exception 'Evento privado vazou para visitante';
  end if;
  if has_function_privilege('anon', 'public.evento_criar(text,text,text,timestamptz,timestamptz,text,text,double precision,double precision,text,boolean,integer,text,integer,boolean)', 'EXECUTE') then
    raise exception 'Visitante pode criar eventos';
  end if;
end;
$$;
reset role;
select 'OK: cota, verificação, revogação, presença, vagas e RLS' as resultado;

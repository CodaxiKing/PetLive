insert into public.events(id, organizador_id, criado_por, titulo, tipo, descricao, inicio_em, fim_em,
  local_nome, lat, lng, status, motivo_status, vagas, gratuito, preco_centavos, ingresso_url)
values ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'Meu encontro', 'encontro', 'Encontro em parque público',
  now() + interval '2 days', now() + interval '2 days 2 hours', 'Parque', -22, -43,
  'publicado', null, 20, false, 2500, 'https://example.invalid');
insert into public.event_rsvps(event_id, user_id) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
do $$
begin
  if exists(select 1 from public.meus_eventos() where id = '70000000-0000-4000-8000-000000000001') then raise exception 'Lista vazou para outro usuário'; end if;
  if public.meu_evento_detalhe('70000000-0000-4000-8000-000000000001') is not null then raise exception 'Edição exposta a outro usuário'; end if;
  begin
    perform public.evento_atualizar('70000000-0000-4000-8000-000000000001', '{"titulo":"Invasão"}');
    raise exception 'Outro usuário editou';
  exception when raise_exception then
    if sqlerrm <> 'Este evento não pode mais ser editado.' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
begin
  if not exists(select 1 from public.meus_eventos() where id = '70000000-0000-4000-8000-000000000001') then raise exception 'Evento próprio ausente'; end if;
  begin
    perform public.evento_atualizar('70000000-0000-4000-8000-000000000001', '{"vagas":1}');
    raise exception 'Vagas abaixo dos confirmados';
  exception when raise_exception then
    if sqlerrm <> 'O limite de vagas não pode ser menor que as presenças já confirmadas.' then raise; end if;
  end;
  perform public.evento_atualizar('70000000-0000-4000-8000-000000000001', '{"lat":-21}');
  if (public.meu_evento_detalhe('70000000-0000-4000-8000-000000000001')->>'status') <> 'em_analise' then raise exception 'Coordenadas não reenviaram para análise'; end if;
  perform public.evento_atualizar('70000000-0000-4000-8000-000000000001', '{"gratuito":true}');
end;
$$;
reset role;
select pg_temp.conferir((select gratuito and preco_centavos is null and ingresso_url is null from public.events
  where id = '70000000-0000-4000-8000-000000000001'), 'Mudança para grátis deixou preço antigo');
select pg_temp.conferir((select count(*) = 2 from notification_log where deep_link = '/eventos/70000000-0000-4000-8000-000000000001'
  and title = 'Evento atualizado'), 'Participantes não avisados da mudança de local');
update public.events set status = 'ajuste_solicitado', motivo_status = 'Detalhe o encontro'
where id = '70000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.evento_atualizar('70000000-0000-4000-8000-000000000001', '{"descricao":"Encontro para tutores e seus cães no parque"}');
select pg_temp.conferir((public.meu_evento_detalhe('70000000-0000-4000-8000-000000000001')->>'status') = 'em_analise', 'Correção não reenviou ajustes');
select pg_temp.conferir((public.meu_evento_detalhe('70000000-0000-4000-8000-000000000001')->>'motivo_status') is null, 'Motivo antigo persistiu');
select public.evento_cancelar('70000000-0000-4000-8000-000000000001');
select public.evento_cancelar('70000000-0000-4000-8000-000000000001');
select pg_temp.conferir((public.meu_evento_detalhe('70000000-0000-4000-8000-000000000001')->>'status') = 'cancelado', 'Cancelamento não aparece no histórico');
reset role;
select pg_temp.conferir((select count(*) = 2 from notification_log
  where deep_link = '/eventos/70000000-0000-4000-8000-000000000001' and title = 'Evento cancelado'), 'Repetição do cancelamento duplicou avisos');
select 'OK: meus eventos, propriedade, reanálise, vagas e cancelamento' as resultado;

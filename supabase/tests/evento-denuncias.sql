insert into auth.users(id, email, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000003', 'denuncia-3@example.invalid', '{"nome":"Terceiro denunciante"}');
insert into public.events(id, criado_por, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng, status)
values ('90000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
  'Evento denunciado', 'encontro', 'Encontro no parque público', now() + interval '2 days',
  now() + interval '2 days 2 hours', 'Parque', -22, -43, 'publicado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'spam', 'Teste');
select public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'spam', 'Repetido');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
select public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'fraude');
select pg_temp.conferir(public.evento_detalhe('90000000-0000-4000-8000-000000000001') is not null, 'Evento oculto antes de três pessoas distintas');
select pg_temp.conferir((select count(*) = 1 from event_reports where event_id = '90000000-0000-4000-8000-000000000001'), 'Denúncias de outras pessoas expostas');
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000003","aal":"aal1"}', true);
select public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'informacao_falsa');
select public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'informacao_falsa');
select pg_temp.conferir(public.evento_detalhe('90000000-0000-4000-8000-000000000001') is null, 'Terceira denúncia não retirou ficha');
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
begin
  begin
    perform public.evento_denunciar('90000000-0000-4000-8000-000000000001', 'spam');
    raise exception 'Nova denúncia de evento oculto aceita';
  exception when raise_exception then
    if sqlerrm <> 'Evento não encontrado ou já encerrado.' then raise; end if;
  end;
  begin
    perform public.evento_denunciar('90000000-0000-4000-8000-000000000001', null);
    raise exception 'Motivo vazio aceito';
  exception when raise_exception then
    if sqlerrm <> 'Informe um motivo de denúncia válido.' then raise; end if;
  end;
end;
$$;
reset role;
select pg_temp.conferir((select status = 'oculto' and motivo_status is not null from events
  where id = '90000000-0000-4000-8000-000000000001'), 'Ocultação sem estado ou motivo');
select pg_temp.conferir((select count(*) = 3 from event_reports where event_id = '90000000-0000-4000-8000-000000000001'), 'Denúncias repetidas contaram');
select pg_temp.conferir((select count(*) = 1 from notification_log where user_id = '40000000-0000-4000-8000-000000000001'
  and title = 'Evento em revisão'), 'Aviso ao organizador ausente ou duplicado');
select pg_temp.conferir(not has_function_privilege('anon','public.evento_denunciar(uuid,text,text)','EXECUTE'), 'Denúncia anônima permitida');
select 'OK: três pessoas distintas, repetição, privacidade e ocultação' as resultado;

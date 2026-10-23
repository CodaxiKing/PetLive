select pg_temp.conferir((select public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg','image/png','image/webp']
  from storage.buckets where id = 'eventos'), 'Configuração de fotos incorreta');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
insert into storage.objects(bucket_id, name)
values ('eventos', '10000000-0000-4000-8000-000000000001/foto-teste.jpg');
do $$
begin
  begin
    insert into storage.objects(bucket_id, name)
      values ('eventos', '10000000-0000-4000-8000-000000000002/foto-invasao.jpg');
    raise exception 'Upload na pasta de outra pessoa permitido';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
insert into public.events(id, organizador_id, criado_por, titulo, tipo, descricao, inicio_em, fim_em,
  local_nome, lat, lng, status)
values ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'Evento com foto', 'encontro', 'Encontro em parque público',
  now() + interval '2 days', now() + interval '2 days 2 hours', 'Parque', -22, -43, 'publicado');
set local role authenticated;
select public.evento_atualizar('80000000-0000-4000-8000-000000000001', '{"foto_url":"https://example.invalid/storage/v1/object/public/eventos/foto.jpg"}');
select pg_temp.conferir(public.meu_evento_detalhe('80000000-0000-4000-8000-000000000001')->>'foto_url' = 'https://example.invalid/storage/v1/object/public/eventos/foto.jpg', 'Foto ausente na edição');
select pg_temp.conferir(public.meu_evento_detalhe('80000000-0000-4000-8000-000000000001')->>'status' = 'em_analise', 'Foto não voltou para análise');
select public.evento_atualizar('80000000-0000-4000-8000-000000000001', '{"foto_url":null}');
select pg_temp.conferir((public.meu_evento_detalhe('80000000-0000-4000-8000-000000000001')->>'foto_url') is null, 'Foto não removida');
do $$
begin
  begin
    perform public.evento_atualizar('80000000-0000-4000-8000-000000000001', '{"foto_url":"javascript:alert(1)"}');
    raise exception 'URL insegura aceita';
  exception when raise_exception then
    if sqlerrm <> 'A foto precisa de um endereço HTTPS válido.' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","aal":"aal1"}', true);
select pg_temp.conferir(not exists(select 1 from storage.objects where bucket_id = 'eventos'), 'Listagem de arquivos alheios permitida');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","aal":"aal1"}', true);
do $$
declare v_id uuid; v jsonb;
begin
  v_id := public.evento_criar('Encontro com foto', 'encontro', 'Encontro público em parque',
    now() + interval '2 days', now() + interval '2 days 2 hours', 'Parque escolhido',
    p_place_id => 'ChIJ-local-teste', p_foto_url => 'https://example.invalid/evento.jpg');
  v := public.meu_evento_detalhe(v_id);
  if v->>'place_id' <> 'ChIJ-local-teste' or v->>'foto_url' <> 'https://example.invalid/evento.jpg'
    or v->>'lat' is not null or v->>'lng' is not null then
    raise exception 'Criação não preservou foto e seleção do Google sem coordenadas';
  end if;
end;
$$;
reset role;
select 'OK: fotos, políticas de upload, edição e reanálise' as resultado;

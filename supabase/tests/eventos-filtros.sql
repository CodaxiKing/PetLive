insert into public.events(id, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng, status)
select ('b0000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'Evento para filtro', tipo, 'Encontro em parque público', inicio, fim, 'Parque', lat, -43, status
from (values
  (1, 'adocao', now() - interval '10 minutes', now() + interval '2 hours', -22.0, 'publicado'),
  (2, 'palestra', now() - interval '10 minutes', now() + interval '2 hours', -22.0, 'publicado'),
  (3, 'adocao', now() - interval '10 minutes', now() + interval '2 hours', -20.0, 'publicado'),
  (4, 'adocao', now() - interval '10 minutes', now() + interval '2 hours', -22.0, 'oculto'),
  (5, 'adocao', now() - interval '2 hours', now() - interval '1 hour', -22.0, 'publicado')
) v(n,tipo,inicio,fim,lat,status);
insert into public.events(id, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng, status)
select 'b0000000-0000-4000-8000-000000000006', 'Próxima segunda', 'adocao', 'Encontro em parque público',
  proxima_segunda + interval '12 hours', proxima_segunda + interval '14 hours', 'Parque', -22, -43, 'publicado'
from (select (date_trunc('week', now() at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo' as proxima_segunda) d;

select pg_temp.conferir((select count(*) = 1 from public.eventos_por_perto(-22,-43,10,p_periodo=>'hoje',p_tipo=>'adocao')
  where id::text like 'b0000000-%'), 'Hoje/tipo/raio/status não filtraram corretamente');
select pg_temp.conferir((select count(*) = 2 from public.eventos_por_perto(-22,-43,10,p_periodo=>'hoje')
  where id::text like 'b0000000-%'), 'Todos os tipos ou evento em andamento ausentes');
select pg_temp.conferir(not exists(select 1 from public.eventos_por_perto(-22,-43,10,p_periodo=>'semana')
  where id = 'b0000000-0000-4000-8000-000000000006'), 'Esta semana incluiu a próxima segunda');
select pg_temp.conferir(exists(select 1 from public.eventos_por_perto(-22,-43,10,p_periodo=>'mes')
  where id = 'b0000000-0000-4000-8000-000000000006'), '30 dias não incluiu próxima segunda');
select pg_temp.conferir(not exists(select 1 from public.eventos_por_perto(-22,-43,10,p_tipo=>'encontro')
  where id::text like 'b0000000-%'), 'Tipo diferente vazou');
select 'OK: Hoje, semana de Brasília, tipo, raio e eventos em andamento' as resultado;

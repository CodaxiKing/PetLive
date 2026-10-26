-- Leitura do cartão por foto: Premium, acesso ao pet e limite do mês.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/leitura-cartao.sql
begin;
insert into auth.users(id,email) values
 ('61000000-0000-4000-8000-000000000001','leitura-premium@example.invalid'),
 ('61000000-0000-4000-8000-000000000002','leitura-gratis@example.invalid');
update public.profiles set plano='premium' where id='61000000-0000-4000-8000-000000000001';
insert into public.pets(id,tutor_id,nome,especie) values
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Rex','cao'),
 ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002','Mia','gato');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin perform public.cartao_leitura_reservar('62000000-0000-4000-8000-000000000002'); raise exception 'Grátis leu cartão';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  begin perform public.cartao_leitura_reservar('62000000-0000-4000-8000-000000000002'); raise exception 'Leu cartão de pet de outra conta';
  exception when insufficient_privilege then null; end;
end $$;
-- Falha devolve a vaga; sucesso conta.
select public.cartao_leitura_concluir((public.cartao_leitura_reservar('62000000-0000-4000-8000-000000000001')->>'id')::uuid, false);
select pg_temp.verificar(public.cartao_leituras_restantes()=10,'Falha consumiu a leitura');
do $$ declare i int; begin
  for i in 1..10 loop perform public.cartao_leitura_concluir((public.cartao_leitura_reservar('62000000-0000-4000-8000-000000000001')->>'id')::uuid, true, 2); end loop;
end $$;
select pg_temp.verificar(public.cartao_leituras_restantes()=0,'Contagem do mês errada');
do $$ begin
  begin perform public.cartao_leitura_reservar('62000000-0000-4000-8000-000000000001'); raise exception 'Passou do limite do mês';
  exception when check_violation then null; end;
end $$;
rollback;

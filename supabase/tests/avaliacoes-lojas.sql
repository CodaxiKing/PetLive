-- Avaliações das lojas e aviso de estoque: só pedido concluído, uma vez, média e resposta única.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/avaliacoes-lojas.sql
begin;
insert into auth.users(id,email) values
 ('87000000-0000-4000-8000-000000000001','av-tutor@example.invalid'),
 ('87000000-0000-4000-8000-000000000002','av-loja@example.invalid');
insert into public.stores(id,name,status) values ('88000000-0000-4000-8000-000000000001','Loja Aval','aprovada');
insert into public.store_members(store_id,user_id,role) values ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000002','owner');
insert into public.requests(id,user_id,store_id,status) values
 ('89000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','concluida'),
 ('89000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','confirmada');
insert into public.products(id,store_id,name,price_cents,stock,stock_min) values ('8a000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','Ração',100,5,2);
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table av(id uuid);
grant all on av to authenticated;
set local role authenticated;
select pg_temp.como('87000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.avaliacao_enviar('89000000-0000-4000-8000-000000000002',5); raise exception 'Avaliou pedido não concluído';
  exception when invalid_parameter_value then null; end;
end $$;
insert into av select public.avaliacao_enviar('89000000-0000-4000-8000-000000000001',4,array['atendimento','cuidado'],'Muito bom');
do $$ begin
  begin perform public.avaliacao_enviar('89000000-0000-4000-8000-000000000001',5); raise exception 'Avaliou duas vezes';
  exception when unique_violation then null; end;
end $$;
do $$ begin
  begin perform public.avaliacao_responder((select id from av),'Obrigado!'); raise exception 'Tutor respondeu';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.verificar((select (j->>'media')::numeric=4 and (j->>'total')::int=1 from (select public.loja_avaliacoes('88000000-0000-4000-8000-000000000001') j) x),'Média da loja');
select pg_temp.como('87000000-0000-4000-8000-000000000002');
select public.avaliacao_responder((select id from av),'Obrigado pela visita!');
do $$ begin
  begin perform public.avaliacao_responder((select id from av),'De novo'); raise exception 'Respondeu duas vezes';
  exception when unique_violation then null; end;
end $$;
reset role;
-- Estoque: chega ao mínimo e zera, um aviso por vez.
update public.products set stock=2 where id='8a000000-0000-4000-8000-000000000001';
update public.products set stock=1 where id='8a000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select count(*)=1 from public.notification_log where user_id='87000000-0000-4000-8000-000000000002' and title='Estoque baixo'),'Aviso de estoque baixo repetido ou ausente');
rollback;

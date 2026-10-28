-- Entrega: acompanha a solicitação, posição recente, falha com nova tentativa e entrega com código.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/entregas.sql
begin;
insert into auth.users(id,email) values
 ('9b000000-0000-4000-8000-000000000001','ent-tutor@example.invalid'),
 ('9b000000-0000-4000-8000-000000000002','ent-loja@example.invalid');
insert into public.stores(id,name,status,lat,lng,delivery_enabled,delivery_fee_cents,delivery_radius_km,delivery_eta_max) values
 ('9c000000-0000-4000-8000-000000000001','Loja Entrega','aprovada',-22.90,-43.10,true,800,3,40);
insert into public.store_members(store_id,user_id,role) values ('9c000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000002','owner');
insert into public.products(id,store_id,name,price_cents,stock) values ('9d000000-0000-4000-8000-000000000001','9c000000-0000-4000-8000-000000000001','Ração',5000,5);
insert into public.addresses(id,user_id,street,lat,lng) values ('9e000000-0000-4000-8000-000000000001','9b000000-0000-4000-8000-000000000001','Rua Perto',-22.905,-43.105);
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table p(id uuid);
grant all on p to authenticated;
set local role authenticated;
select pg_temp.como('9b000000-0000-4000-8000-000000000001');
insert into p select (public.solicitacao_criar('9c000000-0000-4000-8000-000000000001','[{"product_id":"9d000000-0000-4000-8000-000000000001","qty":1}]','entrega',null,'9e000000-0000-4000-8000-000000000001')->>'id')::uuid;
select pg_temp.verificar(public.entrega_detalhe((select id from p)) is null,'Entrega antes de confirmar');
select pg_temp.como('9b000000-0000-4000-8000-000000000002');
select public.solicitacao_mudar((select id from p),'confirmada');
select pg_temp.verificar(public.entrega_detalhe((select id from p))->>'status'='preparando','Entrega não criada ao confirmar');
select public.solicitacao_mudar((select id from p),'pronta');
select public.solicitacao_mudar((select id from p),'em_entrega');
select public.entrega_posicao((select id from p),-22.903,-43.103);
select pg_temp.como('9b000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select j->>'status'='em_rota' and j->'posicao' is not null and (j->>'eta_at')::timestamptz > now() from (select public.entrega_detalhe((select id from p)) j) x),'Em rota sem posição ou prazo');
do $$ begin
  begin perform public.entrega_posicao((select id from p),0,0); raise exception 'Tutor mandou posição';
  exception when insufficient_privilege then null; end;
end $$;
-- Falha e nova tentativa.
select pg_temp.como('9b000000-0000-4000-8000-000000000002');
select public.entrega_falhou((select id from p),'Ninguém atendeu no portão');
select public.solicitacao_mudar((select id from p),'em_entrega');
reset role;
create temp table cod as select codigo_entrega c from public.requests where id=(select id from p);
grant select on cod to authenticated;
set local role authenticated;
select public.solicitacao_mudar((select id from p),'concluida',null,(select c from cod));
select pg_temp.como('9b000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select j->>'status'='entregue' and (j->>'tentativas')::int=2 from (select public.entrega_detalhe((select id from p)) j) x),'Entrega não concluída ou tentativas erradas');
reset role;
select pg_temp.verificar((select count(*)=1 from public.notification_log where user_id='9b000000-0000-4000-8000-000000000001' and title='Não conseguimos entregar'),'Aviso de falha');
rollback;

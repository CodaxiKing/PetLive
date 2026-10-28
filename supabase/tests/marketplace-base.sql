-- Marketplace base: vitrine, receita bloqueada, estoque, máquina de estados, entrega com código e expiração.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/marketplace-base.sql
begin;
insert into auth.users(id,email) values
 ('80000000-0000-4000-8000-000000000001','mk-tutor@example.invalid'),
 ('80000000-0000-4000-8000-000000000002','mk-loja@example.invalid'),
 ('80000000-0000-4000-8000-000000000003','mk-outro@example.invalid');
insert into public.stores(id,name,status,lat,lng,delivery_enabled,delivery_fee_cents,delivery_radius_km,delivery_min_order_cents,delivery_free_over_cents)
 values ('81000000-0000-4000-8000-000000000001','Pet Shop Teste','aprovada',-22.90,-43.10,true,800,3,2000,20000);
insert into public.store_members(store_id,user_id,role) values ('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','owner');
insert into public.products(id,store_id,name,categoria,price_cents,venda,stock,receita_msg) values
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Ração 10 kg','racao',15000,'app',3,null),
 ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','Antibiótico','farmacia',4000,'local_com_receita',10,'Traga a receita do veterinário.'),
 ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001','Item interno','outros',100,'oculto',5,null),
 ('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','Bolinha','brinquedos',1500,'app',0,null);
insert into public.addresses(id,user_id,street,lat,lng) values
 ('83000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','Rua Longe',-23.50,-46.60),
 ('83000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001','Rua Perto',-22.905,-43.105);
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table ids(nome text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;
select pg_temp.como('80000000-0000-4000-8000-000000000001');
-- Vitrine: oculto e zerado com "esconder" não aparecem; receita aparece sem poder pedir.
select pg_temp.verificar((select jsonb_array_length(j->'produtos')=2 from (select public.loja_vitrine('81000000-0000-4000-8000-000000000001') j) x),'Vitrine com itens errados');
do $$ begin
  begin perform 1 from public.products; raise exception 'Leu produtos direto';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin perform public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000002","qty":1}]','retirada'); raise exception 'Aceitou produto com receita';
  exception when invalid_parameter_value then if sqlerrm not like '%receita%' then raise; end if; end;
end $$;
do $$ begin
  begin perform public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":4}]','retirada'); raise exception 'Aceitou mais que o estoque';
  exception when invalid_parameter_value then null; end;
end $$;
insert into ids select 'p1', (public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":2}]','retirada','Separa por favor')->>'id')::uuid;
select pg_temp.verificar((select (j->'solicitacao'->>'total_cents')::int=30000 from (select public.solicitacao_detalhe((select id from ids where nome='p1')) j) x),'Total errado');
do $$ begin
  begin perform public.solicitacao_mudar((select id from ids where nome='p1'),'confirmada'); raise exception 'Tutor confirmou';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('80000000-0000-4000-8000-000000000003');
select pg_temp.verificar((public.solicitacao_detalhe((select id from ids where nome='p1'))->>'disponivel')::boolean=false,'Outra conta viu a solicitação');
select pg_temp.como('80000000-0000-4000-8000-000000000002');
select public.solicitacao_mudar((select id from ids where nome='p1'),'confirmada');
do $$ begin
  begin perform public.solicitacao_mudar((select id from ids where nome='p1'),'concluida'); raise exception 'Pulou de confirmada para concluída';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select pg_temp.verificar((select stock=1 from public.products where id='82000000-0000-4000-8000-000000000001'),'Estoque não baixou');
set local role authenticated;
select pg_temp.como('80000000-0000-4000-8000-000000000001');
select public.solicitacao_mudar((select id from ids where nome='p1'),'cancelada');
reset role;
select pg_temp.verificar((select stock=3 from public.products where id='82000000-0000-4000-8000-000000000001'),'Estoque não voltou');
select pg_temp.verificar((select count(*)=3 from public.request_events where request_id=(select id from ids where nome='p1')),'Eventos não gravados');
-- Entrega: fora do raio recusa; dentro calcula taxa e exige código para concluir.
set local role authenticated;
select pg_temp.como('80000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":1}]','entrega',null,'83000000-0000-4000-8000-000000000001'); raise exception 'Entregou fora do raio';
  exception when invalid_parameter_value then null; end;
end $$;
insert into ids select 'p2', (public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":1}]','entrega',null,'83000000-0000-4000-8000-000000000002')->>'id')::uuid;
select pg_temp.verificar((select (j->'solicitacao'->>'delivery_fee_cents')::int=800 from (select public.solicitacao_detalhe((select id from ids where nome='p2')) j) x),'Taxa de entrega');
select pg_temp.como('80000000-0000-4000-8000-000000000002');
select public.solicitacao_mudar((select id from ids where nome='p2'),'confirmada');
select public.solicitacao_mudar((select id from ids where nome='p2'),'pronta');
select public.solicitacao_mudar((select id from ids where nome='p2'),'em_entrega');
do $$ begin
  begin perform public.solicitacao_mudar((select id from ids where nome='p2'),'concluida',null,'0000x'); raise exception 'Concluiu sem código';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
insert into ids select 'cod', null;
create temp table cod as select codigo_entrega c from public.requests where id=(select id from ids where nome='p2');
grant select on cod to authenticated;
set local role authenticated;
select pg_temp.como('80000000-0000-4000-8000-000000000002');
select public.solicitacao_mudar((select id from ids where nome='p2'),'concluida',null,(select c from cod));
-- Expiração e confirmação automática.
select pg_temp.como('80000000-0000-4000-8000-000000000001');
insert into ids select 'p3', (public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":1}]','retirada')->>'id')::uuid;
reset role;
update public.requests set expira_em=now()-interval '1 minute' where id=(select id from ids where nome='p3');
select set_config('request.jwt.claims','',true);
select pg_temp.verificar(public.solicitacoes_expirar()>=1,'Não expirou');
select pg_temp.verificar((select status='expirada' from public.requests where id=(select id from ids where nome='p3')),'Status expirada');
update public.stores set auto_confirm=true where id='81000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('80000000-0000-4000-8000-000000000001');
select pg_temp.verificar((public.solicitacao_criar('81000000-0000-4000-8000-000000000001','[{"product_id":"82000000-0000-4000-8000-000000000001","qty":1}]','retirada')->>'status')='confirmada','Confirmação automática');
reset role;
select pg_temp.verificar((select count(*)>=5 from public.notification_log where user_id='80000000-0000-4000-8000-000000000001' and type='pedido'),'Avisos ao tutor');
select pg_temp.verificar((select count(*)>=3 from public.notification_log where user_id='80000000-0000-4000-8000-000000000002' and type='pedido'),'Avisos à loja');
rollback;

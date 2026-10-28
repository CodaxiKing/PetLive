-- Cadastro e publicação da loja, assumir lugar do mapa e moderação de denúncias.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/loja-cadastro.sql
begin;
insert into auth.users(id,email) values
 ('8b000000-0000-4000-8000-000000000001','cad-dono@example.invalid'),
 ('8b000000-0000-4000-8000-000000000002','cad-mod@example.invalid'),
 ('8b000000-0000-4000-8000-000000000003','cad-tutor@example.invalid');
insert into public.admin_members(user_id,papel) values ('8b000000-0000-4000-8000-000000000002','moderacao');
insert into public.places(id,nome,categoria,lat,lng,fonte,fonte_id) values ('8c000000-0000-4000-8000-000000000001','Pet Shop do Mapa','petshop',-22.9,-43.1,'tutor','teste-cadastro-loja');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated','aal','aal2')::text, true) $$;
create temp table loja(id uuid);
grant all on loja to authenticated;
set local role authenticated;
select pg_temp.como('8b000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.loja_criar('Loja','petshop','ambos','11.222.333/0001-80','Ana'); raise exception 'Aceitou CNPJ inválido';
  exception when invalid_parameter_value then null; end;
end $$;
insert into loja select public.loja_criar('Pet Shop Bom','petshop','produtos','11.222.333/0001-81','Ana');
do $$ begin
  begin perform public.loja_atualizar((select id from loja),'{"status":"aprovada"}'); raise exception 'Mudou o status direto';
  exception when invalid_parameter_value then null; end;
end $$;
do $$ begin
  begin perform public.loja_enviar_analise((select id from loja)); raise exception 'Enviou sem completar';
  exception when invalid_parameter_value then null; end;
end $$;
select public.loja_atualizar((select id from loja),'{"address":"Rua A, 10","city":"Niterói","lat":-22.9,"lng":-43.1,"phone":"(21) 99999-0000"}');
select public.loja_documento_registrar((select id from loja),'cnpj',(select id from loja)::text || '/cartao-cnpj.pdf');
reset role;
insert into public.products(store_id,name,price_cents,stock) select id,'Ração',100,5 from loja;
insert into public.store_hours(store_id,weekday,opens,closes) select id,1,'08:00','18:00' from loja;
set local role authenticated;
select public.loja_enviar_analise((select id from loja));
select public.loja_assumir_lugar((select id from loja),'8c000000-0000-4000-8000-000000000001');
-- Tutor não vê loja em análise.
select pg_temp.como('8b000000-0000-4000-8000-000000000003');
select pg_temp.verificar((public.loja_vitrine((select id from loja))->>'disponivel')::boolean=false,'Loja em análise apareceu');
do $$ begin
  begin perform public.admin_loja_decidir((select id from loja),'aprovar'); raise exception 'Tutor aprovou a loja';
  exception when insufficient_privilege then null; end;
end $$;
-- Moderação pede correção, dono reenvia, moderação aprova com o lugar conferido.
select pg_temp.como('8b000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select jsonb_array_length(j->'lojas')=1 and j->'lojas'->0->'lugar'->>'nome'='Pet Shop do Mapa' from (select public.admin_lojas('em_analise') j) x),'Fila de análise');
select public.admin_loja_decidir((select id from loja),'correcao','Envie o comprovante de endereço');
select pg_temp.como('8b000000-0000-4000-8000-000000000001');
select public.loja_enviar_analise((select id from loja));
select pg_temp.como('8b000000-0000-4000-8000-000000000002');
select public.admin_loja_decidir((select id from loja),'aprovar',null,true);
select pg_temp.como('8b000000-0000-4000-8000-000000000003');
select pg_temp.verificar((public.loja_vitrine((select id from loja))->>'disponivel')::boolean,'Loja aprovada não apareceu');
select pg_temp.verificar(public.loja_do_lugar('8c000000-0000-4000-8000-000000000001')=(select id from loja),'Lugar não ligado à loja');
-- Denúncia de produto: moderação bloqueia e some da vitrine.
reset role;
create temp table prod as select id from public.products where store_id=(select id from loja);
grant select on prod to authenticated;
set local role authenticated;
select pg_temp.como('8b000000-0000-4000-8000-000000000003');
select public.loja_denunciar('produto',(select id from prod),'Produto falsificado');
select pg_temp.como('8b000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select jsonb_array_length(public.admin_loja_denuncias())=1),'Denúncia não listada');
select public.admin_loja_denuncia_decidir('produto',(select id from prod),true);
select pg_temp.como('8b000000-0000-4000-8000-000000000003');
select pg_temp.verificar((select jsonb_array_length(public.loja_vitrine((select id from loja))->'produtos')=0),'Produto bloqueado apareceu');
reset role;
select pg_temp.verificar((select count(*)>=2 from public.notification_log where user_id='8b000000-0000-4000-8000-000000000001' and deep_link='/loja-painel'),'Avisos ao dono');
rollback;

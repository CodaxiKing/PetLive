-- Chat tutor e loja: só as partes leem e escrevem, lidas, aviso sem repetição e fechamento em 7 dias.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/chat-loja.sql
begin;
insert into auth.users(id,email) values
 ('84000000-0000-4000-8000-000000000001','chat-tutor@example.invalid'),
 ('84000000-0000-4000-8000-000000000002','chat-loja@example.invalid'),
 ('84000000-0000-4000-8000-000000000003','chat-outro@example.invalid');
insert into public.stores(id,name,status) values ('85000000-0000-4000-8000-000000000001','Loja Chat','aprovada');
insert into public.store_members(store_id,user_id,role) values ('85000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002','owner');
insert into public.requests(id,user_id,store_id,fulfillment) values ('86000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','retirada');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table conv(id uuid);
grant all on conv to authenticated;
set local role authenticated;
select pg_temp.como('84000000-0000-4000-8000-000000000001');
insert into conv select (public.chat_abrir('86000000-0000-4000-8000-000000000001')->>'id')::uuid;
select public.chat_enviar((select id from conv),'Pode separar até as 17h?');
select public.chat_enviar((select id from conv),'Obrigado!');
select pg_temp.como('84000000-0000-4000-8000-000000000003');
do $$ begin
  begin perform public.chat_abrir('86000000-0000-4000-8000-000000000001'); raise exception 'Outra conta abriu a conversa';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.verificar((select count(*)=0 from public.messages),'Outra conta leu mensagens');
select pg_temp.como('84000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select (j->>'sou_loja')::boolean and jsonb_array_length(j->'mensagens')=2 from (select public.chat_abrir('86000000-0000-4000-8000-000000000001') j) x),'Loja não vê as mensagens');
select public.chat_enviar((select id from conv),'Claro! Já separei.');
select public.chat_enviar((select id from conv),'Deixo no balcão.');
select pg_temp.como('84000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*)=4 from public.messages),'Tutor não lê pelo RLS');
reset role;
select pg_temp.verificar((select count(*)=2 from public.messages where da_loja and read_at is null),'Mensagens da loja');
select pg_temp.verificar((select count(*)=1 from public.notification_log where user_id='84000000-0000-4000-8000-000000000001' and deep_link like '%/conversa'),'Aviso ao tutor repetido ou ausente');
select pg_temp.verificar((select count(*)=1 from public.notification_log where user_id='84000000-0000-4000-8000-000000000002' and type='pedido'),'Aviso à loja repetido ou ausente');
-- Fecha 7 dias depois de concluir.
update public.requests set status='concluida' where id='86000000-0000-4000-8000-000000000001';
update public.request_events set at=now()-interval '8 days' where request_id='86000000-0000-4000-8000-000000000001' and to_status='concluida';
set local role authenticated;
select pg_temp.como('84000000-0000-4000-8000-000000000001');
select pg_temp.verificar((public.chat_abrir('86000000-0000-4000-8000-000000000001')->>'fechada')::boolean,'Não fechou');
do $$ begin
  begin perform public.chat_enviar((select id from conv),'Oi?'); raise exception 'Enviou em conversa fechada';
  exception when invalid_parameter_value then null; end;
end $$;
rollback;

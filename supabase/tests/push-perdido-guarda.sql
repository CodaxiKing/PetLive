-- Push dos avisos de pet perdido e dos convites da guarda: vai para os aparelhos ativos; alteração com pet_id não.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/push-perdido-guarda.sql
begin;
insert into auth.users(id,email) values ('77000000-0000-4000-8000-000000000001','push-tutor@example.invalid');
insert into public.push_tokens(tutor_id,token,plataforma) values
 ('77000000-0000-4000-8000-000000000001','ExponentPushToken[teste-ativo]','android');
insert into public.push_tokens(tutor_id,token,plataforma,ativo) values
 ('77000000-0000-4000-8000-000000000001','ExponentPushToken[teste-inativo]','ios',false);
insert into public.pets(id,tutor_id,nome,especie) values ('78000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','Rex','cao');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create temp table antes as select coalesce(max(id),0) as id from net.http_request_queue;
insert into public.notification_log(user_id,type,title,body,deep_link) values
 ('77000000-0000-4000-8000-000000000001','perdido','Pet perdido perto de você','Rex sumiu','/alerta/x'),
 ('77000000-0000-4000-8000-000000000001','guarda','Convite de guarda compartilhada','Ana convidou você','/guarda/convite/y');
insert into public.notification_log(user_id,pet_id,type,title,body,deep_link) values
 ('77000000-0000-4000-8000-000000000001','78000000-0000-4000-8000-000000000001','guarda','Ana registrou a vacina','V10','/pet/z/atualizacoes'),
 ('77000000-0000-4000-8000-000000000001',null,'sistema','Outro','x','/inicio');
select pg_temp.verificar((select count(*)=2 from net.http_request_queue where id>(select id from antes)),'Deveriam sair 2 pushes');
select pg_temp.verificar((select count(*)=1 from net.http_request_queue where id>(select id from antes) and convert_from(body,'utf8')::jsonb->'data'->>'url'='/alerta/x' and convert_from(body,'utf8')::jsonb->>'to'='ExponentPushToken[teste-ativo]'),'Push do alerta errado');
rollback;

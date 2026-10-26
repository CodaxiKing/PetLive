-- QR da coleira: envio de localização por quem achou o pet.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/qr-localizacao.sql
begin;
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000001','qr-local-tutor@example.invalid'),
 ('71000000-0000-4000-8000-000000000002','qr-local-outro@example.invalid');
insert into public.pets(id,tutor_id,nome,especie) values ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Rex','cao');
insert into public.pet_qr_settings(pet_id,code) values ('72000000-0000-4000-8000-000000000001','codigo-local-teste');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role anon;
select set_config('request.headers','{"x-forwarded-for":"qr-local-1"}',true);
select pg_temp.verificar((public.qr_enviar_localizacao('codigo-local-teste',-22.97,-43.18,25,'Está no portão do prédio')->>'enviado')::boolean,'Envio falhou');
select pg_temp.verificar((public.qr_enviar_localizacao('nao-existe',-22.97,-43.18)->>'enviado')::boolean=false,'Código inexistente aceito');
select pg_temp.verificar((public.qr_enviar_localizacao('codigo-local-teste',123,-43.18)->>'motivo')='posicao','Coordenada inválida aceita');
do $$ declare i int; begin for i in 1..5 loop perform public.qr_enviar_localizacao('codigo-local-teste',-22.97,-43.18); end loop; end $$;
select pg_temp.verificar((public.qr_enviar_localizacao('codigo-local-teste',-22.97,-43.18)->>'limite')::boolean,'Limite por hora não aplicado');
do $$ begin
  begin perform 1 from public.qr_localizacoes; raise exception 'Anônimo leu localizações';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.verificar((select count(*)=0 from public.qr_localizacoes),'Outra conta viu a localização');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.verificar((select count(*)=1 from public.qr_localizacoes where mensagem='Está no portão do prédio'),'Tutor não vê a localização');
select pg_temp.verificar((select count(*)>=1 from public.notification_log where deep_link like '/pet/%/achado'),'Tutor não foi avisado');
rollback;

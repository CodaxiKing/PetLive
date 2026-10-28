-- Passeio ao vivo: só o passeador inicia, pontos somam distância (sem saltos), tutor vê, encerra e avalia; perdido após 30 min.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/passeio-ao-vivo.sql
begin;
insert into auth.users(id,email) values
 ('96000000-0000-4000-8000-000000000001','pv-tutor@example.invalid'),
 ('96000000-0000-4000-8000-000000000002','pv-passeador@example.invalid'),
 ('96000000-0000-4000-8000-000000000003','pv-outro@example.invalid');
insert into public.pets(id,tutor_id,nome,especie) values ('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','Rex','cao');
insert into public.stores(id,name,status,oferece) values ('98000000-0000-4000-8000-000000000001','Passeios Já','aprovada','servicos');
insert into public.store_members(store_id,user_id,role,funcao) values ('98000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','staff','passeador');
insert into public.services(id,store_id,name,modelo) values ('99000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','Passeio','passeio');
insert into public.walk_rules(service_id,price_30_cents,price_60_cents) values ('99000000-0000-4000-8000-000000000001',3000,5000);
insert into public.requests(id,user_id,store_id,kind,status,service_id,starts_at,ends_at,ocupado_ate,pet_id) values
 ('9a000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','servico','confirmada','99000000-0000-4000-8000-000000000001',now(),now()+interval '1 hour',now()+interval '1 hour','97000000-0000-4000-8000-000000000001'),
 ('9a000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','servico','confirmada','99000000-0000-4000-8000-000000000001',now()-interval '1 hour',now(),now(),'97000000-0000-4000-8000-000000000001');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create temp table w(id uuid);
grant all on w to authenticated;
set local role authenticated;
select pg_temp.como('96000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.passeio_iniciar('9a000000-0000-4000-8000-000000000001'); raise exception 'Tutor iniciou o passeio';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('96000000-0000-4000-8000-000000000002');
insert into w select public.passeio_iniciar('9a000000-0000-4000-8000-000000000001');
select public.passeio_fase((select id from w),'passeando');
-- ~111 m por 0,001 grau de latitude, a cada 60 s; o último ponto é um salto de GPS (vários km em 1 s).
select pg_temp.verificar(public.passeio_pontos((select id from w), jsonb_build_array(
  jsonb_build_object('lat',-22.900,'lng',-43.100,'at',now()-interval '3 minutes'),
  jsonb_build_object('lat',-22.901,'lng',-43.100,'at',now()-interval '2 minutes'),
  jsonb_build_object('lat',-22.902,'lng',-43.100,'at',now()-interval '1 minute'),
  jsonb_build_object('lat',-22.950,'lng',-43.100,'at',now()-interval '59 seconds')))=4,'Pontos não gravados');
select public.passeio_registro((select id from w),'xixi');
select pg_temp.como('96000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select (j->'walk'->>'distance_m')::int between 200 and 240 and jsonb_array_length(j->'pontos')=4 and jsonb_array_length(j->'registros')=1
  from (select public.passeio_ao_vivo('9a000000-0000-4000-8000-000000000001') j) x),'Distância ou dados do ao vivo errados');
select pg_temp.verificar((select count(*)=4 from public.walk_points),'Tutor não lê os pontos pelo RLS');
select pg_temp.como('96000000-0000-4000-8000-000000000003');
select pg_temp.verificar((select count(*)=0 from public.walk_points),'Outra conta leu os pontos');
select pg_temp.verificar((public.passeio_ao_vivo('9a000000-0000-4000-8000-000000000001')->>'disponivel')::boolean=false,'Outra conta viu o passeio');
select pg_temp.como('96000000-0000-4000-8000-000000000002');
select public.passeio_encerrar((select id from w),'Fez xixi e brincou.');
select pg_temp.como('96000000-0000-4000-8000-000000000001');
select public.avaliacao_enviar('9a000000-0000-4000-8000-000000000001',5,array['cuidado']);
reset role;
select pg_temp.verificar((select status='avaliado' from public.walks where id=(select id from w)),'Passeio não marcado como avaliado');
select pg_temp.verificar((select status='concluida' from public.requests where id='9a000000-0000-4000-8000-000000000001'),'Reserva não concluída');
select set_config('request.jwt.claims','',true);
select pg_temp.verificar(public.passeios_perdidos()=1,'Passeio perdido não detectado');
select pg_temp.verificar((select status='perdido' from public.walks where request_id='9a000000-0000-4000-8000-000000000002'),'Status perdido');
rollback;

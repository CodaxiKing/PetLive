-- Admin: pets perdidos na Moderação e números na Visão geral.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/admin-perdidos.sql
begin;
insert into auth.users(id,email) values
 ('79000000-0000-4000-8000-000000000001','admin-perdidos-tutor@example.invalid'),
 ('79000000-0000-4000-8000-000000000002','admin-perdidos-mod@example.invalid'),
 ('79000000-0000-4000-8000-000000000003','admin-perdidos-mkt@example.invalid');
insert into public.admin_members(user_id,papel) values
 ('79000000-0000-4000-8000-000000000002','moderacao'),('79000000-0000-4000-8000-000000000003','marketing');
insert into public.pets(id,tutor_id,nome,especie) values ('7a000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','Rex','cao');
insert into public.lost_alerts(id,pet_id,tutor_id,lat,lng,visto_em) values
 ('7b000000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001',-22.97,-43.18,now());
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"79000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
do $$ begin
  begin perform public.admin_perdidos(); raise exception 'Marketing viu os alertas';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"79000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select pg_temp.verificar((select count(*)=1 from jsonb_array_elements(public.admin_perdidos()) e where e->>'pet'='Rex' and e->>'status'='ativo'),'Alerta não listado');
select pg_temp.verificar((public.admin_visao()->'perdidos'->>'ativos')::int>=1,'Visão sem pets perdidos');
do $$ begin
  begin perform public.admin_perdido_encerrar('7b000000-0000-4000-8000-000000000001',''); raise exception 'Encerrou sem motivo';
  exception when raise_exception then if sqlerrm not like '%motivo%' then raise; end if; end;
end $$;
select public.admin_perdido_encerrar('7b000000-0000-4000-8000-000000000001','foto de outro animal');
reset role;
select pg_temp.verificar((select status='encerrado' from public.lost_alerts where id='7b000000-0000-4000-8000-000000000001'),'Não encerrou');
select pg_temp.verificar((select count(*)=1 from public.notification_log where user_id='79000000-0000-4000-8000-000000000001' and body like '%foto de outro animal%'),'Tutor não foi avisado');
rollback;

-- Reserva por horário: grade com duração e intervalo, vagas, folga, remarcar e lembrete.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/reservas-horario.sql
begin;
insert into auth.users(id,email) values
 ('8d000000-0000-4000-8000-000000000001','res-tutor@example.invalid'),
 ('8d000000-0000-4000-8000-000000000002','res-outro@example.invalid');
insert into public.stores(id,name,status,oferece) values ('8e000000-0000-4000-8000-000000000001','Banho Bom','aprovada','servicos');
insert into public.services(id,store_id,name,modelo,duration_min,buffer_min,capacity,price_cents) values
 ('8f000000-0000-4000-8000-000000000001','8e000000-0000-4000-8000-000000000001','Banho e tosa','horario',60,30,1,8000);
create temp table dia as select ((now() at time zone 'America/Sao_Paulo')::date + 2) d;
grant select on dia to authenticated;
insert into public.store_hours(store_id,weekday,opens,closes) select '8e000000-0000-4000-8000-000000000001', extract(dow from d)::int, '09:00', '12:00' from dia;
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
create function pg_temp.slot(h text) returns timestamptz language sql as $$ select ((select d from dia) + h::time) at time zone 'America/Sao_Paulo' $$;
create temp table res(nome text, id uuid);
grant all on res to authenticated;
set local role authenticated;
select pg_temp.como('8d000000-0000-4000-8000-000000000001');
-- 09:00 e 10:30 (60 min + 30 de intervalo, fecha às 12:00).
select pg_temp.verificar((select jsonb_array_length(public.horarios_livres('8f000000-0000-4000-8000-000000000001',(select d from dia)))=2),'Grade errada');
insert into res select 'r1', (public.servico_reservar('8f000000-0000-4000-8000-000000000001',pg_temp.slot('09:00'),null,'Tosa baixa')->>'id')::uuid;
select pg_temp.verificar((select jsonb_array_length(public.horarios_livres('8f000000-0000-4000-8000-000000000001',(select d from dia)))=1),'Horário ocupado ainda livre');
select pg_temp.como('8d000000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.servico_reservar('8f000000-0000-4000-8000-000000000001',pg_temp.slot('09:00')); raise exception 'Passou do limite de vagas';
  exception when invalid_parameter_value then null; end;
end $$;
do $$ begin
  begin perform public.servico_reservar('8f000000-0000-4000-8000-000000000001',pg_temp.slot('09:15')); raise exception 'Aceitou horário fora da grade';
  exception when invalid_parameter_value then null; end;
end $$;
-- Remarcar libera o horário antigo.
select pg_temp.como('8d000000-0000-4000-8000-000000000001');
select public.servico_remarcar((select id from res where nome='r1'),pg_temp.slot('10:30'));
select pg_temp.verificar((select (x->>'inicio')::timestamptz=pg_temp.slot('09:00') from jsonb_array_elements(public.horarios_livres('8f000000-0000-4000-8000-000000000001',(select d from dia))) x),'Remarcar não liberou 09:00');
select pg_temp.verificar((select j->'solicitacao'->>'starts_at' is not null from (select public.solicitacao_detalhe((select id from res where nome='r1')) j) x),'Detalhe sem horário');
-- Cancelar também libera.
select public.solicitacao_mudar((select id from res where nome='r1'),'cancelada');
select pg_temp.verificar((select jsonb_array_length(public.horarios_livres('8f000000-0000-4000-8000-000000000001',(select d from dia)))=2),'Cancelar não liberou');
reset role;
-- Folga bloqueia.
insert into public.time_off(store_id,starts_at,ends_at,reason) values ('8e000000-0000-4000-8000-000000000001',pg_temp.slot('10:00'),pg_temp.slot('12:00'),'Reforma');
select set_config('request.jwt.claims','{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.verificar((select jsonb_array_length(public.horarios_livres('8f000000-0000-4000-8000-000000000001',(select d from dia)))=0),'Folga não bloqueou');
-- Lembrete 2 h antes do horário confirmado.
delete from public.time_off where store_id='8e000000-0000-4000-8000-000000000001';
insert into public.requests(user_id,store_id,kind,status,service_id,starts_at,ends_at,ocupado_ate)
 values ('8d000000-0000-4000-8000-000000000001','8e000000-0000-4000-8000-000000000001','servico','confirmada','8f000000-0000-4000-8000-000000000001',now()+interval '1 hour',now()+interval '2 hours',now()+interval '150 minutes');
select pg_temp.verificar(public.reservas_lembrar()=1 and public.reservas_lembrar()=0,'Lembrete não enviado ou repetido');
rollback;

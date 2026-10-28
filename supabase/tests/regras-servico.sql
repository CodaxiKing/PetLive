-- Creche, hotelzinho e passeador: vagas por dia/noite, pacote, porte, vacinas, raio e pets por passeio.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/regras-servico.sql
begin;
insert into auth.users(id,email) values
 ('90000000-0000-4000-8000-000000000001','rs-tutor@example.invalid'),
 ('90000000-0000-4000-8000-000000000002','rs-outro@example.invalid');
insert into public.pets(id,tutor_id,nome,especie,peso_atual) values
 ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Rex','cao',28),
 ('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','Mia','gato',4);
insert into public.vaccinations(pet_id,nome,aplicada_em,proxima_dose) values ('91000000-0000-4000-8000-000000000001','V10',current_date-30,current_date+330);
insert into public.stores(id,name,status,oferece,lat,lng) values ('92000000-0000-4000-8000-000000000001','Pet Hotel','aprovada','servicos',-22.90,-43.10);
insert into public.store_hours(store_id,weekday,opens,closes) select '92000000-0000-4000-8000-000000000001', w, '08:00','18:00' from generate_series(0,6) w;
insert into public.services(id,store_id,name,modelo,capacity,requires_vaccines) values
 ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Creche','dia',1,false),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Hotel','diarias',1,true),
 ('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','Passeio','passeio',1,false);
insert into public.daycare_plans(service_id,period,price_cents,package_days,package_cents) values
 ('93000000-0000-4000-8000-000000000001','dia',6000,null,null),('93000000-0000-4000-8000-000000000001','dia',6000,2,10000);
insert into public.lodging_rates(service_id,size,night_cents) values ('93000000-0000-4000-8000-000000000002','grande',12000);
insert into public.service_extras(id,service_id,nome,price_cents,por_dia) values ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','Banho na saída',5000,false);
insert into public.walk_rules(service_id,price_30_cents,price_60_cents,radius_km,max_pets,weekdays) values ('93000000-0000-4000-8000-000000000003',3000,5000,3,1,array[0,1,2,3,4,5,6]);
insert into public.addresses(id,user_id,street,lat,lng) values
 ('95000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Rua Perto',-22.905,-43.105),
 ('95000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','Rua Longe',-23.5,-46.6);
create temp table d as select (now() at time zone 'America/Sao_Paulo')::date + 3 d1, (now() at time zone 'America/Sao_Paulo')::date + 4 d2;
grant select on d to authenticated;
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
set local role authenticated;
select pg_temp.como('90000000-0000-4000-8000-000000000001');
-- Creche: pacote de 2 diárias e vaga por dia.
select pg_temp.verificar((public.creche_reservar('93000000-0000-4000-8000-000000000001',array[(select d1 from d),(select d2 from d)],'dia',true,'91000000-0000-4000-8000-000000000001')->>'total_cents')::int=10000,'Preço do pacote');
select pg_temp.verificar((public.servico_detalhe('93000000-0000-4000-8000-000000000001')->'vagas'->>((select d1 from d)::text))::int=0,'Vagas do dia não baixaram');
select pg_temp.como('90000000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.creche_reservar('93000000-0000-4000-8000-000000000001',array[(select d1 from d)],'dia',false,'91000000-0000-4000-8000-000000000002'); raise exception 'Passou do limite da creche';
  exception when invalid_parameter_value then null; end;
end $$;
-- Hotel: porte, vacinas e extras.
do $$ begin
  begin perform public.hotel_reservar('93000000-0000-4000-8000-000000000002',(select d1 from d),(select d2 from d)+1,'91000000-0000-4000-8000-000000000002'); raise exception 'Aceitou porte sem tarifa';
  exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.como('90000000-0000-4000-8000-000000000001');
select pg_temp.verificar((public.hotel_reservar('93000000-0000-4000-8000-000000000002',(select d1 from d),(select d2 from d)+1,'91000000-0000-4000-8000-000000000001',array['94000000-0000-4000-8000-000000000001'::uuid])->>'total_cents')::int=29000,'Preço do hotel (2 noites + extra)');
do $$ begin
  begin perform public.hotel_reservar('93000000-0000-4000-8000-000000000002',(select d2 from d),(select d2 from d)+1,'91000000-0000-4000-8000-000000000001'); raise exception 'Passou do limite do hotel';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
update public.vaccinations set proxima_dose=current_date-1 where pet_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('90000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.hotel_reservar('93000000-0000-4000-8000-000000000002',(select d2 from d)+5,(select d2 from d)+6,'91000000-0000-4000-8000-000000000001'); raise exception 'Aceitou vacina vencida';
  exception when invalid_parameter_value then if sqlerrm not like '%vacinas%' then raise; end if; end;
end $$;
-- Passeio: raio e um pet por passeio.
create temp table ph as select (x->>'inicio')::timestamptz ini from jsonb_array_elements(public.passeio_horarios('93000000-0000-4000-8000-000000000003',(select d1 from d),60)) x limit 1;
select public.passeio_reservar('93000000-0000-4000-8000-000000000003',(select ini from ph),60,'91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001');
select pg_temp.como('90000000-0000-4000-8000-000000000002');
do $$ begin
  begin perform public.passeio_reservar('93000000-0000-4000-8000-000000000003',(select ini from ph),30,'91000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002'); raise exception 'Aceitou fora do raio';
  exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.verificar(not exists (select 1 from jsonb_array_elements(public.passeio_horarios('93000000-0000-4000-8000-000000000003',(select d1 from d),60)) x where (x->>'inicio')::timestamptz=(select ini from ph)),'Horário do passeio ainda livre');
rollback;

-- Pet perdido (BUSINESS.md 5.29).
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/pet-perdido.sql
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('81000000-0000-4000-8000-000000000001','perdido-tutor@example.invalid','{"nome":"Diego"}'),
 ('81000000-0000-4000-8000-000000000002','perdido-perto@example.invalid','{"nome":"Vizinha"}'),
 ('81000000-0000-4000-8000-000000000003','perdido-longe@example.invalid','{"nome":"Longe"}');
update public.profiles set telefone='21999990000' where id='81000000-0000-4000-8000-000000000001';
insert into public.pets(id,tutor_id,nome,especie,raca) values ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Rex','cao','Labrador');
insert into public.pet_qr_settings(pet_id,code) values ('82000000-0000-4000-8000-000000000001','codigo-perdido-teste');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;
set local role authenticated;
-- Vizinha perto (Copacabana) e outra pessoa longe (Niterói ~10 km) ligam os avisos.
select pg_temp.como('81000000-0000-4000-8000-000000000002');
select public.perdido_regiao_configurar(true,-22.97,-43.18);
select pg_temp.como('81000000-0000-4000-8000-000000000003');
select public.perdido_regiao_configurar(true,-22.90,-43.10);
-- Tutor dispara o alerta com raio de 2 km.
select pg_temp.como('81000000-0000-4000-8000-000000000001');
select set_config('teste.alerta', (public.perdido_alertar('82000000-0000-4000-8000-000000000001',-22.971,-43.182,now()-interval '1 hour',2,'Assustado, coleira vermelha',true))->>'id', true);
reset role;
select pg_temp.verificar((select count(*)=1 from public.lost_alert_receipts),'Só quem está no raio devia receber');
set local role authenticated;
do $$ begin
  begin perform public.perdido_alertar('82000000-0000-4000-8000-000000000001',-22.97,-43.18); raise exception 'Dois alertas ativos para o mesmo pet';
  exception when unique_violation then null; end;
end $$;
-- Reenviar não repete o aviso.
reset role;
select public.perdido_enviar(current_setting('teste.alerta')::uuid);
set local role authenticated;
select pg_temp.como('81000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*)=1 from public.notification_log where type='perdido'),'Aviso repetido ou ausente');
select pg_temp.verificar((public.perdido_alerta(current_setting('teste.alerta')::uuid)->>'telefone')='21999990000','Telefone liberado não aparece');
select pg_temp.verificar((select count(*)=0 from public.lost_alerts),'Estranho leu a tabela de alertas');
-- Vizinha avisa que viu; não encerra o alerta.
select public.perdido_avistar(current_setting('teste.alerta')::uuid,-22.968,-43.185,now(),'Na praça',false,null);
do $$ begin
  begin perform public.perdido_encerrar(current_setting('teste.alerta')::uuid,true); raise exception 'Quem viu encerrou o alerta';
  exception when insufficient_privilege then null; end;
end $$;
-- Tutor vê o avistamento, sem saber quem avisou.
select pg_temp.como('81000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*)=1 from public.lost_alert_sightings where mensagem='Na praça'),'Tutor não vê o avistamento');
do $$ begin
  begin perform autor_id from public.lost_alert_sightings; raise exception 'Tutor viu quem avisou';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.verificar((select count(*)>=1 from public.notification_log where type='perdido' and title like 'Alguém viu%'),'Tutor não foi avisado do avistamento');
-- QR mostra procurado e a localização enviada vira avistamento.
set local role anon;
select set_config('request.headers','{"x-forwarded-for":"perdido-qr"}',true);
select pg_temp.verificar((public.qr_pet_publico('codigo-perdido-teste')->'procurado'->>'mensagem')='Assustado, coleira vermelha','QR não mostra procurado');
select public.qr_enviar_localizacao('codigo-perdido-teste',-22.96,-43.19,10,'Está comigo');
set local role authenticated;
select pg_temp.como('81000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*)=1 from public.lost_alert_sightings where origem='qr'),'Localização do QR não virou avistamento');
select public.perdido_encerrar(current_setting('teste.alerta')::uuid,true);
set local role anon;
select pg_temp.verificar(public.qr_pet_publico('codigo-perdido-teste')->'procurado' is null,'QR continua procurado depois de encontrado');
rollback;

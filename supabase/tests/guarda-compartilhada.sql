-- Guarda compartilhada (BUSINESS.md 5.45). Rodar no banco local:
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/guarda-compartilhada.sql
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('41000000-0000-4000-8000-000000000001','titular@example.invalid','{"nome":"Diego"}'),
 ('41000000-0000-4000-8000-000000000002','ana@example.invalid','{"nome":"Ana"}'),
 ('41000000-0000-4000-8000-000000000003','estranho@example.invalid','{"nome":"Estranho"}');
update public.profiles set plano='premium' where id='41000000-0000-4000-8000-000000000001';
insert into public.pets(id,tutor_id,nome,especie) values
 ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Rex','cao'),
 ('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','Mia','gato');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true) $$;

set local role authenticated;

-- Titular convida Ana para os dois pets.
select pg_temp.como('41000000-0000-4000-8000-000000000001');
select set_config('teste.convite',
  public.guarda_convidar(array['42000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000002']::uuid[],' ANA@example.invalid ')->>'id', true);
do $$ begin
  begin perform public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'ana@example.invalid');
    raise exception 'Convite duplicado aceito';
  exception when unique_violation then null; end;
end $$;

-- Antes do aceite, Ana não vê os pets e recebeu o aviso.
select pg_temp.como('41000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*)=0 from public.pets),'Acesso antes do aceite');
select pg_temp.verificar((select count(*)=1 from public.notification_log where type='guarda'),'Convidada não foi avisada');
select pg_temp.verificar(public.guarda_convite(current_setting('teste.convite')::uuid)->>'situacao'='enviado','Convite não abriu para a convidada');

-- Um estranho não abre nem responde o convite.
select pg_temp.como('41000000-0000-4000-8000-000000000003');
select pg_temp.verificar((public.guarda_convite(current_setting('teste.convite')::uuid)->>'encontrado')::boolean = false,'Estranho abriu o convite');
do $$ begin
  begin perform public.guarda_responder(current_setting('teste.convite')::uuid,true);
    raise exception 'Estranho aceitou';
  exception when no_data_found or sqlstate 'P0002' then null; end;
end $$;

-- Ana aceita só o Rex.
select pg_temp.como('41000000-0000-4000-8000-000000000002');
select public.guarda_responder(current_setting('teste.convite')::uuid,true,array['42000000-0000-4000-8000-000000000001']::uuid[]);
select pg_temp.verificar((select array_agg(nome)=array['Rex'] from public.pets),'Aceite parcial errado');

-- Ana atualiza a saúde do Rex; o titular vê o autor e recebe o aviso.
insert into public.vaccinations(pet_id,nome,aplicada_em) values ('42000000-0000-4000-8000-000000000001','V10',current_date);
select pg_temp.verificar((select criado_por='41000000-0000-4000-8000-000000000002' from public.vaccinations),'Autor não gravado');
select pg_temp.verificar((select count(*)=1 from public.pet_activity where tipo='vacina'),'Atividade não registrada');
-- Ana não apaga o pet nem convida pessoas.
delete from public.pets where id='42000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select count(*)=1 from public.pets),'Membro apagou o pet');
do $$ begin
  begin perform public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'outro@example.invalid');
    raise exception 'Membro convidou';
  exception when insufficient_privilege then null; end;
end $$;

-- Dose marcada uma vez só.
insert into public.medications(id,pet_id,nome,dose,frequencia,horarios,inicio)
  values ('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Antibiótico','1 comprimido','2x ao dia','{08:00}',current_date);
insert into public.medication_doses(id,medication_id,prevista_para) values ('44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001',now());
update public.medication_doses set confirmada_em=now() where id='44000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select confirmada_por_id='41000000-0000-4000-8000-000000000002' from public.medication_doses),'Quem deu a dose não foi gravado');

select pg_temp.como('41000000-0000-4000-8000-000000000001');
select pg_temp.verificar((select count(*)=4 from public.notification_log where type='guarda'),'Titular não recebeu aceite, vacina, remédio e dose');
do $$ begin
  begin update public.medication_doses set confirmada_em=now()+interval '1 minute' where id='44000000-0000-4000-8000-000000000001';
    raise exception 'Dose marcada duas vezes';
  exception when raise_exception then
    if sqlerrm not like 'Ana já marcou às%' then raise; end if;
  end;
end $$;
select pg_temp.verificar((public.guarda_painel()->'pessoas'->0->>'nome')='Ana','Painel sem a Ana');
insert into public.marcos(pet_id,data,titulo) values ('42000000-0000-4000-8000-000000000001',current_date,'Primeiro banho');
select pg_temp.como('41000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*)=1 from public.marcos),'Linha do tempo não aparece para quem divide a guarda');
select pg_temp.como('41000000-0000-4000-8000-000000000003');
select pg_temp.verificar((select count(*)=0 from public.marcos),'Linha do tempo vazou para estranho');
select pg_temp.como('41000000-0000-4000-8000-000000000001');
select pg_temp.verificar(jsonb_array_length(public.guarda_cuidadores('42000000-0000-4000-8000-000000000001')->'pessoas')=1,'Cuidadores errados');

-- Limite de 4 pessoas por pet (Ana + 3 convites em aberto).
select public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'p1@example.invalid');
select public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'p2@example.invalid');
select public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'p3@example.invalid');
do $$ begin
  begin perform public.guarda_convidar(array['42000000-0000-4000-8000-000000000001']::uuid[],'p4@example.invalid');
    raise exception 'Passou do limite';
  exception when check_violation then null; end;
end $$;

-- Sem Premium, a guarda fica pausada para a Ana.
reset role;
update public.profiles set plano='gratis' where id='41000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.como('41000000-0000-4000-8000-000000000002');
select pg_temp.verificar((select count(*)=0 from public.pets),'Guarda continuou sem Premium');
select pg_temp.verificar((public.guarda_painel()->'comigo'->0->>'suspensa')::boolean,'Painel não mostra a pausa');

-- Ana sai da guarda; o titular é avisado.
select public.guarda_sair();
select pg_temp.verificar(jsonb_array_length(public.guarda_painel()->'comigo')=0,'Saída não removeu o vínculo');
rollback;

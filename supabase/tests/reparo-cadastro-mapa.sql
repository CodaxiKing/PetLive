begin;
insert into public.profiles(id,nome) values
 ('41000000-0000-4000-8000-000000000001','Tutor A'),('41000000-0000-4000-8000-000000000002','Tutor B');
insert into public.places(nome,categoria,lat,lng) values
 ('FIX Clínica','clinica',-22.75,-43.45),('FIX Parque','parque',-22.751,-43.451),('FIX Distante','petshop',-22.8,-43.5);
create function pg_temp.verificar(ok boolean,mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
insert into public.pets(tutor_id,nome,especie) values('41000000-0000-4000-8000-000000000001','Mia','gato');
select pg_temp.verificar((select count(*)=1 from public.pets),'Tutor não conseguiu ler o pet recém criado');
do $$ begin
 begin
  insert into public.pets(tutor_id,nome,especie) values('41000000-0000-4000-8000-000000000002','Intruso','cao');
  raise exception 'Tutor criou pet em outra conta';
 exception when insufficient_privilege then null; end;
 begin
  update public.pets set tutor_id='41000000-0000-4000-8000-000000000002';
  raise exception 'Tutor transferiu pet sem autorização';
 exception when insufficient_privilege then null; end;
end $$;
update public.pets set foto_url='https://example.invalid/mia.png';
select pg_temp.verificar((select count(*)=1 from public.lugares_por_perto(-22.75,-43.45,p_busca=>'FIX',p_raio_km=>3)),'Serviços ou raio incorretos');
select pg_temp.verificar((select count(*)=1 from public.lugares_por_perto(-22.75,-43.45,p_busca=>'FIX',p_raio_km=>3,p_grupo=>'pet_friendly')),'Filtro pet friendly incorreto');
select pg_temp.verificar((select count(*)=0 from public.lugares_por_perto(-22.75,-43.45,p_categoria=>'creche',p_busca=>'FIX',p_raio_km=>3)),'Categoria ignorada');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);
select pg_temp.verificar((select count(*)=0 from public.pets),'Tutor B viu pet do A');
set local role anon;
do $$ begin
 begin
  perform public.lugares_por_perto(-22.75,-43.45);
  raise exception 'Anônimo executou a RPC autenticada';
 exception when insufficient_privilege then null; end;
end $$;
rollback;

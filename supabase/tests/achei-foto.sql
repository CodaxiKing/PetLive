-- Achei um pet por foto: recurso desligado bloqueia, só alertas com aceite, limite diário e limpeza em 24 h.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/achei-foto.sql
begin;
insert into auth.users(id,email) values
 ('75000000-0000-4000-8000-000000000001','achei-tutor@example.invalid'),
 ('75000000-0000-4000-8000-000000000002','achei-buscou@example.invalid');
insert into public.pets(id,tutor_id,nome,especie,foto_url) values
 ('76000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','Rex','cao','https://exemplo.invalid/rex.jpg'),
 ('76000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000001','Mia','gato','https://exemplo.invalid/mia.jpg');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
update public.recursos set ligado=false where chave='achei_foto';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.perdido_alertar('76000000-0000-4000-8000-000000000001',-22.97,-43.18,now(),2,null,false,true);
select public.perdido_alertar('76000000-0000-4000-8000-000000000002',-22.97,-43.18,now(),2,null,false,false);
select set_config('request.jwt.claims','{"sub":"75000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin perform public.achei_reservar(-22.97,-43.18); raise exception 'Busca com o recurso desligado';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
update public.recursos set ligado=true where chave='achei_foto';
set local role authenticated;
create temp table r as select public.achei_reservar(-22.971,-43.181) as j;
select pg_temp.verificar((select jsonb_array_length(j->'alertas')=1 and j->'alertas'->0->>'nome'='Rex' from r),'Deveria vir só o alerta com aceite');
select public.achei_concluir((select (j->>'id')::uuid from r), true, '[{"alert_id":"x","nivel":"muito_parecido"},{"alert_id":"y","nivel":"99%"}]');
-- Busca que falhou não conta no limite.
select public.achei_concluir((public.achei_reservar(-22.97,-43.18)->>'id')::uuid, false);
do $$ declare i int; begin for i in 1..4 loop perform public.achei_reservar(-22.97,-43.18); end loop; end $$;
do $$ begin
  begin perform public.achei_reservar(-22.97,-43.18); raise exception 'Limite diário não aplicado';
  exception when check_violation then null; end;
end $$;
do $$ begin
  begin perform 1 from public.achei_buscas; raise exception 'Leu as buscas direto';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.verificar((select candidatos=('[{"alert_id":"x","nivel":"muito_parecido"}]'::jsonb) from public.achei_buscas where status='concluida' and user_id='75000000-0000-4000-8000-000000000002'),'Nível inválido foi guardado');
update public.achei_buscas set criado_em=now()-interval '25 hours' where user_id='75000000-0000-4000-8000-000000000002';
select pg_temp.verificar(public.achei_limpar()=5,'Limpeza de 24 h');
rollback;

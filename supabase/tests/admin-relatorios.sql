-- Relatórios do admin: funil até o Premium e cidades agrupadas (menos de 5 tutores vira "Outras").
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/admin-relatorios.sql
begin;
insert into auth.users(id,email) select ('7c000000-0000-4000-8000-0000000000'||lpad(i::text,2,'0'))::uuid, 'rel'||i||'@example.invalid' from generate_series(1,8) i;
update public.profiles set cidade = case when id::text < '7c000000-0000-4000-8000-000000000006' then 'Niterói' else 'Maricá' end
 where id::text like '7c000000-0000-4000-8000-%';
update public.profiles set cidade = ' niterói ' where id='7c000000-0000-4000-8000-000000000005';
insert into public.subscriptions(tutor_id,provedor,referencia_provedor,ciclo,status,periodo_inicio,periodo_fim,valor_centavos)
 values ('7c000000-0000-4000-8000-000000000001','google_play','ref-teste-1','mensal','em_teste',now(),now()+interval '7 days',0),
        ('7c000000-0000-4000-8000-000000000002','google_play','ref-teste-2','mensal','ativa',now(),now()+interval '30 days',1990);
insert into public.admin_members(user_id,papel) values ('7c000000-0000-4000-8000-000000000008','marketing');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7c000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal2"}',true);
create temp table r as select public.admin_relatorios(30) j;
select pg_temp.verificar((select (j->'funil'->>'premium_teste')::int>=2 and (j->'funil'->>'premium_pago')::int>=1 from r),'Funil do Premium');
select pg_temp.verificar((select count(*)=1 from r, jsonb_array_elements(j->'cidades') c where lower(c->>'cidade')='niterói' and (c->>'tutores')::int>=5),'Niterói com 5 tutores');
select pg_temp.verificar((select count(*)<=1 from r, jsonb_array_elements(j->'cidades') c where c->>'cidade'='Outras'),'Outras repetida');
select pg_temp.verificar((select count(*)=0 from r, jsonb_array_elements(j->'cidades') c where c->>'cidade'='Maricá'),'Cidade com menos de 5 apareceu');
rollback;

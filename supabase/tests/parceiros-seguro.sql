-- Plano e seguro pet com parceiros: só ativos aparecem, clique registrado uma vez por hora.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/parceiros-seguro.sql
begin;
insert into auth.users(id,email) values ('73000000-0000-4000-8000-000000000001','parceiros-tutor@example.invalid');
insert into public.insurance_partners(id,nome,beneficios,preco_texto,url,ativo) values
 ('74000000-0000-4000-8000-000000000001','Parceiro Ativo','Consultas e vacinas','a partir de R$ 39/mês','https://exemplo.invalid/cotar',true),
 ('74000000-0000-4000-8000-000000000002','Parceiro Inativo','Cirurgias',null,'https://exemplo.invalid/outro',false);
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role anon;
do $$ begin
  begin perform 1 from public.insurance_partners; raise exception 'Anônimo leu parceiros';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.verificar((select count(*)=1 from public.insurance_partners where id::text like '74000000%'),'Parceiro inativo apareceu');
select pg_temp.verificar(public.parceiro_cotar('74000000-0000-4000-8000-000000000001')='https://exemplo.invalid/cotar','Link errado');
select public.parceiro_cotar('74000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.parceiro_cotar('74000000-0000-4000-8000-000000000002'); raise exception 'Cotou parceiro inativo';
  exception when invalid_parameter_value then null; end;
end $$;
do $$ begin
  begin perform public.admin_parceiro_salvar(null,'X','plano','Y',null,'https://x.invalid',1,true); raise exception 'Tutor salvou parceiro';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.verificar((select count(*)=1 from public.insurance_clicks where partner_id='74000000-0000-4000-8000-000000000001'),'Clique repetido ou não registrado');
rollback;

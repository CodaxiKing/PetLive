-- Conteúdo de cuidado: tutor lê só o ativo; marketing edita o luto com revisão; idade e escala só o super.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/conteudo-cuidado.sql
begin;
insert into auth.users(id,email) values
 ('7d000000-0000-4000-8000-000000000001','cuidado-tutor@example.invalid'),
 ('7d000000-0000-4000-8000-000000000002','cuidado-mkt@example.invalid'),
 ('7d000000-0000-4000-8000-000000000003','cuidado-super@example.invalid');
insert into public.admin_members(user_id,papel) values ('7d000000-0000-4000-8000-000000000002','marketing'),('7d000000-0000-4000-8000-000000000003','super');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7d000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
create temp table novo as select public.admin_luto_salvar(null,'texto','Rascunho','Texto inativo',null,5,false,'Psicóloga Ana, CRP 05/123') id;
do $$ begin
  begin perform public.admin_luto_salvar(null,'texto','Sem revisão','Texto',null,5,true,''); raise exception 'Salvou sem revisão';
  exception when raise_exception then if sqlerrm not like '%revisou%' then raise; end if; end;
end $$;
do $$ begin
  begin perform public.admin_escala_item_salvar('dor','Dor','x','Dra. Y, CRMV 1'); raise exception 'Marketing editou a escala';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"7d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select public.admin_escala_item_salvar('dor','Dor','10 = nenhum sinal de dor; 0 = dor o tempo todo','Dra. Y, CRMV-RJ 1');
select set_config('request.jwt.claims','{"sub":"7d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.verificar((select count(*)=0 from public.luto_recursos where titulo='Rascunho'),'Tutor viu texto inativo');
select pg_temp.verificar((select pergunta like '10 = nenhum%' from public.escala_itens where chave='dor'),'Escala não atualizada');
rollback;

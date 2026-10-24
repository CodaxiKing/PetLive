begin;
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;

select pg_temp.verificar(not has_column_privilege('authenticated','public.profiles','plano','UPDATE'),'Tutor ainda pode mudar plano');
select pg_temp.verificar(not has_column_privilege('authenticated','public.profiles','role','UPDATE'),'Tutor ainda pode mudar papel');
select pg_temp.verificar(not has_column_privilege('anon','public.profiles','plano','UPDATE'),'Grants herdados do PUBLIC não removidos');
select pg_temp.verificar(not has_any_column_privilege('authenticated','public.profiles','INSERT'),'Tutor ainda pode inserir perfil pela API');
select pg_temp.verificar(not has_table_privilege('authenticated','public.profiles','TRUNCATE'),'Tutor ainda pode esvaziar perfis');
alter table public.profiles add column campo_futuro_reservado text;
select pg_temp.verificar(not has_column_privilege('authenticated','public.profiles','campo_futuro_reservado','UPDATE'),'Nova coluna recebeu edição indevida');

set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-4000-8000-000000000001',true);
update public.profiles set nome='Tutor atualizado',telefone='21999999999',cidade='Nova Iguaçu',
  whatsapp=false,contato_emergencia_nome='Contato',contato_emergencia_telefone='21988888888',aceite_termos=true
  where id=auth.uid();
select pg_temp.verificar((select nome='Tutor atualizado' and aceite_termos and not whatsapp from public.profiles where id=auth.uid()),'Edição de dados pessoais bloqueada');
select pg_temp.verificar((select count(*)=1 from public.profiles),'Leitura de outra conta permitida');
update public.profiles set nome='Invadido' where id='42000000-0000-4000-8000-000000000002';
select pg_temp.verificar((select count(*)=0 from public.profiles where nome='Invadido'),'Atualização cruzada permitida');

do $$
declare coluna text;
begin
  foreach coluna in array array['plano','role','provider','email','id','criado_em'] loop
    begin
      execute format('update public.profiles set %I=%I where id=auth.uid()',coluna,coluna);
      raise exception 'Campo reservado editável: %',coluna;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    update public.profiles set nome='Alteracao parcial',plano='premium',role='admin_super' where id=auth.uid();
    raise exception 'Elevação de benefício e papel permitida';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(id,nome,plano,role) values('42000000-0000-4000-8000-000000000003','Injetado','premium','admin_super');
    raise exception 'Inserção de benefício pela API permitida';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(id,nome) values(auth.uid(),'Upsert') on conflict(id) do update set plano='premium';
    raise exception 'Upsert de benefício pela API permitido';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.verificar((select nome='Tutor atualizado' and plano='gratis' and role='tutor' from public.profiles where id=auth.uid()),'Pedido negado alterou parcialmente o perfil');

set local role anon;
do $$ begin
  begin
    update public.profiles set plano='premium';
    raise exception 'Anônimo alterou plano';
  exception when insufficient_privilege then null; end;
end $$;

set local role service_role;
update public.profiles set plano='premium' where id='42000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select plano='premium' from public.profiles where id='42000000-0000-4000-8000-000000000001'),'Servidor não consegue conceder benefício');
update public.profiles set plano='gratis' where id='42000000-0000-4000-8000-000000000001';
select pg_temp.verificar((select plano='gratis' from public.profiles where id='42000000-0000-4000-8000-000000000001'),'Servidor não consegue retirar benefício');
insert into public.profiles(id,nome) values('42000000-0000-4000-8000-000000000004','Cadastro servidor');

reset role;
insert into auth.users(id,nome) values('42000000-0000-4000-8000-000000000005','Cadastro pelo Auth');
select pg_temp.verificar((select plano='gratis' and role='tutor' from public.profiles where id='42000000-0000-4000-8000-000000000005'),'Trigger de cadastro confiável bloqueado');
select pg_temp.verificar((select nome='Tutor B' from public.profiles where id='42000000-0000-4000-8000-000000000002'),'Outra conta foi alterada');
select pg_temp.verificar((select count(*)=0 from public.profiles where role<>'tutor'),'Papel indevido persistiu');
rollback;

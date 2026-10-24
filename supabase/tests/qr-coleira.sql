begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('31000000-0000-4000-8000-000000000001','qr-1@example.invalid','{"nome":"Tutor QR"}'),
 ('31000000-0000-4000-8000-000000000002','qr-2@example.invalid','{"nome":"Outro QR"}');
update public.profiles set telefone='11999999999' where id='31000000-0000-4000-8000-000000000001';
insert into public.pets(id,tutor_id,nome,especie,alergias,foto_url,observacoes) values
 ('32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Mia QR','gato','ALERGIA_PRIVADA','https://example.invalid/mia.png','NOTA_PRIVADA');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001"}',true);
select public.salvar_qr_pet('32000000-0000-4000-8000-000000000001',false,false,false,true);
select set_config('teste.qr',(select code from public.pet_qr_settings where pet_id='32000000-0000-4000-8000-000000000001'),true);
select pg_temp.verificar(length(current_setting('teste.qr'))=48,'Código sem entropia suficiente');

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002"}',true);
select pg_temp.verificar((select count(*)=0 from public.pet_qr_settings),'RLS expôs QR de outro tutor');
do $$ begin
  begin
    perform public.salvar_qr_pet('32000000-0000-4000-8000-000000000001',true,true,true,true);
    raise exception 'Outro tutor alterou o QR';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.headers','{"x-forwarded-for":"qr-teste-isolado"}',true);
select pg_temp.verificar(public.qr_pet_publico(current_setting('teste.qr')) = '{"valido":true,"pet":{"nome":"Mia QR","especie":"gato"}}'::jsonb,'Campos não autorizados vazaram');
do $$ begin
  begin
    perform public.salvar_qr_pet('32000000-0000-4000-8000-000000000001',true,true,true,true);
    raise exception 'Anônimo salvou QR';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001"}',true);
select public.salvar_qr_pet('32000000-0000-4000-8000-000000000001',true,true,true,true);
select pg_temp.verificar((select code=current_setting('teste.qr') from public.pet_qr_settings),'Código mudou ao editar');
set local role anon;
select pg_temp.verificar(public.qr_pet_publico(current_setting('teste.qr'))->'pet'->>'telefone'='11999999999','Telefone autorizado ausente');
select pg_temp.verificar(public.qr_pet_publico(current_setting('teste.qr'))->'pet'->>'alergias'='ALERGIA_PRIVADA','Alergia autorizada ausente');
select pg_temp.verificar(not (public.qr_pet_publico(current_setting('teste.qr'))->'pet' ? 'observacoes'),'Observações vazaram');
reset role;
update public.pet_qr_settings set active=false;
set local role anon;
select pg_temp.verificar(public.qr_pet_publico(current_setting('teste.qr'))='{"valido":false}'::jsonb,'QR desativado abriu');
reset role;
update public.pet_qr_settings set active=true;
update public.pets set em_memoria=true where id='32000000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.verificar(public.qr_pet_publico(current_setting('teste.qr'))='{"valido":false}'::jsonb,'Memorial abriu QR');
select pg_temp.verificar(public.qr_pet_publico('nao-existe')='{"valido":false}'::jsonb,'Código inexistente abriu');
select set_config('request.headers','{"x-forwarded-for":"qr-teste-limite"}',true);
do $$ begin for i in 1..60 loop perform public.qr_pet_publico('nao-existe'); end loop; end $$;
select pg_temp.verificar(public.qr_pet_publico('nao-existe')='{"limite":true}'::jsonb,'Limite não aplicado');
rollback;

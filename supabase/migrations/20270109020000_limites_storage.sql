-- Complementa limites já existentes, sem ligar a configuração comercial.
begin;
create or replace function public.plano_limitar_storage() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_pet text;v_bucket text;v_nome text;v_id uuid;
begin
 if not exists(select 1 from public.plano_limites_config where id and ativo) then return new;end if;
 -- Checa o vínculo antigo e novo para não mover um arquivo de um pet excedente.
 for v_bucket,v_nome in select b,n from (
  select new.bucket_id b,new.name n union all select old.bucket_id,old.name where tg_op='UPDATE') as arquivos loop
  v_pet:=null;
  if v_bucket='pets' then v_pet:=split_part(split_part(v_nome,'/',2),'.',1);
  elsif v_bucket='anexos' and split_part(v_nome,'/',2)='saude' then v_pet:=split_part(v_nome,'/',3);end if;
  if v_pet ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
   select id into v_id from public.pets where id=v_pet::uuid and tutor_id::text=split_part(v_nome,'/',1);
   if v_id is not null and not public.plano_pet_editavel(v_id) then raise exception 'Este pet está somente em leitura no plano atual.';end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function public.plano_limitar_storage() from public,anon,authenticated;
drop trigger if exists petlive_limite_storage on storage.objects;
create trigger petlive_limite_storage before insert or update on storage.objects for each row execute function public.plano_limitar_storage();
commit;

-- Preparação do limite definido em BUSINESS.md 10: 1 pet no grátis.
-- Nada é ativado enquanto a compra Premium não estiver disponível.
begin;
create table if not exists public.plano_limites_config (
 id boolean primary key default true check(id),
 ativo boolean not null default false,
 pets_gratis integer not null default 1 check(pets_gratis between 1 and 20)
);
insert into public.plano_limites_config(id) values(true) on conflict do nothing;
alter table public.plano_limites_config enable row level security;
revoke all on public.plano_limites_config from public,anon,authenticated;
grant select,update on public.plano_limites_config to service_role;

create or replace function public.plano_pet_editavel(p_pet uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_tutor uuid;v_memoria boolean;v_plano text;v_limite int;
begin
 select pets_gratis into v_limite from public.plano_limites_config where id and ativo;
 if not found then return true;end if;
 select tutor_id,em_memoria into v_tutor,v_memoria from public.pets where id=p_pet;
 -- Cascatas de exclusão da conta/pet não são bloqueadas pelo limite.
 if not found then return true;end if;
 select plano into v_plano from public.profiles where id=v_tutor for update;
 if not found or v_plano='premium' or v_memoria then return true;end if;
 return p_pet in(select id from public.pets where tutor_id=v_tutor and not coalesce(em_memoria,false) order by criado_em,id limit v_limite);
end $$;
revoke all on function public.plano_pet_editavel(uuid) from public,anon,authenticated;

create or replace function public.plano_limitar_pet() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_plano text;v_limite int;v_alocar boolean;
begin
 select pets_gratis into v_limite from public.plano_limites_config where id and ativo;
 if not found then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' then
  if not public.plano_pet_editavel(old.id) then raise exception 'Este pet está somente em leitura no plano atual.';end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.tutor_id is distinct from new.tutor_id then raise exception 'Não é possível transferir o pet por esta operação.';end if;
 select plano into v_plano from public.profiles where id=new.tutor_id for update;
 if not found or v_plano='premium' then return new;end if;
 if tg_op='UPDATE' then
  if old.criado_em is distinct from new.criado_em then raise exception 'A data de cadastro do pet não pode ser alterada.';end if;
  -- Registrar a partida não exige assinatura, inclusive para pets excedentes.
  if not coalesce(old.em_memoria,false) and new.em_memoria and
    (to_jsonb(new)-'em_memoria'-'atualizado_em'-'atualizado_por')=(to_jsonb(old)-'em_memoria'-'atualizado_em'-'atualizado_por') then return new;end if;
 end if;
 v_alocar:=tg_op='INSERT';
 if tg_op='UPDATE' then v_alocar:=coalesce(old.em_memoria,false) and not coalesce(new.em_memoria,false);end if;
 if v_alocar and not coalesce(new.em_memoria,false) then
  if (select count(*) from public.pets where tutor_id=new.tutor_id and not coalesce(em_memoria,false))>=v_limite then
   raise exception 'O limite de pets do plano grátis foi atingido.';
  end if;
 elsif tg_op='UPDATE' and not public.plano_pet_editavel(old.id) then
  raise exception 'Este pet está somente em leitura no plano atual.';
 end if;
 return new;
end $$;
revoke all on function public.plano_limitar_pet() from public,anon,authenticated;
drop trigger if exists zz_plano_limite_pet on public.pets;
create trigger zz_plano_limite_pet before insert or update or delete on public.pets for each row execute function public.plano_limitar_pet();

create or replace function public.plano_limitar_registro_pet() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_novo jsonb;v_antigo jsonb;v_pet uuid;v_id uuid;
begin
 if not exists(select 1 from public.plano_limites_config where id and ativo) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_op<>'INSERT' then v_antigo:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then v_novo:=to_jsonb(new);end if;
 -- Verifica os dois vínculos para impedir mover registros de um pet só leitura.
 for v_pet in select distinct nullif(dados->>'pet_id','')::uuid from (values(v_antigo),(v_novo))d(dados) where dados->>'pet_id' is not null loop
  if not public.plano_pet_editavel(v_pet) then raise exception 'Este pet está somente em leitura no plano atual.';end if;
 end loop;
 if tg_table_name='medication_doses' then
  for v_id in select distinct nullif(dados->>'medication_id','')::uuid from (values(v_antigo),(v_novo))d(dados) where dados->>'medication_id' is not null loop
   select pet_id into v_pet from public.medications where id=v_id;
   if v_pet is not null and not public.plano_pet_editavel(v_pet) then raise exception 'Este pet está somente em leitura no plano atual.';end if;
  end loop;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.plano_limitar_registro_pet() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['vaccinations','dewormings','weights','visits','medications','medication_doses','reminders','documentos_saude','marcos','despesas','passeios_tutor','viagens','senior','qualidade_vida'] loop
  if to_regclass('public.'||t) is not null then
   execute format('drop trigger if exists zz_plano_limite_registro on public.%I',t);
   execute format('create trigger zz_plano_limite_registro before insert or update or delete on public.%I for each row execute function public.plano_limitar_registro_pet()',t);
  end if;
 end loop;
end $$;

create or replace function public.limites_meu_plano(p_tutor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_ativo boolean;v_limite int;v_plano text;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.';end if;
 select coalesce(ativo,false),pets_gratis into v_ativo,v_limite from public.plano_limites_config where id;
 select plano into v_plano from public.profiles where id=p_tutor;
 return jsonb_build_object('limites_ativos',coalesce(v_ativo,false),'plano',v_plano,
  'pets_limite',case when v_ativo and v_plano is distinct from 'premium' then v_limite else null end,
  'pets_somente_leitura',coalesce((select jsonb_agg(p.id order by p.criado_em,p.id) from public.pets p where p.tutor_id=p_tutor and not public.plano_pet_editavel(p.id)),'[]'::jsonb));
end $$;
revoke all on function public.limites_meu_plano(uuid) from public,anon;
grant execute on function public.limites_meu_plano(uuid) to authenticated;
commit;

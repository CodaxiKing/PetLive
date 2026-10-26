-- Expõe a quota do titular sem inferir contagem a partir de pets compartilhados.
-- Não altera a flag comercial nem as regras de gravação existentes.
begin;
create or replace function public.limites_meu_plano(p_tutor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_ativo boolean;v_limite int;v_plano text;v_pets bigint;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.';end if;
 select coalesce(ativo,false),pets_gratis into v_ativo,v_limite from public.plano_limites_config where id;
 select plano into v_plano from public.profiles where id=p_tutor;
 select count(*) into v_pets from public.pets where tutor_id=p_tutor and not coalesce(em_memoria,false);
 return jsonb_build_object('limites_ativos',coalesce(v_ativo,false),'plano',v_plano,
  'pets_limite',case when v_ativo and v_plano is distinct from 'premium' then v_limite else null end,
  'pets_ativos',v_pets,
  'pode_cadastrar_pet',not coalesce(v_ativo,false) or v_plano is not distinct from 'premium' or v_pets<v_limite,
  'pets_somente_leitura',coalesce((select jsonb_agg(p.id order by p.criado_em,p.id) from public.pets p where p.tutor_id=p_tutor and not public.plano_pet_editavel(p.id)),'[]'::jsonb));
end $$;
revoke all on function public.limites_meu_plano(uuid) from public,anon;
grant execute on function public.limites_meu_plano(uuid) to authenticated;
commit;

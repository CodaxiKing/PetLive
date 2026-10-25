-- Resumo privado; tabelas não implantadas retornam null, nunca zero inventado.
begin;
create or replace function public.privacidade_compartilhamentos(p_tutor uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_cuidadores bigint;v_fichas bigint;v_qrs bigint;v_familia bigint;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.'; end if;
  if to_regclass('public.cuidador_acessos') is not null then
    execute 'select count(*) from public.cuidador_acessos where tutor_id=$1 and revogado_em is null and inicio<=now() and fim>now()' into v_cuidadores using p_tutor;
  end if;
  if to_regclass('public.carteirinha_links') is not null then
    execute 'select count(*) from public.carteirinha_links where tutor_id=$1 and cancelado_em is null and expira_em>now()' into v_fichas using p_tutor;
  end if;
  if to_regclass('public.pet_qr_settings') is not null then
    select count(*) into v_qrs from public.pet_qr_settings q join public.pets p on p.id=q.pet_id
      where p.tutor_id=p_tutor and q.active and p.ativo and coalesce((to_jsonb(p)->>'em_memoria')::boolean,false)=false;
  end if;
  if to_regclass('public.pet_members') is not null then
    execute 'select count(*) from public.pet_members m join public.pets p on p.id=m.pet_id join public.profiles u on u.id=p.tutor_id where p.tutor_id=$1 and u.plano=''premium''' into v_familia using p_tutor;
  end if;
  return jsonb_build_object('cuidadores',v_cuidadores,'fichas',v_fichas,'qrs',v_qrs,'familia',v_familia,'consultado_em',now());
end; $$;
revoke all on function public.privacidade_compartilhamentos(uuid) from public,anon;
grant execute on function public.privacidade_compartilhamentos(uuid) to authenticated;
commit;

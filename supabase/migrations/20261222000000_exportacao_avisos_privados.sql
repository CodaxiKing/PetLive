-- Complementa o exportador existente sem expor tokens de entrega ou recibos.
begin;
do $$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_push_privado()') is null then
  alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_push_privado;
 end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_push_privado() from public,anon,authenticated;

create or replace function public.exportar_meus_dados() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_tutor uuid:=auth.uid();v_base jsonb;
begin
 if v_tutor is null then raise exception 'Entre na sua conta.'; end if;
 v_base:=public.exportar_meus_dados_sem_push_privado();
 return (v_base-'tokens_de_push') || jsonb_build_object(
  'dispositivos_avisos',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'plataforma',t.plataforma,'ativo',t.ativo,'criado_em',t.criado_em
  ) order by t.criado_em,t.id) from public.push_tokens t where t.tutor_id=v_tutor),'[]'::jsonb),
  'processamento_avisos_fichas',coalesce((select jsonb_agg(jsonb_build_object(
   'id',q.id,'aviso_id',q.aviso_id,'link_id',q.link_id,'estado',q.estado,
   'criado_em',q.criado_em,'atualizado_em',q.atualizado_em,
   'envios',q.envios,'consultas',q.consultas,'motivo',q.motivo
  ) order by q.criado_em,q.id) from public.ficha_push_fila q where q.tutor_id=v_tutor),'[]'::jsonb)
 );
end $$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;

create or replace function public.privacidade_exportar_dados(p_tutor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then
  raise exception 'A conta mudou. Entre novamente.';
 end if;
 return public.exportar_meus_dados();
end $$;
revoke all on function public.privacidade_exportar_dados(uuid) from public,anon;
grant execute on function public.privacidade_exportar_dados(uuid) to authenticated;
commit;

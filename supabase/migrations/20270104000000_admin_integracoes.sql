begin;

-- Inventário de componentes, sem consultar Vault, credenciais ou dados de tutores.
create or replace function public.admin_integracoes()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  perform public.admin_exigir(array['leitura']::text[]);
  return jsonb_build_object(
    'consultado_em', statement_timestamp(),
    'componentes', jsonb_build_object(
      'assinaturas', to_regclass('public.subscriptions') is not null,
      'planos', to_regclass('public.premium_planos_rascunho') is not null,
      'cupons', to_regclass('public.premium_cupons_rascunho') is not null,
      'push_fila', to_regclass('public.ficha_push_fila') is not null,
      'push_processador', to_regprocedure('public.ficha_push_processar()') is not null,
      'mapa', to_regprocedure('public.lugares_por_perto(double precision,double precision,text,text,double precision,boolean,integer,text)') is not null
    )
  );
end;
$$;
revoke all on function public.admin_integracoes() from public,anon;
grant execute on function public.admin_integracoes() to authenticated;
notify pgrst,'reload schema';
commit;

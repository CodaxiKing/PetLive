begin;
create or replace function public.admin_assinaturas(
  p_busca text default null, p_status text default null, p_ciclo text default null,
  p_provedor text default null, p_pagina integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  perform public.admin_exigir(array['financeiro','leitura']);
  if p_status is not null and p_status not in ('em_teste','ativa','pagamento_falhou','cancelando','cancelada','expirada') then
    raise exception 'Status inválido.';
  end if;
  if p_ciclo is not null and p_ciclo not in ('mensal','anual') then raise exception 'Ciclo inválido.'; end if;
  if p_provedor is not null and p_provedor not in ('asaas','google_play','app_store') then raise exception 'Provedor inválido.'; end if;
  if p_pagina is null or p_pagina<0 or p_pagina>100000 then raise exception 'Página inválida.'; end if;
  if char_length(coalesce(p_busca,''))>120 then raise exception 'Busca muito longa.'; end if;
  with base as (
    select s.id,s.tutor_id,p.nome,p.email,p.plano,s.ciclo,s.provedor,
      s.status as status_registrado,
      case when s.periodo_fim<=now() and s.status in ('em_teste','ativa','pagamento_falhou','cancelando') then 'expirada' else s.status end as status,
      s.periodo_inicio,s.periodo_fim,s.forma_pagamento,s.valor_centavos,s.criado_em
    from public.subscriptions s join public.profiles p on p.id=s.tutor_id
  ), filtrados as (
    select * from base where
      (p_status is null or status=p_status) and (p_ciclo is null or ciclo=p_ciclo)
      and (p_provedor is null or provedor=p_provedor)
      and (nullif(btrim(p_busca),'') is null
        or position(lower(btrim(p_busca)) in lower(coalesce(nome,'')))>0
        or position(lower(btrim(p_busca)) in lower(coalesce(email,'')))>0)
  ), pagina as (
    select * from filtrados order by criado_em desc,id desc limit 25 offset (p_pagina*25)
  ) select jsonb_build_object(
    'total',(select count(*) from filtrados),'pagina',p_pagina,'por_pagina',25,
    'resumo',jsonb_build_object(
      'ativas',(select count(*) from base where status='ativa'),
      'em_teste',(select count(*) from base where status='em_teste'),
      'pagamento_falhou',(select count(*) from base where status='pagamento_falhou'),
      'cancelando',(select count(*) from base where status='cancelando'),
      'canceladas',(select count(*) from base where status='cancelada'),
      'expiradas',(select count(*) from base where status='expirada')),
    'itens',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id desc) from pagina x),'[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function public.admin_assinaturas(text,text,text,text,integer) from public,anon;
grant execute on function public.admin_assinaturas(text,text,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;

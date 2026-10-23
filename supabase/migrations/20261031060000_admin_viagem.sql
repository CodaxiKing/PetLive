create or replace function public.admin_viagem()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(to_jsonb(i) order by i.ordem) from viagem_itens i), '[]'::jsonb),
    'companhias', coalesce((select jsonb_agg(to_jsonb(c) order by c.nome) from companhias_aereas c), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_viagem_item_salvar(p_id uuid, p_modo text, p_titulo text, p_detalhe text, p_ordem int, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if p_id is null then
    insert into viagem_itens (modo, titulo, detalhe, ordem, ativo, revisado_em)
    values (p_modo, trim(p_titulo), nullif(trim(coalesce(p_detalhe, '')), ''), coalesce(p_ordem, 100), coalesce(p_ativo, true), current_date);
  else
    update viagem_itens set modo = p_modo, titulo = trim(p_titulo), detalhe = nullif(trim(coalesce(p_detalhe, '')), ''),
      ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo), revisado_em = current_date
    where id = p_id;
  end if;
  perform public.admin_registrar('editou o checklist de viagem', 'conteudo', trim(p_titulo), '{}'::jsonb);
end;
$$;

create or replace function public.admin_companhia_salvar(p_id uuid, p_nome text, p_regras text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if coalesce(p_link, '') !~ '^https://' then raise exception 'Use o link oficial (https://).'; end if;
  if p_id is null then
    insert into companhias_aereas (nome, regras, link, revisado_em)
    values (trim(p_nome), nullif(trim(coalesce(p_regras, '')), ''), trim(p_link), current_date);
  else
    update companhias_aereas set nome = trim(p_nome), regras = nullif(trim(coalesce(p_regras, '')), ''), link = trim(p_link), revisado_em = current_date
    where id = p_id;
  end if;
  perform public.admin_registrar('revisou as regras da companhia', 'conteudo', trim(p_nome), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_viagem() from public, anon;
revoke all on function public.admin_viagem_item_salvar(uuid, text, text, text, int, boolean) from public, anon;
revoke all on function public.admin_companhia_salvar(uuid, text, text, text) from public, anon;
grant execute on function public.admin_viagem() to authenticated;
grant execute on function public.admin_viagem_item_salvar(uuid, text, text, text, int, boolean) to authenticated;
grant execute on function public.admin_companhia_salvar(uuid, text, text, text) to authenticated;

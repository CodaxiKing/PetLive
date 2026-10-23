create or replace function public.admin_fogos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'data', data, 'regiao', regiao, 'dica', dica, 'revisado_em', revisado_em) order by data)
    from datas_fogos where data >= current_date - 30
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_fogos_salvar(p_id uuid, p_nome text, p_data date, p_regiao text, p_dica text, p_revisado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if char_length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Dê um nome para a data.'; end if;
  if p_data is null then raise exception 'Informe a data.'; end if;
  if p_id is null then
    insert into datas_fogos (nome, data, regiao, dica, revisado_em)
    values (trim(p_nome), p_data, coalesce(nullif(trim(p_regiao), ''), 'Rio de Janeiro'), nullif(trim(coalesce(p_dica, '')), ''),
      case when p_revisado then current_date end);
  else
    update datas_fogos set nome = trim(p_nome), data = p_data, regiao = coalesce(nullif(trim(p_regiao), ''), 'Rio de Janeiro'),
      dica = nullif(trim(coalesce(p_dica, '')), ''), revisado_em = case when p_revisado then current_date else revisado_em end
    where id = p_id;
  end if;
  perform public.admin_registrar(case when p_id is null then 'cadastrou a data com fogos' else 'editou a data com fogos' end,
    'conteudo', trim(p_nome) || ' ' || to_char(p_data, 'DD/MM/YYYY'), '{}'::jsonb);
end;
$$;

create or replace function public.admin_fogos_remover(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  perform public.admin_exigir(array['marketing']);
  delete from datas_fogos where id = p_id returning nome || ' ' || to_char(data, 'DD/MM/YYYY') into v_nome;
  if v_nome is null then raise exception 'Data não encontrada.'; end if;
  perform public.admin_registrar('removeu a data com fogos', 'conteudo', v_nome, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_fogos() from public, anon;
revoke all on function public.admin_fogos_salvar(uuid, text, date, text, text, boolean) from public, anon;
revoke all on function public.admin_fogos_remover(uuid) from public, anon;
grant execute on function public.admin_fogos() to authenticated;
grant execute on function public.admin_fogos_salvar(uuid, text, date, text, text, boolean) to authenticated;
grant execute on function public.admin_fogos_remover(uuid) to authenticated;

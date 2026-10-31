-- Status da operação e modo manutenção. A equipe liga a manutenção
-- planejada pelo painel (admin_manutencao); o app mostra a tela de manutenção
-- e a página de status (apps/status) mostra o aviso. Quando a API cai de
-- verdade, nada disso responde: o app e a página percebem pela falha da
-- própria consulta (status_publico ou a função status).

alter table public.app_config drop constraint if exists app_config_chave_check;
alter table public.app_config add constraint app_config_chave_check check (chave in ('versao_minima', 'manutencao'));
insert into public.app_config (chave, valor) values ('manutencao', '{"ativa": false, "mensagem": null, "previsao": null}')
on conflict (chave) do nothing;

-- O que o app lê ao abrir, agora com a manutenção planejada.
create or replace function public.config_app()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'versao_minima', (select valor from app_config where chave = 'versao_minima'),
    'recursos', coalesce((select jsonb_object_agg(chave, ligado) from recursos), '{}'::jsonb),
    'manutencao', coalesce((select valor from app_config where chave = 'manutencao'), '{"ativa": false}'::jsonb)
  )
$$;
grant execute on function public.config_app() to anon, authenticated;

-- Consulta leve de saúde, sem login: responder já prova que API e banco estão no ar.
create or replace function public.status_publico()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'banco', 'ok',
    'hora', now(),
    'manutencao', coalesce((select valor from app_config where chave = 'manutencao'), '{"ativa": false}'::jsonb)
  )
$$;
grant execute on function public.status_publico() to anon, authenticated, service_role;

-- Painel admin: liga ou desliga a manutenção planejada, com mensagem e previsão de volta.
create or replace function public.admin_manutencao(p_ativa boolean, p_mensagem text default null, p_previsao timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public.admin_exigir(array['super']);
  if p_mensagem is not null and char_length(btrim(p_mensagem)) > 280 then
    raise exception 'Mensagem de até 280 caracteres.' using errcode = '22023';
  end if;
  v := jsonb_build_object('ativa', coalesce(p_ativa, false),
    'mensagem', nullif(btrim(coalesce(p_mensagem, '')), ''),
    'previsao', p_previsao);
  update app_config set valor = v, atualizado_em = now(), atualizado_por = auth.uid() where chave = 'manutencao';
  insert into audit_log (admin_id, acao, alvo_tipo, alvo_id, detalhes)
  values (auth.uid(), case when v->>'ativa' = 'true' then 'manutencao_ligada' else 'manutencao_desligada' end, 'app_config', 'manutencao', v);
  return v;
end;
$$;
revoke all on function public.admin_manutencao(boolean, text, timestamptz) from public, anon;
grant execute on function public.admin_manutencao(boolean, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- Compatível com pedidos legados (excluir/pendente) e app (apagar/novo).
-- Não agenda nem executa exclusões. Ativação depende de worker homologado.
begin;
alter table public.lgpd_requests enable row level security;
revoke all on public.lgpd_requests from anon, authenticated;

create or replace function public.privacidade_estado(p_tutor uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_pedido public.lgpd_requests;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then
    raise exception 'A conta mudou. Entre novamente.';
  end if;
  select * into v_pedido from public.lgpd_requests
    where user_id=p_tutor and tipo in ('excluir','apagar')
      and status in ('pendente','novo','aguardando_confirmacao','em_andamento')
    order by criado_em desc, id desc limit 1;
  return jsonb_build_object('pedido_id',v_pedido.id,'executar_em',v_pedido.executar_em,
    'status',v_pedido.status,'pode_solicitar',false,
    'pode_cancelar',v_pedido.id is not null and v_pedido.status in ('pendente','novo','aguardando_confirmacao'));
end; $$;

create or replace function public.privacidade_cancelar_exclusao(p_tutor uuid, p_pedido uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_pedido public.lgpd_requests;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then
    raise exception 'A conta mudou. Entre novamente.';
  end if;
  select * into v_pedido from public.lgpd_requests
    where id=p_pedido and user_id=p_tutor and tipo in ('excluir','apagar') for update;
  if not found then raise exception 'Pedido indisponível nesta conta.'; end if;
  if v_pedido.status='cancelado' then return; end if;
  if v_pedido.status not in ('pendente','novo','aguardando_confirmacao') then
    raise exception 'Este pedido não pode mais ser cancelado.';
  end if;
  update public.lgpd_requests set status='cancelado',done_at=now() where id=p_pedido;
end; $$;

create or replace function public.privacidade_registrar_exportacao(p_tutor uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then
    raise exception 'A conta mudou. Entre novamente.';
  end if;
  -- Sem copiar e-mail/PII adicional para o log operacional.
  insert into public.lgpd_requests(user_id,tipo,status,done_at)
    values(p_tutor,'exportar','concluido',now());
end; $$;

revoke all on function public.privacidade_estado(uuid) from public,anon;
revoke all on function public.privacidade_cancelar_exclusao(uuid,uuid) from public,anon;
revoke all on function public.privacidade_registrar_exportacao(uuid) from public,anon;
grant execute on function public.privacidade_estado(uuid) to authenticated;
grant execute on function public.privacidade_cancelar_exclusao(uuid,uuid) to authenticated;
grant execute on function public.privacidade_registrar_exportacao(uuid) to authenticated;
commit;

-- Serializa denúncias do mesmo evento para que três envios concorrentes
-- não leiam contagens parciais e deixem o evento publicado.
create or replace function public.evento_denunciar(p_event_id uuid, p_motivo text, p_detalhe text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_event public.events; v_total integer;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para denunciar.'; end if;
  if p_motivo is null or p_motivo not in ('spam','inadequado','fraude','local_privado','informacao_falsa','outro')
    or coalesce(char_length(p_detalhe), 0) > 500 then
    raise exception 'Informe um motivo de denúncia válido.';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Evento não encontrado ou já encerrado.'; end if;
  -- Repetir uma denúncia já recebida é seguro, inclusive se a terceira
  -- denúncia ocultou o evento antes de a resposta chegar ao aparelho.
  if exists(select 1 from public.event_reports where event_id = p_event_id and user_id = auth.uid()) then return; end if;
  if v_event.status <> 'publicado' or v_event.fim_em <= now() then
    raise exception 'Evento não encontrado ou já encerrado.';
  end if;
  insert into public.event_reports(event_id, user_id, motivo, detalhe)
    values (p_event_id, auth.uid(), p_motivo, nullif(trim(p_detalhe), ''));
  select count(*) into v_total from public.event_reports where event_id = p_event_id;
  if v_total >= 3 then
    update public.events set status = 'oculto',
      motivo_status = 'Evento oculto automaticamente para revisão após denúncias.', atualizado_em = now()
      where id = p_event_id;
    if v_event.criado_por is not null then
      insert into public.notification_log(user_id, type, title, body, deep_link)
        values (v_event.criado_por, 'sistema', 'Evento em revisão',
          v_event.titulo || ' foi retirado do mapa para revisão da moderação.', '/eventos/meus');
    end if;
  end if;
end;
$$;
revoke all on function public.evento_denunciar(uuid,text,text) from public, anon;
grant execute on function public.evento_denunciar(uuid,text,text) to authenticated;

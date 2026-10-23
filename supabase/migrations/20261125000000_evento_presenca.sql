-- Ficha acessada pelo app e pelos links dos lembretes.
create or replace function public.evento_detalhe(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo, 'descricao', e.descricao,
    'inicio_em', e.inicio_em, 'fim_em', e.fim_em, 'local_nome', e.local_nome,
    'place_id', e.place_id, 'lat', e.lat, 'lng', e.lng, 'foto_url', e.foto_url,
    'gratuito', e.gratuito, 'preco_centavos', e.preco_centavos,
    'ingresso_url', e.ingresso_url, 'vagas', e.vagas,
    'eu_vou', exists(select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()),
    'confirmados', (select count(*) from public.event_rsvps r where r.event_id = e.id),
    'organizador', case when e.oficial then 'PetLive'
      else coalesce(o.nome_publico, 'Organizador da comunidade') end,
    'organizador_verificado', coalesce(o.verificado, false) or e.oficial
  )
  from public.events e left join public.organizers o on o.user_id = e.organizador_id
  where e.id = p_event_id and e.status = 'publicado' and e.fim_em > now()
$$;
revoke all on function public.evento_detalhe(uuid) from public, anon;
grant execute on function public.evento_detalhe(uuid) to authenticated;

-- Estado desejado explícito: repetir uma requisição após falha de rede
-- nunca desfaz uma confirmação já processada.
create or replace function public.evento_definir_presenca(p_event_id uuid, p_confirmar boolean)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_event public.events; v_existe boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para confirmar presença.'; end if;
  if p_confirmar is null then raise exception 'Informe se deseja confirmar ou cancelar a presença.'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'publicado' or v_event.fim_em <= now() then
    raise exception 'Este evento não está aceitando confirmações.';
  end if;
  select exists(select 1 from public.event_rsvps where event_id = p_event_id and user_id = auth.uid()) into v_existe;
  if p_confirmar and not v_existe then
    if v_event.vagas is not null and (select count(*) from public.event_rsvps where event_id = p_event_id) >= v_event.vagas then
      raise exception 'As vagas deste evento estão esgotadas.';
    end if;
    insert into public.event_rsvps(event_id, user_id) values (p_event_id, auth.uid());
    insert into public.notification_log(user_id, type, title, body, deep_link)
      values (auth.uid(), 'sistema', 'Presença confirmada', 'Você vai a ' || v_event.titulo || '.', '/eventos/' || v_event.id);
  elsif not p_confirmar then
    -- Não gera marcas fictícias de envio: ao voltar, só recebe os lembretes
    -- pendentes. Envios anteriores continuam registrados para não duplicar.
    delete from public.event_rsvps where event_id = p_event_id and user_id = auth.uid();
  end if;
  return public.evento_detalhe(p_event_id);
end;
$$;
revoke all on function public.evento_definir_presenca(uuid,boolean) from public, anon;
grant execute on function public.evento_definir_presenca(uuid,boolean) to authenticated;

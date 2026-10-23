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

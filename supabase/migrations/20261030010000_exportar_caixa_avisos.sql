-- PetLive: a exportação LGPD leva também a caixa de avisos (notification_log).

create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  return public.exportar_meus_dados_base() || jsonb_build_object(
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.registrado_em), '[]'::jsonb)
      from public.consentimentos c where c.tutor_id = v_tutor
    ),
    'pedidos_de_privacidade', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.criado_em), '[]'::jsonb)
      from public.lgpd_requests r where r.user_id = v_tutor
    ),
    'lugares_salvos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', pl.nome, 'endereco', pl.endereco, 'salvo_em', s.saved_at, 'google_place_id', s.google_place_id
      ) order by s.saved_at), '[]'::jsonb)
      from public.saved_places s
      left join public.places pl on pl.id = s.place_id
      where s.user_id = v_tutor
    ),
    'registros_de_uso', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'detalhes', e.props, 'quando', e.ocorreu_em
      ) order by e.ocorreu_em), '[]'::jsonb)
      from public.eventos_uso e where e.user_id = v_tutor
    ),
    'caixa_de_avisos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', n.type, 'titulo', n.title, 'texto', n.body, 'enviado_em', n.sent_at, 'lido_em', n.read_at
      ) order by n.sent_at), '[]'::jsonb)
      from public.notification_log n where n.user_id = v_tutor
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;

create or replace function public.aprovar_sugestao_lugar(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sugestoes_lugar;
  v_place uuid;
begin
  select * into s from public.sugestoes_lugar where id = p_id for update;
  if not found then raise exception 'Indicação não encontrada.'; end if;
  if s.status <> 'em_analise' then raise exception 'Indicação já revisada (%).', s.status; end if;

  insert into public.places (fonte, fonte_id, nome, categoria, endereco, lat, lng, aceita_caes, aceita_gatos)
  values ('tutor', s.id::text, s.nome, s.categoria, s.endereco, s.lat, s.lng,
    s.aceita in ('caes', 'caes_e_gatos'), s.aceita in ('gatos', 'caes_e_gatos'))
  returning id into v_place;

  update public.sugestoes_lugar set status = 'aprovada', place_id = v_place, revisado_em = now() where id = p_id;
  return v_place;
end;
$$;

create or replace function public.recusar_sugestao_lugar(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sugestoes_lugar
     set status = 'recusada', motivo_recusa = left(p_motivo, 200), revisado_em = now()
   where id = p_id and status = 'em_analise';
  if not found then raise exception 'Indicação não encontrada ou já revisada.'; end if;
end;
$$;

revoke all on function public.aprovar_sugestao_lugar(uuid) from public, anon, authenticated;
revoke all on function public.recusar_sugestao_lugar(uuid, text) from public, anon, authenticated;
grant execute on function public.aprovar_sugestao_lugar(uuid) to service_role;
grant execute on function public.recusar_sugestao_lugar(uuid, text) to service_role;

-- Alterações de localização precisam de nova análise mesmo sem mudar o nome.
create or replace function public.evento_reanalisar_local()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.place_id is distinct from new.place_id
    or old.lat is distinct from new.lat or old.lng is distinct from new.lng then
    if old.status in ('publicado', 'em_analise', 'ajuste_solicitado') then
      new.status := 'em_analise';
      new.motivo_status := null;
      delete from public.event_reminder_deliveries where event_id = old.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.evento_reanalisar_local() from public, anon, authenticated;
drop trigger if exists events_reanalisar_local on public.events;
create trigger events_reanalisar_local
  before update of place_id, lat, lng on public.events
  for each row execute function public.evento_reanalisar_local();

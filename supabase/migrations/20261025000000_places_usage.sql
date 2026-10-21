-- PetLive: controle de custo do Google Places (BUSINESS.md 5.15 e 21.2).
-- Tarefa: [BACKEND] "Mapa: Controle de custo: campos mínimos, limite diário
-- por usuário e tabela places_usage".
--
-- As Edge Functions places-nearby, place-details, place-photo e
-- nearest-emergency chamam consumir_cota_lugares antes de ir ao Google:
-- a função conta a chamada do dia e diz se ainda está dentro do limite.

create table public.places_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  nearby_calls int not null default 0,
  detail_calls int not null default 0,
  photo_calls int not null default 0,
  primary key (user_id, day)
);

comment on table public.places_usage is 'Chamadas ao Google Places por usuário e dia (limite diário e custo).';

alter table public.places_usage enable row level security;

create policy "places_usage: dono le" on public.places_usage
  for select using (auth.uid() = user_id);

/**
 * Conta uma chamada do tipo ('nearby', 'detail' ou 'photo') para o usuário
 * logado e devolve true se ela ainda cabe no limite do dia.
 * Limites (por dia): busca 80, detalhe 40, foto 120. A chamada recusada
 * não é contada.
 */
create or replace function public.consumir_cota_lugares(p_tipo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limite int;
  v_usado int;
begin
  if v_user is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  v_limite := case p_tipo when 'nearby' then 80 when 'detail' then 40 when 'photo' then 120 end;
  if v_limite is null then
    raise exception 'tipo de chamada invalido: %', p_tipo;
  end if;

  insert into public.places_usage (user_id, day) values (v_user, current_date)
  on conflict (user_id, day) do nothing;

  select case p_tipo when 'nearby' then nearby_calls when 'detail' then detail_calls else photo_calls end
    into v_usado
    from public.places_usage
    where user_id = v_user and day = current_date
    for update;

  if v_usado >= v_limite then
    return false;
  end if;

  update public.places_usage
    set nearby_calls = nearby_calls + (p_tipo = 'nearby')::int,
        detail_calls = detail_calls + (p_tipo = 'detail')::int,
        photo_calls = photo_calls + (p_tipo = 'photo')::int
    where user_id = v_user and day = current_date;
  return true;
end;
$$;

revoke all on function public.consumir_cota_lugares(text) from public, anon;
grant execute on function public.consumir_cota_lugares(text) to authenticated;

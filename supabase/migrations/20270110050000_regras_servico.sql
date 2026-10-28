-- Regras por serviço (BUSINESS.md 6 e 19.6): creche por dia, hotelzinho por
-- diárias e passeador por passeio. Cada modelo valida as vagas no banco, com a
-- linha do serviço travada na reserva, como a reserva por horário.

alter table public.services add column if not exists requires_vaccines boolean not null default false;
alter table public.services add column if not exists entrada_ate time;
alter table public.services add column if not exists retirada_desde time;

-- Hotelzinho: preço por porte e extras.
create table if not exists public.lodging_rates (
  service_id uuid not null references public.services (id) on delete cascade,
  size text not null check (size in ('pequeno', 'medio', 'grande')),
  night_cents int not null check (night_cents > 0),
  primary key (service_id, size)
);
create table if not exists public.service_extras (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  price_cents int not null check (price_cents >= 0),
  por_dia boolean not null default false,
  active boolean not null default true
);
-- Creche: dia inteiro ou meio período, avulso ou pacote.
create table if not exists public.daycare_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  period text not null check (period in ('dia', 'meio')),
  price_cents int not null check (price_cents > 0),
  package_days int check (package_days between 2 and 31),
  package_cents int check (package_cents > 0),
  check ((package_days is null) = (package_cents is null))
);
-- Passeador.
create table if not exists public.walk_rules (
  service_id uuid primary key references public.services (id) on delete cascade,
  price_30_cents int not null check (price_30_cents > 0),
  price_60_cents int not null check (price_60_cents > 0),
  radius_km numeric(4,1) not null default 3 check (radius_km > 0 and radius_km <= 30),
  max_pets int not null default 3 check (max_pets between 1 and 8),
  weekdays int[] not null default array[1,2,3,4,5],
  window_start time not null default '07:00',
  window_end time not null default '19:00' check (window_end > window_start)
);
alter table public.lodging_rates enable row level security;
alter table public.service_extras enable row level security;
alter table public.daycare_plans enable row level security;
alter table public.walk_rules enable row level security;
revoke all on public.lodging_rates, public.service_extras, public.daycare_plans, public.walk_rules from public, anon, authenticated;

-- Dias de creche e noites de hotel ocupadas por reserva (para contar vagas por dia).
create table if not exists public.request_days (
  request_id uuid not null references public.requests (id) on delete cascade,
  dia date not null,
  periodo text not null default 'dia' check (periodo in ('dia', 'meio', 'noite')),
  primary key (request_id, dia)
);
create index if not exists request_days_dia on public.request_days (dia);
alter table public.request_days enable row level security;
revoke all on public.request_days from public, anon, authenticated;

alter table public.requests add column if not exists extras jsonb;

-- Vagas ocupadas do serviço num dia (reservas que ainda bloqueiam).
create or replace function public.servico_ocupacao_dia(p_service uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(r.vagas), 0)::int from request_days d join requests r on r.id = d.request_id
  where r.service_id = p_service and d.dia = p_dia and r.status in ('enviada', 'confirmada', 'em_andamento');
$$;

create or replace function public.porte_do_pet(p_peso numeric)
returns text language sql immutable as $$
  select case when p_peso is null or p_peso < 10 then 'pequeno' when p_peso <= 25 then 'medio' else 'grande' end;
$$;

-- Tudo que o app precisa para reservar o serviço, com as vagas dos próximos dias.
create or replace function public.servico_detalhe(p_service uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sv services; s stores; v_hoje date := (now() at time zone public.loja_fuso())::date;
begin
  select * into sv from services where id = p_service and active;
  select * into s from stores where id = sv.store_id;
  if sv.id is null or (s.status <> 'aprovada' and not public.loja_membro(s.id)) then return jsonb_build_object('disponivel', false); end if;
  return jsonb_build_object('disponivel', true,
    'servico', jsonb_build_object('id', sv.id, 'name', sv.name, 'description', sv.description, 'modelo', sv.modelo, 'capacity', sv.capacity,
      'duration_min', sv.duration_min, 'price_cents', sv.price_cents, 'requires_vaccines', sv.requires_vaccines,
      'entrada_ate', to_char(sv.entrada_ate, 'HH24:MI'), 'retirada_desde', to_char(sv.retirada_desde, 'HH24:MI')),
    'loja', jsonb_build_object('id', s.id, 'name', s.name, 'cancel_until_min', s.cancel_until_min),
    'tarifas', coalesce((select jsonb_object_agg(size, night_cents) from lodging_rates where service_id = sv.id), '{}'::jsonb),
    'extras', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'price_cents', price_cents, 'por_dia', por_dia) order by nome)
                        from service_extras where service_id = sv.id and active), '[]'::jsonb),
    'planos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'period', period, 'price_cents', price_cents, 'package_days', package_days, 'package_cents', package_cents)
                                         order by period, package_days nulls first) from daycare_plans where service_id = sv.id), '[]'::jsonb),
    'passeio', (select to_jsonb(w) - 'service_id' from walk_rules w where w.service_id = sv.id),
    -- Vagas por dia nos próximos 60 dias (creche e hotel); dia sem atendimento vem com 0.
    'vagas', case when sv.modelo in ('dia', 'diarias') then (
      select jsonb_object_agg(d::date::text,
        case when sv.modelo = 'dia' and not exists (select 1 from store_hours h where h.store_id = s.id and h.weekday = extract(dow from d)::int) then 0
             when exists (select 1 from time_off t where t.store_id = s.id and t.starts_at < (d::date + 1)::timestamp at time zone public.loja_fuso() and t.ends_at > d::date::timestamp at time zone public.loja_fuso()) then 0
             else greatest(sv.capacity - public.servico_ocupacao_dia(sv.id, d::date), 0) end)
      from generate_series(v_hoje + 1, v_hoje + 60, interval '1 day') d) end);
end;
$$;

create or replace function public.servico_pedido_inserir(sv services, s stores, p_pet uuid, p_ini timestamptz, p_fim timestamptz, p_total int, p_message text, p_extras jsonb, p_endereco text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into requests (user_id, store_id, kind, status, service_id, vagas, starts_at, ends_at, ocupado_ate, pet_id, subtotal_cents, total_cents,
                        pay_method, message, extras, endereco_texto, expira_em)
  values (auth.uid(), s.id, 'servico', 'enviada', sv.id, 1, p_ini, p_fim, p_fim, p_pet, p_total, p_total, 'na_loja',
          nullif(left(btrim(coalesce(p_message, '')), 500), ''), p_extras, p_endereco,
          least(now() + make_interval(mins => s.response_deadline_min), p_ini))
  returning id into v_id;
  insert into request_items (request_id, service_id, nome, qty, unit_cents) values (v_id, sv.id, sv.name, 1, p_total);
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Nova reserva', sv.name || ' a partir de ' || to_char(p_ini at time zone public.loja_fuso(), 'DD/MM') || '.', '/loja-painel/pedido/' || v_id
  from store_members m where m.store_id = s.id and m.active;
  if s.auto_confirm then
    perform set_config('petlive.auto_confirmar', v_id::text, true);
    perform public.solicitacao_mudar(v_id, 'confirmada', null, null);
    perform set_config('petlive.auto_confirmar', '', true);
  end if;
  return v_id;
end;
$$;

create or replace function public.servico_validar(p_service uuid, p_modelo text, p_pet uuid)
returns services language plpgsql security definer set search_path = public as $$
declare sv services; s stores;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into sv from services where id = p_service and active for update;
  if sv.id is null or sv.modelo <> p_modelo then raise exception 'Serviço não disponível.' using errcode = '22023'; end if;
  select * into s from stores where id = sv.store_id;
  if s.status <> 'aprovada' or s.oferece = 'produtos' then raise exception 'Esta loja não está disponível.' using errcode = '22023'; end if;
  if p_pet is null or not public.is_pet_owner(p_pet) then raise exception 'Escolha o pet.' using errcode = '22023'; end if;
  if (select count(*) from requests where user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas solicitações seguidas. Aguarde um pouco.' using errcode = '23514';
  end if;
  return sv;
end;
$$;

-- Vacinas em dia: tem vacina registrada e nenhuma com a próxima dose vencida.
create or replace function public.pet_vacinas_em_dia(p_pet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vaccinations where pet_id = p_pet)
     and not exists (select 1 from vaccinations v where v.pet_id = p_pet and v.proxima_dose < current_date
                     and not exists (select 1 from vaccinations v2 where v2.pet_id = p_pet and v2.nome = v.nome and v2.aplicada_em > v.aplicada_em));
$$;

-- ---------- Creche ----------
create or replace function public.creche_reservar(p_service uuid, p_dias date[], p_periodo text, p_pacote boolean, p_pet uuid, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sv services; s stores; d date; v_n int; v_plano daycare_plans; v_pacote daycare_plans; v_total int; v_id uuid;
  v_hoje date := (now() at time zone public.loja_fuso())::date;
begin
  sv := public.servico_validar(p_service, 'dia', p_pet);
  select * into s from stores where id = sv.store_id;
  if p_periodo not in ('dia', 'meio') then raise exception 'Escolha dia inteiro ou meio período.' using errcode = '22023'; end if;
  select array_agg(distinct x order by x) into p_dias from unnest(p_dias) x;
  v_n := coalesce(cardinality(p_dias), 0);
  if v_n = 0 or v_n > 31 then raise exception 'Escolha de 1 a 31 dias.' using errcode = '22023'; end if;
  select * into v_plano from daycare_plans where service_id = sv.id and period = p_periodo and package_days is null limit 1;
  if v_plano.id is null then raise exception 'A loja não oferece este período.' using errcode = '22023'; end if;
  foreach d in array p_dias loop
    if d <= v_hoje or d > v_hoje + 60 then raise exception 'Escolha dias a partir de amanhã.' using errcode = '22023'; end if;
    if not exists (select 1 from store_hours h where h.store_id = s.id and h.weekday = extract(dow from d)::int) then
      raise exception 'A creche não abre em %.', to_char(d, 'DD/MM') using errcode = '22023';
    end if;
    if exists (select 1 from time_off t where t.store_id = s.id and t.starts_at < (d + 1)::timestamp at time zone public.loja_fuso() and t.ends_at > d::timestamp at time zone public.loja_fuso()) then
      raise exception 'A creche está fechada em %.', to_char(d, 'DD/MM') using errcode = '22023';
    end if;
    if public.servico_ocupacao_dia(sv.id, d) >= sv.capacity then
      raise exception 'Sem vagas em %.', to_char(d, 'DD/MM') using errcode = '22023', hint = 'sem_vagas';
    end if;
  end loop;
  v_total := v_plano.price_cents * v_n;
  if p_pacote then
    select * into v_pacote from daycare_plans where service_id = sv.id and period = p_periodo and package_days = v_n limit 1;
    if v_pacote.id is null then raise exception 'Nenhum pacote de % diárias. Escolha avulso.', v_n using errcode = '22023'; end if;
    v_total := v_pacote.package_cents;
  end if;
  v_id := public.servico_pedido_inserir(sv, s, p_pet,
    (p_dias[1] + coalesce(sv.entrada_ate, '08:00'::time) - interval '1 hour') at time zone public.loja_fuso(),
    (p_dias[v_n] + coalesce(sv.retirada_desde, '17:00'::time) + interval '1 hour') at time zone public.loja_fuso(),
    v_total, p_message, jsonb_build_object('periodo', p_periodo, 'dias', to_jsonb(p_dias), 'pacote', p_pacote), null);
  insert into request_days (request_id, dia, periodo) select v_id, x, p_periodo from unnest(p_dias) x;
  return jsonb_build_object('id', v_id, 'total_cents', v_total, 'status', (select status from requests where id = v_id));
end;
$$;

-- ---------- Hotelzinho ----------
create or replace function public.hotel_reservar(p_service uuid, p_checkin date, p_checkout date, p_pet uuid, p_extras uuid[] default '{}', p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sv services; s stores; d date; v_porte text; v_noite int; v_noites int; v_total int; v_id uuid; v_extras jsonb; e record;
  v_hoje date := (now() at time zone public.loja_fuso())::date;
begin
  sv := public.servico_validar(p_service, 'diarias', p_pet);
  select * into s from stores where id = sv.store_id;
  if p_checkin is null or p_checkout is null or p_checkout <= p_checkin then raise exception 'Escolha a entrada e a saída.' using errcode = '22023'; end if;
  if p_checkin <= v_hoje or p_checkout > v_hoje + 90 then raise exception 'Escolha datas a partir de amanhã.' using errcode = '22023'; end if;
  v_noites := p_checkout - p_checkin;
  if v_noites > 30 then raise exception 'Até 30 noites por reserva.' using errcode = '22023'; end if;
  v_porte := public.porte_do_pet((select peso_atual from pets where id = p_pet));
  select night_cents into v_noite from lodging_rates where service_id = sv.id and size = v_porte;
  if v_noite is null then raise exception 'O hotel não recebe pets de porte %.', v_porte using errcode = '22023'; end if;
  if sv.requires_vaccines and not public.pet_vacinas_em_dia(p_pet) then
    raise exception 'O hotel pede as vacinas em dia. Atualize a carteirinha do pet.' using errcode = '22023', hint = 'vacinas';
  end if;
  for d in select generate_series(p_checkin, p_checkout - 1, interval '1 day')::date loop
    if public.servico_ocupacao_dia(sv.id, d) >= sv.capacity then
      raise exception 'Sem vagas na noite de %.', to_char(d, 'DD/MM') using errcode = '22023', hint = 'sem_vagas';
    end if;
  end loop;
  v_total := v_noite * v_noites;
  v_extras := '[]'::jsonb;
  for e in select * from service_extras where service_id = sv.id and active and id = any (coalesce(p_extras, '{}')) loop
    v_total := v_total + e.price_cents * case when e.por_dia then v_noites else 1 end;
    v_extras := v_extras || jsonb_build_object('nome', e.nome, 'price_cents', e.price_cents, 'por_dia', e.por_dia);
  end loop;
  v_id := public.servico_pedido_inserir(sv, s, p_pet,
    (p_checkin + coalesce(sv.entrada_ate, '12:00'::time)) at time zone public.loja_fuso(),
    (p_checkout + coalesce(sv.retirada_desde, '12:00'::time)) at time zone public.loja_fuso(),
    v_total, p_message, jsonb_build_object('porte', v_porte, 'noites', v_noites, 'noite_cents', v_noite, 'extras', v_extras), null);
  insert into request_days (request_id, dia, periodo) select v_id, x::date, 'noite' from generate_series(p_checkin, p_checkout - 1, interval '1 day') x;
  return jsonb_build_object('id', v_id, 'total_cents', v_total, 'status', (select status from requests where id = v_id));
end;
$$;

-- ---------- Passeador ----------
create or replace function public.passeio_horarios(p_service uuid, p_dia date, p_duracao int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sv services; w walk_rules; v_ini timestamptz; v_fim_janela timestamptz; v_lista jsonb := '[]'::jsonb; v_ocup int;
begin
  select * into sv from services where id = p_service and active and modelo = 'passeio';
  select * into w from walk_rules where service_id = p_service;
  if sv.id is null or w.service_id is null then raise exception 'Passeio não disponível.' using errcode = '22023'; end if;
  if p_duracao not in (30, 60) then raise exception 'Escolha 30 ou 60 minutos.' using errcode = '22023'; end if;
  if not extract(dow from p_dia)::int = any (w.weekdays) then return '[]'::jsonb; end if;
  v_ini := (p_dia + w.window_start) at time zone public.loja_fuso();
  v_fim_janela := (p_dia + w.window_end) at time zone public.loja_fuso();
  while v_ini + make_interval(mins => p_duracao) <= v_fim_janela loop
    if v_ini > now() + interval '1 hour'
       and not exists (select 1 from time_off t where t.store_id = sv.store_id and t.starts_at < v_ini + make_interval(mins => p_duracao) and t.ends_at > v_ini) then
      v_ocup := public.servico_pico(sv.id, v_ini, v_ini + make_interval(mins => p_duracao));
      if v_ocup < w.max_pets then v_lista := v_lista || jsonb_build_object('inicio', v_ini, 'vagas_livres', w.max_pets - v_ocup); end if;
    end if;
    v_ini := v_ini + interval '30 minutes';
  end loop;
  return v_lista;
end;
$$;

create or replace function public.passeio_reservar(p_service uuid, p_inicio timestamptz, p_duracao int, p_pet uuid, p_address_id uuid, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sv services; s stores; w walk_rules; a addresses; v_id uuid; v_total int;
begin
  sv := public.servico_validar(p_service, 'passeio', p_pet);
  select * into s from stores where id = sv.store_id;
  select * into w from walk_rules where service_id = sv.id;
  select * into a from addresses where id = p_address_id and user_id = auth.uid();
  if a.id is null then raise exception 'Escolha o endereço de busca.' using errcode = '22023'; end if;
  if a.lat is null or s.lat is null or public.perdido_distancia_km(a.lat, a.lng, s.lat, s.lng) > w.radius_km then
    raise exception 'Seu endereço fica fora da área do passeador.' using errcode = '22023', hint = 'fora_do_raio';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.passeio_horarios(sv.id, (p_inicio at time zone public.loja_fuso())::date, p_duracao)) x
                 where (x->>'inicio')::timestamptz = p_inicio) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode = '22023', hint = 'horario_ocupado';
  end if;
  v_total := case when p_duracao = 30 then w.price_30_cents else w.price_60_cents end;
  v_id := public.servico_pedido_inserir(sv, s, p_pet, p_inicio, p_inicio + make_interval(mins => p_duracao), v_total, p_message,
    jsonb_build_object('duracao', p_duracao), concat_ws(', ', a.street || coalesce(' ' || a.number, ''), a.complement, a.neighborhood, a.city));
  update requests set address_id = a.id where id = v_id;
  return jsonb_build_object('id', v_id, 'total_cents', v_total, 'status', (select status from requests where id = v_id));
end;
$$;

revoke all on function public.servico_ocupacao_dia(uuid, date), public.servico_pedido_inserir(services, stores, uuid, timestamptz, timestamptz, int, text, jsonb, text),
  public.servico_validar(uuid, text, uuid), public.pet_vacinas_em_dia(uuid) from public, anon, authenticated;
revoke all on function public.servico_detalhe(uuid), public.creche_reservar(uuid, date[], text, boolean, uuid, text),
  public.hotel_reservar(uuid, date, date, uuid, uuid[], text), public.passeio_horarios(uuid, date, int),
  public.passeio_reservar(uuid, timestamptz, int, uuid, uuid, text) from public, anon;
grant execute on function public.servico_detalhe(uuid), public.creche_reservar(uuid, date[], text, boolean, uuid, text),
  public.hotel_reservar(uuid, date, date, uuid, uuid[], text), public.passeio_horarios(uuid, date, int),
  public.passeio_reservar(uuid, timestamptz, int, uuid, uuid, text), public.porte_do_pet(numeric) to authenticated;

-- Reserva de serviço por horário (BUSINESS.md 6 e 19.5): banho e tosa,
-- consulta e vacinação. Horários livres calculados no banco: horários da loja,
-- menos folgas, menos reservas que ainda ocupam vaga, respeitando duração,
-- intervalo e vagas. Mesmas regras do motor supabase/functions/_shared/horarios.ts:
-- grade a partir de cada abertura, passo de duração + intervalo, intervalo
-- ocupa a vaga e precisa caber antes de fechar, pico simultâneo de ocupação.
-- A reserva reconfere a vaga com a linha do serviço travada (sem corrida).

alter table public.requests add column if not exists service_id uuid references public.services (id) on delete set null;
alter table public.requests add column if not exists vagas int not null default 1 check (vagas between 1 and 10);
alter table public.requests add column if not exists ocupado_ate timestamptz;
alter table public.requests add column if not exists lembrete_enviado boolean not null default false;
create index if not exists requests_servico_agenda on public.requests (service_id, starts_at) where kind = 'servico';

-- Fuso das lojas (Brasil, horário de Brasília). Campo próprio quando houver lojas em outros fusos.
create or replace function public.loja_fuso() returns text language sql immutable as $$ select 'America/Sao_Paulo' $$;

-- Ocupação máxima simultânea das reservas que cruzam [p_ini, p_fim), sem contar p_ignorar.
create or replace function public.servico_pico(p_service uuid, p_ini timestamptz, p_fim timestamptz, p_ignorar uuid default null)
returns int language sql stable security definer set search_path = public as $$
  with r as (
    select starts_at, ocupado_ate, vagas from requests
    where service_id = p_service and kind = 'servico' and id is distinct from p_ignorar
      and status in ('enviada', 'confirmada', 'em_andamento')
      and starts_at < p_fim and ocupado_ate > p_ini)
  select coalesce(max((select coalesce(sum(r2.vagas), 0) from r r2 where r2.starts_at <= ponto and r2.ocupado_ate > ponto)), 0)::int
  from (select p_ini as ponto union select starts_at from r where starts_at > p_ini) pontos;
$$;

create or replace function public.horarios_livres(p_service uuid, p_dia date, p_vagas int default 1, p_ignorar uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  sv services; s stores; h record; v_tz text := public.loja_fuso();
  v_passo interval; v_dur interval; v_ini timestamptz; v_fim_abertura timestamptz; v_livres int;
  v_lista jsonb := '[]'::jsonb;
begin
  select * into sv from services where id = p_service and active;
  if sv.id is null or sv.modelo <> 'horario' or sv.duration_min is null then raise exception 'Serviço sem agenda por horário.' using errcode = '22023'; end if;
  select * into s from stores where id = sv.store_id;
  if s.status <> 'aprovada' and not public.loja_membro(s.id) then raise exception 'Loja não disponível.' using errcode = '22023'; end if;
  if p_dia < (now() at time zone v_tz)::date or p_dia > (now() at time zone v_tz)::date + 60 then return '[]'::jsonb; end if;
  if coalesce(p_vagas, 1) not between 1 and sv.capacity then raise exception 'Vagas acima do limite do serviço.' using errcode = '22023'; end if;
  v_dur := make_interval(mins => sv.duration_min);
  v_passo := make_interval(mins => sv.duration_min + sv.buffer_min);
  for h in select opens, closes from store_hours where store_id = s.id and weekday = extract(dow from p_dia)::int order by opens loop
    v_ini := (p_dia + h.opens) at time zone v_tz;
    v_fim_abertura := (p_dia + h.closes) at time zone v_tz;
    while v_ini + v_passo <= v_fim_abertura loop
      if v_ini > now()
         and not exists (select 1 from time_off t where t.store_id = s.id and t.starts_at < v_ini + v_passo and t.ends_at > v_ini) then
        v_livres := sv.capacity - public.servico_pico(sv.id, v_ini, v_ini + v_passo, p_ignorar);
        if v_livres >= coalesce(p_vagas, 1) then
          v_lista := v_lista || jsonb_build_object('inicio', v_ini, 'fim', v_ini + v_dur, 'vagas_livres', v_livres);
        end if;
      end if;
      v_ini := v_ini + v_passo;
    end loop;
  end loop;
  return v_lista;
end;
$$;

create or replace function public.servico_reservar(p_service uuid, p_inicio timestamptz, p_pet uuid default null, p_message text default null, p_vagas int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sv services; s stores; v_id uuid; v_dia date;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  -- Trava o serviço: duas reservas ao mesmo tempo não passam do limite de vagas.
  select * into sv from services where id = p_service and active for update;
  if sv.id is null then raise exception 'Serviço não disponível.' using errcode = '22023'; end if;
  select * into s from stores where id = sv.store_id;
  if s.status <> 'aprovada' or s.oferece = 'produtos' then raise exception 'Esta loja não está disponível.' using errcode = '22023'; end if;
  if p_pet is not null and not public.is_pet_owner(p_pet) then raise exception 'Pet não disponível nesta conta.' using errcode = '42501'; end if;
  if (select count(*) from requests where user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas solicitações seguidas. Aguarde um pouco.' using errcode = '23514';
  end if;
  v_dia := (p_inicio at time zone public.loja_fuso())::date;
  if not exists (select 1 from jsonb_array_elements(public.horarios_livres(sv.id, v_dia, coalesce(p_vagas, 1))) x where (x->>'inicio')::timestamptz = p_inicio) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode = '22023', hint = 'horario_ocupado';
  end if;
  insert into requests (user_id, store_id, kind, status, service_id, vagas, starts_at, ends_at, ocupado_ate, pet_id,
                        subtotal_cents, total_cents, pay_method, message, expira_em)
  values (auth.uid(), s.id, 'servico', 'enviada', sv.id, coalesce(p_vagas, 1), p_inicio, p_inicio + make_interval(mins => sv.duration_min),
          p_inicio + make_interval(mins => sv.duration_min + sv.buffer_min), p_pet,
          coalesce(sv.price_cents, 0) * coalesce(p_vagas, 1), coalesce(sv.price_cents, 0) * coalesce(p_vagas, 1), 'na_loja',
          nullif(left(btrim(coalesce(p_message, '')), 500), ''),
          least(now() + make_interval(mins => s.response_deadline_min), p_inicio))
  returning id into v_id;
  insert into request_items (request_id, service_id, nome, qty, unit_cents) values (v_id, sv.id, sv.name, coalesce(p_vagas, 1), coalesce(sv.price_cents, 0));
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Nova reserva', sv.name || ' em ' || to_char(p_inicio at time zone public.loja_fuso(), 'DD/MM "às" HH24:MI') || '.', '/loja-painel/pedido/' || v_id
  from store_members m where m.store_id = s.id and m.active;
  if s.auto_confirm then
    perform set_config('petlive.auto_confirmar', v_id::text, true);
    perform public.solicitacao_mudar(v_id, 'confirmada', null, null);
    perform set_config('petlive.auto_confirmar', '', true);
  end if;
  return jsonb_build_object('id', v_id, 'status', (select status from requests where id = v_id));
end;
$$;

-- Remarcar: o tutor troca o horário dentro do prazo de cancelamento; a vaga é reconferida.
create or replace function public.servico_remarcar(p_request uuid, p_inicio timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare r requests; sv services; s stores;
begin
  select * into r from requests where id = p_request for update;
  if r.id is null or r.user_id <> auth.uid() or r.kind <> 'servico' then raise exception 'Reserva não encontrada.' using errcode = '42501'; end if;
  if r.status not in ('enviada', 'confirmada') then raise exception 'Esta reserva não pode mais ser remarcada.' using errcode = '22023'; end if;
  select * into sv from services where id = r.service_id for update;
  select * into s from stores where id = r.store_id;
  if now() > r.starts_at - make_interval(mins => s.cancel_until_min) then
    raise exception 'O prazo para remarcar já passou. Fale com a loja.' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.horarios_livres(sv.id, (p_inicio at time zone public.loja_fuso())::date, r.vagas, r.id)) x
                 where (x->>'inicio')::timestamptz = p_inicio) then
    raise exception 'Este horário não está livre. Escolha outro.' using errcode = '22023', hint = 'horario_ocupado';
  end if;
  update requests set starts_at = p_inicio, ends_at = p_inicio + make_interval(mins => sv.duration_min),
    ocupado_ate = p_inicio + make_interval(mins => sv.duration_min + sv.buffer_min), lembrete_enviado = false, atualizado_em = now()
  where id = r.id;
  insert into request_events (request_id, from_status, to_status, actor_id, reason)
  values (r.id, r.status, r.status, auth.uid(), 'Remarcado para ' || to_char(p_inicio at time zone public.loja_fuso(), 'DD/MM HH24:MI'));
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Reserva remarcada', sv.name || ': novo horário ' || to_char(p_inicio at time zone public.loja_fuso(), 'DD/MM "às" HH24:MI') || '.', '/loja-painel/pedido/' || r.id
  from store_members m where m.store_id = r.store_id and m.active;
end;
$$;

-- Lembrete ao tutor cerca de 2 horas antes do horário confirmado (cron a cada 15 min).
create or replace function public.reservas_lembrar()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  for r in select q.id, q.user_id, q.starts_at, s.name loja, sv.name servico
           from requests q join stores s on s.id = q.store_id left join services sv on sv.id = q.service_id
           where q.kind = 'servico' and q.status = 'confirmada' and not q.lembrete_enviado
             and q.starts_at between now() and now() + interval '2 hours 15 minutes'
           for update of q skip locked loop
    insert into notification_log (user_id, type, title, body, deep_link)
    values (r.user_id, 'pedido', 'Seu horário está chegando', coalesce(r.servico, 'Serviço') || ' em ' || r.loja || ' às ' || to_char(r.starts_at at time zone public.loja_fuso(), 'HH24:MI') || '.', '/pedidos/' || r.id);
    update requests set lembrete_enviado = true where id = r.id;
    v := v + 1;
  end loop;
  return v;
end;
$$;

-- O detalhe da solicitação passa a mostrar o horário e o serviço.
create or replace function public.solicitacao_json(r requests)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'status', r.status, 'kind', r.kind, 'fulfillment', r.fulfillment,
    'subtotal_cents', r.subtotal_cents, 'delivery_fee_cents', r.delivery_fee_cents, 'discount_cents', r.discount_cents, 'total_cents', r.total_cents,
    'pay_method', r.pay_method, 'message', r.message, 'motivo', r.motivo, 'endereco', r.endereco_texto,
    'codigo_entrega', case when r.user_id = auth.uid() and r.fulfillment = 'entrega' and r.status in ('confirmada', 'pronta', 'em_entrega') then r.codigo_entrega end,
    'expira_em', r.expira_em, 'criado_em', r.criado_em, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'service_id', r.service_id, 'pet', (select jsonb_build_object('id', p.id, 'nome', p.nome) from pets p where p.id = r.pet_id),
    'loja', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
                               'pickup_prepare_min', s.pickup_prepare_min, 'cancel_until_min', s.cancel_until_min),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', ri.nome, 'qty', ri.qty, 'unit_cents', ri.unit_cents, 'product_id', ri.product_id) order by ri.id)
                       from request_items ri where ri.request_id = r.id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.at, 'reason', e.reason) order by e.at)
                         from request_events e where e.request_id = r.id), '[]'::jsonb))
  from stores s where s.id = r.store_id;
$$;
revoke all on function public.solicitacao_json(requests) from public, anon, authenticated;

revoke all on function public.servico_pico(uuid, timestamptz, timestamptz, uuid), public.reservas_lembrar() from public, anon, authenticated;
revoke all on function public.horarios_livres(uuid, date, int, uuid), public.servico_reservar(uuid, timestamptz, uuid, text, int),
  public.servico_remarcar(uuid, timestamptz) from public, anon;
grant execute on function public.horarios_livres(uuid, date, int, uuid), public.servico_reservar(uuid, timestamptz, uuid, text, int),
  public.servico_remarcar(uuid, timestamptz) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-reservas-lembrar') where exists (select 1 from cron.job where jobname = 'petlive-reservas-lembrar');
    perform cron.schedule('petlive-reservas-lembrar', '*/15 * * * *', 'select public.reservas_lembrar()');
  end if;
end $$;

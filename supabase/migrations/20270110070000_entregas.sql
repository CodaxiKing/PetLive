-- Entrega pela loja (BUSINESS.md 5.8 e 20.3). Acompanha a solicitação de
-- entrega: preparando → pronta_para_sair → em_rota → entregue (com o código de
-- 4 dígitos) ou falhou → nova tentativa (em_rota) ou devolvida. O tutor vê o
-- prazo, o entregador, a posição aproximada e o código; recebe aviso a cada passo.

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  status text not null default 'preparando' check (status in ('preparando', 'pronta_para_sair', 'em_rota', 'entregue', 'falhou', 'devolvida')),
  courier_id uuid references auth.users (id) on delete set null,
  eta_at timestamptz,
  left_at timestamptz,
  delivered_at timestamptz,
  fail_reason text check (char_length(fail_reason) <= 300),
  tentativas int not null default 0,
  ultimo_lat double precision,
  ultimo_lng double precision,
  posicao_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.deliveries enable row level security;
revoke all on public.deliveries from public, anon, authenticated;

-- Cria e avança a entrega junto com a solicitação (confirmada, pronta, em_entrega, concluída).
create or replace function public.entrega_acompanhar_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare s stores;
begin
  if new.fulfillment <> 'entrega' or new.status is not distinct from old.status then return new; end if;
  select * into s from stores where id = new.store_id;
  if new.status = 'confirmada' then
    insert into deliveries (request_id, store_id, status) values (new.id, new.store_id, 'preparando') on conflict (request_id) do nothing;
  elsif new.status = 'pronta' then
    update deliveries set status = 'pronta_para_sair' where request_id = new.id and status = 'preparando';
  elsif new.status = 'em_entrega' then
    update deliveries set status = 'em_rota', left_at = coalesce(left_at, now()), courier_id = coalesce(courier_id, auth.uid()),
      eta_at = now() + make_interval(mins => s.delivery_eta_max), tentativas = tentativas + 1
    where request_id = new.id;
  elsif new.status = 'concluida' then
    update deliveries set status = 'entregue', delivered_at = now() where request_id = new.id;
  elsif new.status in ('cancelada', 'nao_compareceu') then
    update deliveries set status = 'devolvida' where request_id = new.id and status <> 'entregue';
  end if;
  return new;
end;
$$;
revoke all on function public.entrega_acompanhar_status() from public, anon, authenticated;
drop trigger if exists requests_entrega on public.requests;
create trigger requests_entrega after update of status on public.requests for each row execute function public.entrega_acompanhar_status();

-- Entregador (equipe da loja) informa a posição durante a rota.
create or replace function public.entrega_posicao(p_request uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
declare d deliveries;
begin
  select * into d from deliveries where request_id = p_request for update;
  if d.id is null or not public.loja_membro(d.store_id) then raise exception 'Entrega não disponível.' using errcode = '42501'; end if;
  if d.status <> 'em_rota' then raise exception 'A entrega não está em rota.' using errcode = '22023'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Posição inválida.' using errcode = '22023'; end if;
  update deliveries set ultimo_lat = p_lat, ultimo_lng = p_lng, posicao_em = now() where id = d.id;
end;
$$;

-- Ninguém recebeu: avisa o tutor; a loja tenta de novo (Saiu para entrega) ou devolve (cancela).
create or replace function public.entrega_falhou(p_request uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare d deliveries; r requests;
begin
  select * into d from deliveries where request_id = p_request for update;
  if d.id is null or not public.loja_membro(d.store_id) then raise exception 'Entrega não disponível.' using errcode = '42501'; end if;
  if d.status <> 'em_rota' then raise exception 'A entrega não está em rota.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo.' using errcode = '22023'; end if;
  update deliveries set status = 'falhou', fail_reason = left(btrim(p_motivo), 300) where id = d.id;
  -- A solicitação volta para "pronta" para a loja sair de novo.
  update requests set status = 'pronta', motivo = left(btrim(p_motivo), 300), atualizado_em = now() where id = p_request returning * into r;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (r.user_id, 'pedido', 'Não conseguimos entregar', left(btrim(p_motivo), 140) || '. A loja vai combinar uma nova tentativa.', '/pedidos/' || r.id);
end;
$$;

-- Para o tutor (e a loja): entrega da solicitação.
create or replace function public.entrega_detalhe(p_request uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r requests; d deliveries;
begin
  select * into r from requests where id = p_request;
  if r.id is null or not (r.user_id = auth.uid() or public.loja_membro(r.store_id)) then return null; end if;
  select * into d from deliveries where request_id = r.id;
  if d.id is null then return null; end if;
  return jsonb_build_object('status', d.status, 'eta_at', d.eta_at, 'left_at', d.left_at, 'delivered_at', d.delivered_at,
    'fail_reason', d.fail_reason, 'tentativas', d.tentativas,
    'entregador', case when d.courier_id is not null then public.comunidade_nome(d.courier_id) end,
    -- Posição só durante a rota e se for recente (até 10 min).
    'posicao', case when d.status = 'em_rota' and d.posicao_em > now() - interval '10 minutes' then jsonb_build_object('lat', d.ultimo_lat, 'lng', d.ultimo_lng, 'em', d.posicao_em) end);
end;
$$;

revoke all on function public.entrega_posicao(uuid, double precision, double precision), public.entrega_falhou(uuid, text), public.entrega_detalhe(uuid) from public, anon;
grant execute on function public.entrega_posicao(uuid, double precision, double precision), public.entrega_falhou(uuid, text), public.entrega_detalhe(uuid) to authenticated;

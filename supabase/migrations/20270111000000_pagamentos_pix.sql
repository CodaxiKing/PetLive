-- Pagamento por Pix no app e cupons de desconto (BUSINESS.md 5.4, 5.9, 20.4
-- e 23.1; Fase 3, etapa 2). O pedido pago por Pix nasce em
-- "aguardando_pagamento": a loja só recebe o aviso depois que o Asaas confirma.
-- A cobrança é criada pela função create-pix-charge e confirmada pela
-- pix-webhook, as duas com a chave de serviço; nenhuma tela fala com o Asaas.
-- O CPF do tutor vai direto ao provedor e não fica no banco: guardamos só o
-- código do cliente no Asaas.

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda', 'perdido', 'comunidade', 'pedido', 'pagamento'));

-- Valor em reais com vírgula, independente da configuração regional do banco.
create or replace function public.reais_texto(p_centavos int)
returns text language sql immutable as $$ select replace(to_char(p_centavos / 100.0, 'FM999999990.00'), '.', ',') $$;

-- ============================================================
-- Cupons
-- ============================================================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Sem loja: cupom do PetLive, vale em qualquer loja.
  store_id uuid references public.stores (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  descricao text check (char_length(descricao) <= 120),
  tipo text not null check (tipo in ('percentual', 'valor')),
  valor int not null check (valor > 0),
  minimo_cents int not null default 0 check (minimo_cents >= 0),
  primeiro_pedido boolean not null default false,
  valido_ate timestamptz,
  usos_max int check (usos_max > 0),
  usos int not null default 0 check (usos >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  check (tipo <> 'percentual' or valor <= 100)
);
create unique index if not exists coupons_codigo on public.coupons (coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
alter table public.coupons enable row level security;
revoke all on public.coupons from public, anon, authenticated;

create table if not exists public.coupon_uses (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
alter table public.coupon_uses enable row level security;
revoke all on public.coupon_uses from public, anon, authenticated;

alter table public.requests add column if not exists coupon_id uuid references public.coupons (id) on delete set null;

-- Desconto de um cupom para este tutor, nesta loja e neste subtotal. Erro explica o motivo.
create or replace function public.cupom_calcular(p_store uuid, p_codigo text, p_subtotal int, p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c coupons; v_codigo text := upper(btrim(coalesce(p_codigo, ''))); v_desc int;
begin
  if p_user is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into c from coupons
  where code = v_codigo and ativo and (store_id = p_store or store_id is null)
  order by store_id nulls last limit 1;
  if c.id is null then raise exception 'Cupom não encontrado.' using errcode = '22023', hint = 'cupom'; end if;
  if c.valido_ate is not null and c.valido_ate < now() then raise exception 'Este cupom venceu.' using errcode = '22023', hint = 'cupom'; end if;
  if c.usos_max is not null and c.usos >= c.usos_max then raise exception 'Este cupom esgotou.' using errcode = '22023', hint = 'cupom'; end if;
  if exists (select 1 from coupon_uses u where u.coupon_id = c.id and u.user_id = p_user) then
    raise exception 'Você já usou este cupom.' using errcode = '22023', hint = 'cupom';
  end if;
  if c.primeiro_pedido and exists (
    select 1 from requests r where r.user_id = p_user and r.status not in ('recusada', 'expirada', 'cancelada')
      and (c.store_id is null or r.store_id = c.store_id)) then
    raise exception 'Este cupom vale só no primeiro pedido.' using errcode = '22023', hint = 'cupom';
  end if;
  if p_subtotal < c.minimo_cents then
    raise exception 'Este cupom vale para pedidos a partir de R$ %.', public.reais_texto(c.minimo_cents) using errcode = '22023', hint = 'cupom';
  end if;
  v_desc := case c.tipo when 'percentual' then round(p_subtotal * c.valor / 100.0)::int else c.valor end;
  v_desc := least(v_desc, p_subtotal);
  return jsonb_build_object('id', c.id, 'code', c.code, 'descricao', c.descricao, 'tipo', c.tipo, 'valor', c.valor,
                            'desconto_cents', v_desc, 'valido_ate', c.valido_ate);
end;
$$;

-- Prévia para a tela Cupom (o pedido ainda não existe).
create or replace function public.cupom_aplicar(p_store uuid, p_codigo text, p_subtotal int)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.cupom_calcular(p_store, p_codigo, p_subtotal);
$$;

-- Cupons que o tutor ainda pode usar nesta loja (lista "Cupons para você").
create or replace function public.cupons_para_mim(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'descricao', c.descricao, 'tipo', c.tipo, 'valor', c.valor,
                                               'minimo_cents', c.minimo_cents, 'valido_ate', c.valido_ate) order by c.valido_ate nulls last, c.code), '[]'::jsonb)
  from coupons c
  where auth.uid() is not null and c.ativo and (c.store_id = p_store or c.store_id is null)
    and (c.valido_ate is null or c.valido_ate > now()) and (c.usos_max is null or c.usos < c.usos_max)
    and not exists (select 1 from coupon_uses u where u.coupon_id = c.id and u.user_id = auth.uid())
    and not (c.primeiro_pedido and exists (select 1 from requests r where r.user_id = auth.uid()
             and r.status not in ('recusada', 'expirada', 'cancelada') and (c.store_id is null or r.store_id = c.store_id)));
$$;

-- A loja cria e desliga os próprios cupons (dono ou gerente).
create or replace function public.loja_cupom_salvar(p_store uuid, p_codigo text, p_tipo text, p_valor int, p_descricao text default null,
  p_minimo_cents int default 0, p_primeiro_pedido boolean default false, p_valido_ate timestamptz default null, p_usos_max int default null,
  p_ativo boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.loja_membro(p_store, array['owner', 'manager']) then raise exception 'Só o dono ou o gerente cria cupons.' using errcode = '42501'; end if;
  insert into coupons (store_id, code, descricao, tipo, valor, minimo_cents, primeiro_pedido, valido_ate, usos_max, ativo)
  values (p_store, upper(btrim(p_codigo)), nullif(btrim(coalesce(p_descricao, '')), ''), p_tipo, p_valor, coalesce(p_minimo_cents, 0),
          coalesce(p_primeiro_pedido, false), p_valido_ate, p_usos_max, coalesce(p_ativo, true))
  on conflict (coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), code) do update set
    descricao = excluded.descricao, tipo = excluded.tipo, valor = excluded.valor, minimo_cents = excluded.minimo_cents,
    primeiro_pedido = excluded.primeiro_pedido, valido_ate = excluded.valido_ate, usos_max = excluded.usos_max, ativo = excluded.ativo
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- Pagamentos
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  codigo bigint generated always as identity,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.requests (id) on delete set null,
  provider text not null default 'asaas' check (provider in ('asaas')),
  provider_id text check (char_length(provider_id) between 1 and 100),
  method text not null default 'pix' check (method in ('pix')),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'criando' check (status in ('criando', 'pendente', 'pago', 'expirado', 'cancelado', 'estorno_pendente', 'estornado')),
  descricao text not null check (char_length(descricao) between 1 and 200),
  pix_payload text check (char_length(pix_payload) <= 1000),
  pix_qr text check (char_length(pix_qr) <= 60000),
  expires_at timestamptz not null default now() + interval '30 minutes',
  paid_at timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists payments_provider on public.payments (provider, provider_id) where provider_id is not null;
create index if not exists payments_user on public.payments (user_id, criado_em desc);
create index if not exists payments_pendentes on public.payments (expires_at) where status in ('criando', 'pendente');
-- Um pedido tem no máximo uma cobrança em aberto ou paga.
create unique index if not exists payments_um_por_pedido on public.payments (request_id) where request_id is not null and status in ('criando', 'pendente', 'pago');
alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated;

-- Código do cliente no provedor, para não pedir o CPF a cada cobrança.
create table if not exists public.payment_customers (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('asaas')),
  customer_id text not null check (char_length(customer_id) between 1 and 100),
  criado_em timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.payment_customers enable row level security;
revoke all on public.payment_customers from public, anon, authenticated;
grant all on public.payments, public.payment_customers, public.coupons, public.coupon_uses to service_role;

-- O pedido pago por Pix espera o pagamento antes de ir para a loja.
alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check check (status in ('aguardando_pagamento', 'enviada', 'confirmada', 'recusada', 'expirada',
  'cancelada', 'pronta', 'em_entrega', 'em_andamento', 'concluida', 'nao_compareceu'));

create or replace function public.solicitacao_transicao_valida(p_de text, p_para text)
returns boolean language sql immutable as $$
  select (p_de, p_para) in (
    ('aguardando_pagamento', 'enviada'), ('aguardando_pagamento', 'expirada'), ('aguardando_pagamento', 'cancelada'),
    ('enviada', 'confirmada'), ('enviada', 'recusada'), ('enviada', 'expirada'), ('enviada', 'cancelada'),
    ('confirmada', 'pronta'), ('confirmada', 'em_andamento'), ('confirmada', 'cancelada'), ('confirmada', 'nao_compareceu'),
    ('pronta', 'em_entrega'), ('pronta', 'concluida'), ('pronta', 'cancelada'), ('pronta', 'nao_compareceu'),
    ('em_entrega', 'concluida'), ('em_andamento', 'concluida'));
$$;

-- Aviso à loja e confirmação automática: na criação (pagar na loja) ou quando o Pix é confirmado.
create or replace function public.solicitacao_avisar_loja(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r requests; s stores;
begin
  select * into r from requests where id = p_id;
  select * into s from stores where id = r.store_id;
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Nova solicitação',
         'Pedido de R$ ' || public.reais_texto(r.total_cents) || ' para ' || r.fulfillment
           || case when r.pay_method = 'pix_app' then ', pago por Pix.' else '.' end,
         '/loja-painel/pedido/' || r.id
  from store_members m where m.store_id = s.id and m.active;
  if s.auto_confirm then
    perform set_config('petlive.auto_confirmar', r.id::text, true);
    perform public.solicitacao_mudar(r.id, 'confirmada', null, null);
    perform set_config('petlive.auto_confirmar', '', true);
  end if;
end;
$$;

drop function if exists public.solicitacao_criar(uuid, jsonb, text, text, uuid, text);
create or replace function public.solicitacao_criar(p_store uuid, p_itens jsonb, p_fulfillment text, p_message text default null,
  p_address_id uuid default null, p_pay_method text default 'na_loja', p_cupom text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s stores; a addresses; p products; i jsonb; c jsonb;
  v_id uuid; v_sub int := 0; v_taxa int := 0; v_desc int := 0; v_qtd int; v_codigo text; v_end text;
  v_ids uuid[] := '{}'; v_pix boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store for share;
  if s.id is null or s.status <> 'aprovada' or s.oferece = 'servicos' then raise exception 'Esta loja não está disponível.' using errcode = '22023'; end if;
  if not public.loja_aberta_agora(s.id) then raise exception 'A loja está fechada agora. Tente no horário de atendimento.' using errcode = '22023'; end if;
  if p_pay_method not in ('na_loja', 'pix_app') then raise exception 'Escolha Pix ou pagar na loja.' using errcode = '22023'; end if;
  v_pix := p_pay_method = 'pix_app';
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 30 then
    raise exception 'Escolha de 1 a 30 produtos.' using errcode = '22023';
  end if;
  if (select count(*) from requests where user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas solicitações seguidas. Aguarde um pouco.' using errcode = '23514';
  end if;

  -- Confere cada produto: da loja, à venda pelo app (nunca local_com_receita) e com estoque.
  for i in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((i->>'qty')::int, 0);
    if v_qtd not between 1 and 99 then raise exception 'Quantidade inválida.' using errcode = '22023'; end if;
    select * into p from products where id = (i->>'product_id')::uuid and store_id = s.id;
    if p.id is null or not public.produto_visivel(p) then raise exception 'Um dos produtos não está mais disponível.' using errcode = '22023'; end if;
    if p.venda = 'local_com_receita' then
      raise exception '% é vendido só na loja, com receita.', p.name using errcode = '22023', hint = 'local_com_receita';
    end if;
    if p.venda <> 'app' then raise exception 'Um dos produtos não está à venda pelo app.' using errcode = '22023'; end if;
    if p.id = any (v_ids) then raise exception 'Produto repetido na solicitação.' using errcode = '22023'; end if;
    if p.stock < v_qtd then raise exception 'Só há % unidade(s) de %.', p.stock, p.name using errcode = '22023', hint = 'estoque'; end if;
    v_ids := v_ids || p.id;
    v_sub := v_sub + p.price_cents * v_qtd;
  end loop;

  if p_fulfillment = 'retirada' then
    if not s.pickup_enabled then raise exception 'Esta loja não faz retirada.' using errcode = '22023'; end if;
  elsif p_fulfillment = 'entrega' then
    if not s.delivery_enabled or s.delivery_mode <> 'fixa' then raise exception 'Esta loja ainda não entrega pelo app. Escolha retirada.' using errcode = '22023'; end if;
    select * into a from addresses where id = p_address_id and user_id = auth.uid();
    if a.id is null then raise exception 'Escolha o endereço de entrega.' using errcode = '22023'; end if;
    if a.lat is null or s.lat is null or public.perdido_distancia_km(a.lat, a.lng, s.lat, s.lng) > s.delivery_radius_km then
      raise exception 'Este endereço fica fora da área de entrega. Escolha retirada.' using errcode = '22023', hint = 'fora_do_raio';
    end if;
    if v_sub < s.delivery_min_order_cents then
      raise exception 'O pedido mínimo para entrega é de R$ %.', public.reais_texto(s.delivery_min_order_cents) using errcode = '22023', hint = 'pedido_minimo';
    end if;
    v_taxa := case when s.delivery_free_over_cents is not null and v_sub >= s.delivery_free_over_cents then 0 else s.delivery_fee_cents end;
    v_codigo := lpad((floor(random() * 10000))::int::text, 4, '0');
    v_end := concat_ws(', ', a.street || coalesce(' ' || a.number, ''), a.complement, a.neighborhood, a.city);
  else
    raise exception 'Escolha retirada ou entrega.' using errcode = '22023';
  end if;

  -- Cupom: desconto sobre os produtos, nunca sobre a entrega. Trava o cupom para o limite de usos.
  if nullif(btrim(coalesce(p_cupom, '')), '') is not null then
    c := public.cupom_calcular(s.id, p_cupom, v_sub);
    perform 1 from coupons where id = (c->>'id')::uuid for update;
    v_desc := (c->>'desconto_cents')::int;
    if v_pix and v_sub + v_taxa - v_desc = 0 then v_pix := false; end if;
  end if;

  insert into requests (user_id, store_id, kind, status, fulfillment, subtotal_cents, delivery_fee_cents, discount_cents, total_cents, pay_method,
                        coupon_id, message, address_id, endereco_texto, codigo_entrega, expira_em)
  values (auth.uid(), s.id, 'produto', case when v_pix then 'aguardando_pagamento' else 'enviada' end, p_fulfillment, v_sub, v_taxa, v_desc,
          v_sub + v_taxa - v_desc, case when v_pix then 'pix_app' else 'na_loja' end, (c->>'id')::uuid,
          nullif(left(btrim(coalesce(p_message, '')), 500), ''), a.id, v_end, v_codigo,
          -- Com Pix, o prazo é o da cobrança; o prazo da loja começa quando o pagamento entra.
          case when v_pix then now() + interval '30 minutes' else now() + make_interval(mins => s.response_deadline_min) end)
  returning id into v_id;
  insert into request_items (request_id, product_id, nome, qty, unit_cents)
  select v_id, p2.id, p2.name, (x->>'qty')::int, p2.price_cents
  from jsonb_array_elements(p_itens) x join products p2 on p2.id = (x->>'product_id')::uuid;
  if c is not null then
    insert into coupon_uses (coupon_id, user_id, request_id) values ((c->>'id')::uuid, auth.uid(), v_id);
    update coupons set usos = usos + 1 where id = (c->>'id')::uuid;
  end if;

  if not v_pix then perform public.solicitacao_avisar_loja(v_id); end if;
  return jsonb_build_object('id', v_id, 'status', (select status from requests where id = v_id), 'total_cents', v_sub + v_taxa - v_desc,
                            'pay_method', case when v_pix then 'pix_app' else 'na_loja' end);
end;
$$;

-- Pedido que não chega à loja devolve o cupom; pedido pago e não atendido pede estorno.
create or replace function public.pagamento_apos_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('recusada', 'expirada', 'cancelada', 'nao_compareceu') and old.status is distinct from new.status then
    if new.coupon_id is not null and new.status <> 'nao_compareceu' then
      delete from coupon_uses where coupon_id = new.coupon_id and request_id = new.id;
      if found then update coupons set usos = greatest(usos - 1, 0) where id = new.coupon_id; end if;
    end if;
    update payments set status = 'cancelado', atualizado_em = now() where request_id = new.id and status in ('criando', 'pendente');
    if new.status <> 'nao_compareceu' then
      update payments set status = 'estorno_pendente', atualizado_em = now() where request_id = new.id and status = 'pago';
      if found then
        insert into notification_log (user_id, type, title, body, deep_link)
        values (new.user_id, 'pagamento', 'Estorno a caminho', 'O valor pago por Pix volta para a sua conta em até 3 dias úteis.', '/pedidos/' || new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists requests_pagamento on public.requests;
create trigger requests_pagamento after update of status on public.requests for each row execute function public.pagamento_apos_pedido();

-- O tutor cancela também enquanto o Pix está em aberto; a loja nunca vê este pedido.
create or replace function public.pagamento_pedido_valido(p_request uuid)
returns requests language plpgsql stable security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request;
  if r.id is null or r.user_id is distinct from auth.uid() then raise exception 'Pedido não encontrado.' using errcode = '42501'; end if;
  if r.pay_method <> 'pix_app' then raise exception 'Este pedido é pago na loja.' using errcode = '22023'; end if;
  if r.status <> 'aguardando_pagamento' then raise exception 'Este pedido não está esperando pagamento.' using errcode = '22023', hint = 'status'; end if;
  return r;
end;
$$;

-- Chamado pela create-pix-charge com o token do tutor: reserva a cobrança antes de falar com o Asaas.
-- Devolve a cobrança em aberto quando já existe (o app pode reabrir a tela do Pix).
create or replace function public.pagamento_preparar(p_request uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r requests; pg payments; v_loja text;
begin
  r := public.pagamento_pedido_valido(p_request);
  select name into v_loja from stores where id = r.store_id;
  select * into pg from payments where request_id = r.id and status in ('criando', 'pendente') for update;
  if pg.id is not null and pg.status = 'pendente' and pg.expires_at > now() then
    return jsonb_build_object('id', pg.id, 'pronto', true);
  end if;
  if pg.id is not null then
    -- Tentativa anterior sem resposta do provedor (ou vencida): começa de novo.
    update payments set status = 'cancelado', atualizado_em = now() where id = pg.id;
  end if;
  insert into payments (user_id, request_id, amount_cents, descricao, expires_at)
  values (r.user_id, r.id, r.total_cents, left('Pedido nº ' || r.numero || ' em ' || v_loja, 200), least(r.expira_em, now() + interval '30 minutes'))
  returning * into pg;
  return jsonb_build_object('id', pg.id, 'pronto', false, 'amount_cents', pg.amount_cents, 'descricao', pg.descricao, 'expires_at', pg.expires_at,
    'customer_id', (select customer_id from payment_customers where user_id = r.user_id and provider = 'asaas'));
end;
$$;

-- Só o servidor (create-pix-charge, com a chave de serviço) grava o que o Asaas devolveu.
create or replace function public.pagamento_registrar(p_payment uuid, p_provider_id text, p_payload text, p_qr text, p_expira timestamptz,
  p_customer_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare pg payments;
begin
  select * into pg from payments where id = p_payment for update;
  if pg.id is null or pg.status <> 'criando' then raise exception 'Cobrança não está sendo criada.' using errcode = '22023'; end if;
  update payments set provider_id = p_provider_id, pix_payload = p_payload, pix_qr = p_qr, status = 'pendente',
    expires_at = least(coalesce(p_expira, expires_at), expires_at), atualizado_em = now()
  where id = pg.id;
  if p_customer_id is not null then
    insert into payment_customers (user_id, provider, customer_id) values (pg.user_id, pg.provider, p_customer_id)
    on conflict (user_id, provider) do update set customer_id = excluded.customer_id;
  end if;
end;
$$;

-- Confirmação do provedor (pix-webhook). Idempotente: o Asaas pode repetir o aviso.
create or replace function public.pagamento_confirmado(p_provider_id text, p_valor_cents int, p_pago_em timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare pg payments; r requests;
begin
  select * into pg from payments where provider = 'asaas' and provider_id = p_provider_id for update;
  if pg.id is null then return jsonb_build_object('ok', false, 'motivo', 'desconhecido'); end if;
  if pg.status in ('pago', 'estorno_pendente', 'estornado') then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if p_valor_cents < pg.amount_cents then
    raise exception 'Valor pago menor que o cobrado.' using errcode = '22023';
  end if;
  update payments set status = 'pago', paid_at = coalesce(p_pago_em, now()), atualizado_em = now() where id = pg.id;

  if pg.request_id is not null then
    select * into r from requests where id = pg.request_id for update;
    if r.status = 'aguardando_pagamento' then
      -- Agora o pedido vai para a loja, com o prazo de resposta dela contando a partir daqui.
      update requests set status = 'enviada', motivo = null, atualizado_em = now(),
        expira_em = now() + make_interval(mins => (select response_deadline_min from stores where id = r.store_id))
      where id = r.id;
      perform public.solicitacao_avisar_loja(r.id);
    else
      -- Pagou depois de cancelar ou expirar: devolve.
      update payments set status = 'estorno_pendente', atualizado_em = now() where id = pg.id;
    end if;
  end if;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (pg.user_id, 'pagamento', 'Pagamento confirmado', 'Recebemos R$ ' || public.reais_texto(pg.amount_cents) || ' por Pix.', '/pagamento/' || pg.id);
  return jsonb_build_object('ok', true, 'id', pg.id);
end;
$$;

-- Pix vencido: a cobrança expira e o pedido também (cron a cada 5 minutos).
create or replace function public.pagamentos_expirar()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  update payments set status = 'expirado', atualizado_em = now() where status in ('criando', 'pendente') and expires_at <= now();
  for r in update requests set status = 'expirada', motivo = 'O Pix venceu antes do pagamento', atualizado_em = now()
           where id in (select id from requests where status = 'aguardando_pagamento' and expira_em <= now() order by expira_em limit 500)
           returning id, user_id loop
    insert into notification_log (user_id, type, title, body, deep_link)
    values (r.user_id, 'pagamento', 'O Pix venceu', 'O pedido não foi enviado à loja. Faça de novo quando quiser.', '/pedidos/' || r.id);
    v := v + 1;
  end loop;
  return v;
end;
$$;

-- Tela do Pix e comprovante. O tutor só vê as próprias cobranças.
create or replace function public.pagamento_json(pg payments)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', pg.id, 'codigo', 'PX-' || pg.codigo, 'status', pg.status, 'amount_cents', pg.amount_cents,
    'descricao', pg.descricao, 'method', pg.method, 'pix_payload', case when pg.status = 'pendente' then pg.pix_payload end,
    'pix_qr', case when pg.status = 'pendente' then pg.pix_qr end, 'expires_at', pg.expires_at, 'paid_at', pg.paid_at, 'criado_em', pg.criado_em,
    'request_id', pg.request_id,
    'para', (select s.name from requests r join stores s on s.id = r.store_id where r.id = pg.request_id),
    'itens', coalesce((select jsonb_agg(ri.nome || ' × ' || ri.qty order by ri.id) from request_items ri where ri.request_id = pg.request_id), '[]'::jsonb));
$$;

create or replace function public.pagamento_detalhe(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pg payments;
begin
  select * into pg from payments where id = p_id and user_id = auth.uid();
  if pg.id is null then return null; end if;
  return public.pagamento_json(pg);
end;
$$;

-- O pedido mostra a cobrança mais recente (para reabrir o Pix ou ver o comprovante).
create or replace function public.solicitacao_json(r requests)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'status', r.status, 'kind', r.kind, 'fulfillment', r.fulfillment,
    'subtotal_cents', r.subtotal_cents, 'delivery_fee_cents', r.delivery_fee_cents, 'discount_cents', r.discount_cents, 'total_cents', r.total_cents,
    'pay_method', r.pay_method, 'message', r.message, 'motivo', r.motivo, 'endereco', r.endereco_texto,
    'codigo_entrega', case when r.user_id = auth.uid() and r.fulfillment = 'entrega' and r.status in ('confirmada', 'pronta', 'em_entrega') then r.codigo_entrega end,
    'expira_em', r.expira_em, 'criado_em', r.criado_em, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'service_id', r.service_id, 'modelo', (select modelo from services where id = r.service_id), 'extras', r.extras, 'pet', (select jsonb_build_object('id', p.id, 'nome', p.nome) from pets p where p.id = r.pet_id),
    'cupom', (select code from coupons where id = r.coupon_id),
    'pagamento', (select jsonb_build_object('id', pg.id, 'status', pg.status, 'paid_at', pg.paid_at) from payments pg
                  where pg.request_id = r.id order by pg.criado_em desc limit 1),
    'loja', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
                               'pickup_prepare_min', s.pickup_prepare_min, 'cancel_until_min', s.cancel_until_min),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', ri.nome, 'qty', ri.qty, 'unit_cents', ri.unit_cents, 'product_id', ri.product_id) order by ri.id)
                       from request_items ri where ri.request_id = r.id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.at, 'reason', e.reason) order by e.at)
                         from request_events e where e.request_id = r.id), '[]'::jsonb))
  from stores s where s.id = r.store_id;
$$;

-- O tutor desiste antes de pagar: o pedido nunca chegou à loja, então ela não é avisada.
create or replace function public.pagamento_desistir(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  r := public.pagamento_pedido_valido(p_request);
  update requests set status = 'cancelada', motivo = 'Pagamento não concluído', atualizado_em = now() where id = r.id;
end;
$$;

-- ============================================================
-- Permissões
-- ============================================================
revoke all on function public.cupom_calcular(uuid, text, int, uuid), public.solicitacao_avisar_loja(uuid), public.pagamento_apos_pedido(),
  public.pagamento_pedido_valido(uuid), public.pagamento_registrar(uuid, text, text, text, timestamptz, text),
  public.pagamento_confirmado(text, int, timestamptz), public.pagamentos_expirar(), public.pagamento_json(payments), public.solicitacao_json(requests) from public, anon, authenticated;
grant execute on function public.pagamento_registrar(uuid, text, text, text, timestamptz, text), public.pagamento_confirmado(text, int, timestamptz),
  public.pagamentos_expirar() to service_role;
revoke all on function public.cupom_aplicar(uuid, text, int), public.cupons_para_mim(uuid),
  public.loja_cupom_salvar(uuid, text, text, int, text, int, boolean, timestamptz, int, boolean),
  public.solicitacao_criar(uuid, jsonb, text, text, uuid, text, text), public.pagamento_preparar(uuid), public.pagamento_detalhe(uuid), public.pagamento_desistir(uuid) from public, anon;
grant execute on function public.cupom_aplicar(uuid, text, int), public.cupons_para_mim(uuid),
  public.loja_cupom_salvar(uuid, text, text, int, text, int, boolean, timestamptz, int, boolean),
  public.solicitacao_criar(uuid, jsonb, text, text, uuid, text, text), public.pagamento_preparar(uuid), public.pagamento_detalhe(uuid), public.pagamento_desistir(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-pagamentos-expirar') where exists (select 1 from cron.job where jobname = 'petlive-pagamentos-expirar');
    perform cron.schedule('petlive-pagamentos-expirar', '*/5 * * * *', 'select public.pagamentos_expirar()');
  end if;
end $$;

notify pgrst, 'reload schema';

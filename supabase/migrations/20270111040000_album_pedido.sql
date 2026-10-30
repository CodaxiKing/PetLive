-- Pedido do álbum do ano impresso (BUSINESS.md 5.33; protótipo AlbumPedido).
-- O tutor monta o álbum no app, escolhe o formato, informa o endereço com CEP
-- e paga por Pix (mesma cobrança dos pedidos: payments + create-pix-charge).
-- Preço, frete e prazo vêm de album_formatos, que a equipe ajusta sem versão
-- nova do app. Um pedido esperando o Pix vale por 7 dias; depois expira.

alter table public.addresses add column if not exists cep text check (cep ~ '^[0-9]{8}$');

create table if not exists public.album_formatos (
  id text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  nome text not null check (char_length(nome) between 2 and 60),
  descricao text not null check (char_length(descricao) between 2 and 120),
  -- Preço até 20 páginas; cada bloco de 20 páginas a mais soma extra_20_cents.
  preco_cents int not null check (preco_cents > 0),
  extra_20_cents int not null default 0 check (extra_20_cents >= 0),
  frete_cents int not null default 0 check (frete_cents >= 0),
  prazo_dias_uteis int not null check (prazo_dias_uteis between 1 and 60),
  ordem int not null default 0,
  ativo boolean not null default true
);
alter table public.album_formatos enable row level security;
revoke all on public.album_formatos from public, anon, authenticated;
grant all on public.album_formatos to service_role;
insert into public.album_formatos (id, nome, descricao, preco_cents, extra_20_cents, frete_cents, prazo_dias_uteis, ordem) values
  ('capa_dura_21x28', '21 x 28 cm · capa dura', 'Papel fotográfico, capa dura com o nome do pet', 12900, 2000, 1850, 10, 1),
  ('flexivel_15x21', '15 x 21 cm · capa flexível', 'Mais leve, cabe na bolsa', 7900, 1500, 1450, 8, 2)
on conflict (id) do nothing;

create table if not exists public.album_orders (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete set null,
  pet_nome text not null,
  ano int not null check (ano between 2000 and 2100),
  formato text not null references public.album_formatos (id),
  paginas int not null check (paginas in (20, 40, 60)),
  -- Lembranças escolhidas (chaves da linha do tempo), na ordem do álbum, para a gráfica.
  itens jsonb not null check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) between 1 and 60),
  address_id uuid references public.addresses (id) on delete set null,
  endereco_texto text not null check (char_length(endereco_texto) <= 300),
  cep text not null check (cep ~ '^[0-9]{8}$'),
  preco_cents int not null check (preco_cents > 0),
  frete_cents int not null check (frete_cents >= 0),
  total_cents int not null check (total_cents > 0),
  prazo_dias_uteis int not null,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento', 'pago', 'em_producao', 'enviado', 'entregue', 'cancelado', 'expirado')),
  rastreio text check (char_length(rastreio) <= 60),
  pago_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists album_orders_user on public.album_orders (user_id, criado_em desc);
alter table public.album_orders enable row level security;
revoke all on public.album_orders from public, anon, authenticated;
grant all on public.album_orders to service_role;

alter table public.payments add column if not exists album_order_id uuid references public.album_orders (id) on delete set null;
create unique index if not exists payments_um_por_album on public.payments (album_order_id) where album_order_id is not null and status in ('criando', 'pendente', 'pago');

-- Páginas: uma lembrança por página, em blocos de 20 (20, 40 ou 60).
create or replace function public.album_paginas(p_lembrancas int)
returns int language sql immutable as $$ select greatest(20, least(60, ceil(greatest(p_lembrancas, 1) / 20.0)::int * 20)) $$;

create or replace function public.album_cotacao(f album_formatos, p_paginas int)
returns jsonb language sql stable as $$
  select jsonb_build_object('formato', f.id, 'nome', f.nome, 'descricao', f.descricao, 'paginas', p_paginas,
    'preco_cents', f.preco_cents + (p_paginas / 20 - 1) * f.extra_20_cents, 'frete_cents', f.frete_cents,
    'total_cents', f.preco_cents + (p_paginas / 20 - 1) * f.extra_20_cents + f.frete_cents, 'prazo_dias_uteis', f.prazo_dias_uteis);
$$;

-- Formatos com o preço para esta quantidade de lembranças.
create or replace function public.album_formatos_cotar(p_lembrancas int)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.album_cotacao(f, public.album_paginas(p_lembrancas)) order by f.ordem), '[]'::jsonb)
  from album_formatos f where f.ativo and auth.uid() is not null;
$$;

create or replace function public.album_pedido_criar(p_pet uuid, p_ano int, p_formato text, p_itens jsonb, p_address uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f album_formatos; a addresses; v_pet text; v_pag int; c jsonb; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select nome into v_pet from pets where id = p_pet and tutor_id = auth.uid();
  if v_pet is null then raise exception 'Só quem é dono do pet pede o álbum.' using errcode = '42501'; end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 60 then
    raise exception 'Escolha de 1 a 60 lembranças.' using errcode = '22023';
  end if;
  select * into f from album_formatos where id = p_formato and ativo;
  if f.id is null then raise exception 'Formato indisponível.' using errcode = '22023'; end if;
  select * into a from addresses where id = p_address and user_id = auth.uid();
  if a.id is null then raise exception 'Escolha o endereço de entrega.' using errcode = '22023'; end if;
  if a.cep is null or a.city is null then raise exception 'Complete o endereço com CEP e cidade.' using errcode = '22023', hint = 'endereco'; end if;
  if (select count(*) from album_orders where user_id = auth.uid() and status = 'aguardando_pagamento') >= 3 then
    raise exception 'Você já tem pedidos esperando o Pix. Pague ou cancele um deles.' using errcode = '23514';
  end if;
  v_pag := public.album_paginas(jsonb_array_length(p_itens));
  c := public.album_cotacao(f, v_pag);
  insert into album_orders (user_id, pet_id, pet_nome, ano, formato, paginas, itens, address_id, endereco_texto, cep,
                            preco_cents, frete_cents, total_cents, prazo_dias_uteis)
  values (auth.uid(), p_pet, v_pet, p_ano, f.id, v_pag, p_itens, a.id,
          concat_ws(', ', a.street || coalesce(' ' || a.number, ''), a.complement, a.neighborhood, a.city), a.cep,
          (c->>'preco_cents')::int, (c->>'frete_cents')::int, (c->>'total_cents')::int, f.prazo_dias_uteis)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'total_cents', (c->>'total_cents')::int);
end;
$$;

create or replace function public.album_pedido_json(o album_orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'numero', o.numero, 'status', o.status, 'pet_id', o.pet_id, 'pet_nome', o.pet_nome, 'ano', o.ano,
    'formato', o.formato, 'formato_nome', (select nome from album_formatos where id = o.formato), 'paginas', o.paginas,
    'lembrancas', jsonb_array_length(o.itens), 'endereco', o.endereco_texto, 'cep', o.cep, 'preco_cents', o.preco_cents,
    'frete_cents', o.frete_cents, 'total_cents', o.total_cents, 'prazo_dias_uteis', o.prazo_dias_uteis, 'rastreio', o.rastreio,
    'pago_em', o.pago_em, 'criado_em', o.criado_em,
    'pagamento', (select jsonb_build_object('id', pg.id, 'status', pg.status) from payments pg where pg.album_order_id = o.id order by pg.criado_em desc limit 1));
$$;

create or replace function public.album_pedidos_meus(p_pet uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.album_pedido_json(o) order by o.criado_em desc), '[]'::jsonb)
  from album_orders o where o.user_id = auth.uid() and (p_pet is null or o.pet_id = p_pet) and o.status not in ('cancelado', 'expirado');
$$;

create or replace function public.album_pedido_cancelar(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update album_orders set status = 'cancelado', atualizado_em = now() where id = p_order and user_id = auth.uid() and status = 'aguardando_pagamento';
  if not found then raise exception 'Este pedido não pode mais ser cancelado pelo app.' using errcode = '22023'; end if;
  update payments set status = 'cancelado', atualizado_em = now() where album_order_id = p_order and status in ('criando', 'pendente');
end;
$$;

-- Cobrança Pix do álbum (create-pix-charge). Mesmo formato de pagamento_preparar.
create or replace function public.album_pagamento_preparar(p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o album_orders; pg payments;
begin
  select * into o from album_orders where id = p_order;
  if o.id is null or o.user_id is distinct from auth.uid() then raise exception 'Pedido não encontrado.' using errcode = '42501'; end if;
  if o.status <> 'aguardando_pagamento' then raise exception 'Este pedido não está esperando pagamento.' using errcode = '22023', hint = 'status'; end if;
  select * into pg from payments where album_order_id = o.id and status in ('criando', 'pendente') for update;
  if pg.id is not null and pg.status = 'pendente' and pg.expires_at > now() then return jsonb_build_object('id', pg.id, 'pronto', true); end if;
  if pg.id is not null then update payments set status = 'cancelado', atualizado_em = now() where id = pg.id; end if;
  insert into payments (user_id, album_order_id, amount_cents, descricao)
  values (o.user_id, o.id, o.total_cents, left('Álbum do ano de ' || o.pet_nome || ' · pedido nº ' || o.numero, 200))
  returning * into pg;
  return jsonb_build_object('id', pg.id, 'pronto', false, 'amount_cents', pg.amount_cents, 'descricao', pg.descricao, 'expires_at', pg.expires_at,
    'customer_id', (select customer_id from payment_customers where user_id = o.user_id and provider = 'asaas'));
end;
$$;

-- Confirmação do provedor: agora também marca o álbum como pago.
create or replace function public.pagamento_confirmado(p_provider_id text, p_valor_cents int, p_pago_em timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare pg payments; r requests; o album_orders;
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
  elsif pg.album_order_id is not null then
    select * into o from album_orders where id = pg.album_order_id for update;
    if o.status = 'aguardando_pagamento' then
      update album_orders set status = 'pago', pago_em = coalesce(p_pago_em, now()), atualizado_em = now() where id = o.id;
    else
      update payments set status = 'estorno_pendente', atualizado_em = now() where id = pg.id;
    end if;
  end if;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (pg.user_id, 'pagamento', 'Pagamento confirmado', 'Recebemos R$ ' || public.reais_texto(pg.amount_cents) || ' por Pix.', '/pagamento/' || pg.id);
  return jsonb_build_object('ok', true, 'id', pg.id);
end;
$$;

-- Pix vencido (pedidos da loja) e álbuns esperando o Pix há mais de 7 dias.
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
  update album_orders set status = 'expirado', atualizado_em = now() where status = 'aguardando_pagamento' and criado_em <= now() - interval '7 days';
  return v;
end;
$$;

-- Comprovante: o álbum aparece como destino e item.
create or replace function public.pagamento_json(pg payments)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', pg.id, 'codigo', 'PX-' || pg.codigo, 'status', pg.status, 'amount_cents', pg.amount_cents,
    'descricao', pg.descricao, 'method', pg.method, 'pix_payload', case when pg.status = 'pendente' then pg.pix_payload end,
    'pix_qr', case when pg.status = 'pendente' then pg.pix_qr end, 'expires_at', pg.expires_at, 'paid_at', pg.paid_at, 'criado_em', pg.criado_em,
    'request_id', pg.request_id, 'album_order_id', pg.album_order_id,
    'para', coalesce((select s.name from requests r join stores s on s.id = r.store_id where r.id = pg.request_id),
                     case when pg.album_order_id is not null then 'PetLive · gráfica parceira' end),
    'itens', coalesce((select jsonb_agg(ri.nome || ' × ' || ri.qty order by ri.id) from request_items ri where ri.request_id = pg.request_id),
                      (select jsonb_build_array('Álbum ' || o.ano || ' de ' || o.pet_nome || ' · ' || o.paginas || ' páginas') from album_orders o where o.id = pg.album_order_id),
                      '[]'::jsonb));
$$;

revoke all on function public.album_paginas(int), public.album_cotacao(album_formatos, int), public.album_pedido_json(album_orders),
  public.pagamento_confirmado(text, int, timestamptz), public.pagamentos_expirar(), public.pagamento_json(payments) from public, anon, authenticated;
grant execute on function public.pagamento_confirmado(text, int, timestamptz), public.pagamentos_expirar() to service_role;
revoke all on function public.album_formatos_cotar(int), public.album_pedido_criar(uuid, int, text, jsonb, uuid), public.album_pedidos_meus(uuid),
  public.album_pedido_cancelar(uuid), public.album_pagamento_preparar(uuid) from public, anon;
grant execute on function public.album_formatos_cotar(int), public.album_pedido_criar(uuid, int, text, jsonb, uuid), public.album_pedidos_meus(uuid),
  public.album_pedido_cancelar(uuid), public.album_pagamento_preparar(uuid) to authenticated;

notify pgrst, 'reload schema';

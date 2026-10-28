-- Marketplace, base (BUSINESS.md 5.1 a 5.5, 5.8, 5.10, 20.1 e 21.3 a 21.6;
-- Fase 3). Lojas, equipe, horários, catálogo e solicitações do tutor, com a
-- máquina de estados no banco. Pagamento nesta etapa é só na loja (Etapa 1);
-- Pix pelo app, cupons, chat e entrega integrada vêm depois. A taxa de
-- entrega aqui cobre só o modo "fixa": bairro e distância entram com o motor
-- de frete (supabase/functions/_shared/frete.ts).

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda', 'perdido', 'comunidade', 'pedido'));

-- ============================================================
-- Lojas e equipe
-- ============================================================
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  kind text not null default 'petshop' check (kind in ('petshop', 'clinica', 'banho_tosa', 'creche', 'hotel', 'passeador', 'outro')),
  oferece text not null default 'ambos' check (oferece in ('produtos', 'servicos', 'ambos')),
  status text not null default 'rascunho' check (status in ('rascunho', 'em_analise', 'aprovada', 'correcao_pedida', 'recusada', 'suspensa')),
  is_open boolean not null default true,
  place_id uuid references public.places (id) on delete set null,
  address text check (char_length(address) <= 200),
  neighborhood text check (char_length(neighborhood) <= 80),
  city text check (char_length(city) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  phone text check (char_length(phone) <= 20),
  photo_url text,
  response_deadline_min int not null default 60 check (response_deadline_min between 5 and 1440),
  auto_confirm boolean not null default false,
  cancel_until_min int not null default 120 check (cancel_until_min between 0 and 10080),
  pickup_enabled boolean not null default true,
  pickup_prepare_min int not null default 60 check (pickup_prepare_min between 0 and 1440),
  delivery_enabled boolean not null default false,
  delivery_mode text not null default 'fixa' check (delivery_mode in ('fixa', 'bairro', 'distancia')),
  delivery_fee_cents int not null default 0 check (delivery_fee_cents >= 0),
  delivery_radius_km numeric(5,1) not null default 5 check (delivery_radius_km > 0 and delivery_radius_km <= 50),
  delivery_min_order_cents int not null default 0 check (delivery_min_order_cents >= 0),
  delivery_free_over_cents int check (delivery_free_over_cents is null or delivery_free_over_cents > 0),
  delivery_eta_min int not null default 30 check (delivery_eta_min >= 0),
  delivery_eta_max int not null default 90 check (delivery_eta_max >= delivery_eta_min),
  rating_avg numeric(2,1),
  rating_count int not null default 0,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Para vender produtos, retirada ou entrega precisa estar ligada (5.8).
  constraint stores_venda_com_canal check (oferece = 'servicos' or pickup_enabled or delivery_enabled)
);
create unique index if not exists stores_place on public.stores (place_id) where place_id is not null and status <> 'recusada';
create index if not exists stores_aprovadas on public.stores (status) where status = 'aprovada';
alter table public.stores enable row level security;
revoke all on public.stores from public, anon, authenticated;

create table if not exists public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  funcao text check (funcao in ('atendente', 'tosador', 'passeador', 'veterinario')),
  active boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_members_user on public.store_members (user_id) where active;
alter table public.store_members enable row level security;
revoke all on public.store_members from public, anon, authenticated;

-- Pessoa ativa da equipe da loja, com um dos papéis pedidos (vazio = qualquer papel).
create or replace function public.loja_membro(p_store uuid, p_papeis text[] default '{}')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members m where m.store_id = p_store and m.user_id = auth.uid() and m.active
                 and (cardinality(p_papeis) = 0 or m.role = any (p_papeis)));
$$;

create table if not exists public.store_hours (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null check (closes > opens)
);
create index if not exists store_hours_store on public.store_hours (store_id, weekday);
alter table public.store_hours enable row level security;
revoke all on public.store_hours from public, anon, authenticated;

create table if not exists public.time_off (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text check (char_length(reason) <= 120)
);
create index if not exists time_off_store on public.time_off (store_id, starts_at);
alter table public.time_off enable row level security;
revoke all on public.time_off from public, anon, authenticated;

-- ============================================================
-- Catálogo
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  categoria text not null default 'outros' check (categoria in ('racao', 'petiscos', 'higiene', 'acessorios', 'brinquedos', 'farmacia', 'outros')),
  description text check (char_length(description) <= 1000),
  price_cents int not null check (price_cents >= 0),
  photo_url text,
  barcode text check (char_length(barcode) <= 40),
  -- Tipo de venda (5.2): pelo app, só no local com receita ou oculto.
  venda text not null default 'app' check (venda in ('app', 'local_com_receita', 'oculto')),
  receita_msg text check (char_length(receita_msg) <= 300),
  mostrar_preco boolean not null default true,
  mostrar_estoque boolean not null default false,
  mensagem_tutor text check (char_length(mensagem_tutor) <= 300),
  stock int not null default 0 check (stock >= 0),
  stock_min int not null default 0 check (stock_min >= 0),
  hide_when_zero boolean not null default true,
  active boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists products_store on public.products (store_id, categoria) where active;
alter table public.products enable row level security;
revoke all on public.products from public, anon, authenticated;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  modelo text not null default 'horario' check (modelo in ('horario', 'passeio', 'dia', 'diarias')),
  duration_min int check (duration_min between 5 and 1440),
  capacity int not null default 1 check (capacity between 1 and 200),
  buffer_min int not null default 0 check (buffer_min between 0 and 240),
  price_cents int check (price_cents >= 0),
  active boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists services_store on public.services (store_id) where active;
alter table public.services enable row level security;
revoke all on public.services from public, anon, authenticated;

-- ============================================================
-- Endereços e solicitações
-- ============================================================
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 40),
  street text not null check (char_length(street) between 2 and 160),
  number text check (char_length(number) <= 20),
  complement text check (char_length(complement) <= 80),
  neighborhood text check (char_length(neighborhood) <= 80),
  city text check (char_length(city) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  note text check (char_length(note) <= 200),
  criado_em timestamptz not null default now()
);
alter table public.addresses enable row level security;
revoke all on public.addresses from public, anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
drop policy if exists addresses_dono on public.addresses;
create policy addresses_dono on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  kind text not null default 'produto' check (kind in ('produto', 'servico')),
  status text not null default 'enviada' check (status in ('enviada', 'confirmada', 'recusada', 'expirada', 'cancelada', 'pronta', 'em_entrega', 'em_andamento', 'concluida', 'nao_compareceu')),
  fulfillment text check (fulfillment in ('retirada', 'entrega')),
  starts_at timestamptz,
  ends_at timestamptz,
  pet_id uuid references public.pets (id) on delete set null,
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  delivery_fee_cents int not null default 0 check (delivery_fee_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  pay_method text not null default 'na_loja' check (pay_method in ('pix_app', 'na_loja')),
  message text check (char_length(message) <= 500),
  address_id uuid references public.addresses (id) on delete set null,
  endereco_texto text,
  codigo_entrega text check (codigo_entrega ~ '^[0-9]{4}$'),
  motivo text check (char_length(motivo) <= 300),
  expira_em timestamptz,
  estoque_baixado boolean not null default false,
  responded_at timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists requests_user on public.requests (user_id, criado_em desc);
create index if not exists requests_store on public.requests (store_id, status, criado_em desc);
create index if not exists requests_expirar on public.requests (expira_em) where status = 'enviada';
alter table public.requests enable row level security;
revoke all on public.requests from public, anon, authenticated;

create table if not exists public.request_items (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  nome text not null,
  qty int not null check (qty between 1 and 99),
  unit_cents int not null check (unit_cents >= 0),
  check ((product_id is null) <> (service_id is null) or (product_id is null and service_id is null))
);
create index if not exists request_items_request on public.request_items (request_id);
alter table public.request_items enable row level security;
revoke all on public.request_items from public, anon, authenticated;

create table if not exists public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  reason text,
  at timestamptz not null default now()
);
create index if not exists request_events_request on public.request_events (request_id, at);
alter table public.request_events enable row level security;
revoke all on public.request_events from public, anon, authenticated;

-- Cada mudança de status grava o evento (20).
create or replace function public.request_registrar_evento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into request_events (request_id, from_status, to_status, actor_id, reason)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), new.motivo);
  end if;
  return new;
end;
$$;
drop trigger if exists requests_evento on public.requests;
create trigger requests_evento after insert or update of status on public.requests
  for each row execute function public.request_registrar_evento();

-- ============================================================
-- Vitrine para o tutor
-- ============================================================
create or replace function public.loja_aberta_agora(p_store uuid, p_agora timestamptz default now())
returns boolean language sql stable security definer set search_path = public as $$
  select s.is_open
     and not exists (select 1 from time_off t where t.store_id = s.id and p_agora >= t.starts_at and p_agora < t.ends_at)
     and (not exists (select 1 from store_hours h where h.store_id = s.id)
          or exists (select 1 from store_hours h where h.store_id = s.id
                     and h.weekday = extract(dow from p_agora at time zone 'America/Sao_Paulo')::int
                     and (p_agora at time zone 'America/Sao_Paulo')::time >= h.opens
                     and (p_agora at time zone 'America/Sao_Paulo')::time < h.closes))
  from stores s where s.id = p_store;
$$;

-- Produto que aparece para o tutor (oculto, inativo ou zerado com "esconder" ficam de fora).
create or replace function public.produto_visivel(p products)
returns boolean language sql stable as $$
  select p.active and p.venda <> 'oculto' and not (p.hide_when_zero and p.stock = 0 and p.venda = 'app');
$$;

create or replace function public.produto_json(p products)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'store_id', p.store_id, 'name', p.name, 'categoria', p.categoria, 'description', p.description,
    'price_cents', case when p.mostrar_preco then p.price_cents end, 'photo_url', p.photo_url,
    'venda', p.venda, 'receita_msg', case when p.venda = 'local_com_receita' then p.receita_msg end,
    'mensagem_tutor', p.mensagem_tutor,
    'stock', case when p.mostrar_estoque then p.stock end,
    'disponivel', p.venda = 'app' and p.stock > 0);
$$;

create or replace function public.loja_publica_json(s stores)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'kind', s.kind, 'oferece', s.oferece, 'address', s.address, 'neighborhood', s.neighborhood,
    'city', s.city, 'lat', s.lat, 'lng', s.lng, 'phone', s.phone, 'photo_url', s.photo_url,
    'aberta', public.loja_aberta_agora(s.id), 'rating_avg', s.rating_avg, 'rating_count', s.rating_count,
    'pickup_enabled', s.pickup_enabled, 'pickup_prepare_min', s.pickup_prepare_min,
    'delivery_enabled', s.delivery_enabled and s.delivery_mode = 'fixa', 'delivery_fee_cents', s.delivery_fee_cents,
    'delivery_radius_km', s.delivery_radius_km, 'delivery_min_order_cents', s.delivery_min_order_cents,
    'delivery_free_over_cents', s.delivery_free_over_cents, 'delivery_eta_min', s.delivery_eta_min, 'delivery_eta_max', s.delivery_eta_max,
    'response_deadline_min', s.response_deadline_min, 'cancel_until_min', s.cancel_until_min,
    'horarios', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'), 'closes', to_char(h.closes, 'HH24:MI')) order by h.weekday, h.opens)
                          from store_hours h where h.store_id = s.id), '[]'::jsonb));
$$;

create or replace function public.loja_vitrine(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s stores;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store;
  if s.id is null or (s.status <> 'aprovada' and not public.loja_membro(s.id)) then return jsonb_build_object('disponivel', false); end if;
  return jsonb_build_object('disponivel', true, 'loja', public.loja_publica_json(s),
    'produtos', case when s.oferece = 'servicos' then '[]'::jsonb else coalesce((
      select jsonb_agg(public.produto_json(p) order by p.categoria, p.name) from products p where p.store_id = s.id and public.produto_visivel(p)), '[]'::jsonb) end,
    'servicos', case when s.oferece = 'produtos' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', sv.id, 'name', sv.name, 'description', sv.description, 'modelo', sv.modelo,
                                          'duration_min', sv.duration_min, 'price_cents', sv.price_cents) order by sv.name)
      from services sv where sv.store_id = s.id and sv.active), '[]'::jsonb) end);
end;
$$;

create or replace function public.loja_produto(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p products; s stores;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into p from products where id = p_id;
  select * into s from stores where id = p.store_id;
  if p.id is null or not public.produto_visivel(p) or (s.status <> 'aprovada' and not public.loja_membro(s.id)) then
    return jsonb_build_object('disponivel', false);
  end if;
  return jsonb_build_object('disponivel', true, 'produto', public.produto_json(p), 'loja', public.loja_publica_json(s));
end;
$$;

-- Loja ligada a um lugar do mapa (ficha do lugar mostra "Ver loja").
create or replace function public.loja_do_lugar(p_place uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from stores where place_id = p_place and status = 'aprovada' limit 1;
$$;

create or replace function public.lojas_perto(p_lat double precision, p_lng double precision, p_raio_km double precision default 10)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.d), '[]'::jsonb) from (
    select public.loja_publica_json(s) || jsonb_build_object('distancia_km', round(public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng)::numeric, 1)) as j,
           public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng) as d
    from stores s where s.status = 'aprovada' and s.lat is not null
      and public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng) <= least(greatest(coalesce(p_raio_km, 10), 1), 50)
    order by d limit 50) x;
$$;

-- ============================================================
-- Solicitação de produtos (tutor)
-- ============================================================
create or replace function public.solicitacao_criar(p_store uuid, p_itens jsonb, p_fulfillment text, p_message text default null,
  p_address_id uuid default null, p_pay_method text default 'na_loja')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s stores; a addresses; p products; i jsonb;
  v_id uuid; v_sub int := 0; v_taxa int := 0; v_qtd int; v_status text; v_codigo text; v_end text;
  v_ids uuid[] := '{}';
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store for share;
  if s.id is null or s.status <> 'aprovada' or s.oferece = 'servicos' then raise exception 'Esta loja não está disponível.' using errcode = '22023'; end if;
  if not public.loja_aberta_agora(s.id) then raise exception 'A loja está fechada agora. Tente no horário de atendimento.' using errcode = '22023'; end if;
  if p_pay_method <> 'na_loja' then raise exception 'Por enquanto o pagamento é feito na loja.' using errcode = '22023'; end if;
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
      raise exception 'O pedido mínimo para entrega é de R$ %.', to_char(s.delivery_min_order_cents / 100.0, 'FM999990D00') using errcode = '22023', hint = 'pedido_minimo';
    end if;
    v_taxa := case when s.delivery_free_over_cents is not null and v_sub >= s.delivery_free_over_cents then 0 else s.delivery_fee_cents end;
    v_codigo := lpad((floor(random() * 10000))::int::text, 4, '0');
    v_end := concat_ws(', ', a.street || coalesce(' ' || a.number, ''), a.complement, a.neighborhood, a.city);
  else
    raise exception 'Escolha retirada ou entrega.' using errcode = '22023';
  end if;

  v_status := 'enviada';
  insert into requests (user_id, store_id, kind, status, fulfillment, subtotal_cents, delivery_fee_cents, total_cents, pay_method,
                        message, address_id, endereco_texto, codigo_entrega, expira_em)
  values (auth.uid(), s.id, 'produto', v_status, p_fulfillment, v_sub, v_taxa, v_sub + v_taxa, 'na_loja',
          nullif(left(btrim(coalesce(p_message, '')), 500), ''), a.id, v_end, v_codigo,
          now() + make_interval(mins => s.response_deadline_min))
  returning id into v_id;
  insert into request_items (request_id, product_id, nome, qty, unit_cents)
  select v_id, p2.id, p2.name, (x->>'qty')::int, p2.price_cents
  from jsonb_array_elements(p_itens) x join products p2 on p2.id = (x->>'product_id')::uuid;

  -- Equipe da loja recebe o aviso da solicitação nova.
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Nova solicitação', 'Pedido de R$ ' || to_char((v_sub + v_taxa) / 100.0, 'FM999990D00') || ' para ' || p_fulfillment || '.', '/loja-painel/pedido/' || v_id
  from store_members m where m.store_id = s.id and m.active;

  -- Confirmação automática da loja (5.5).
  if s.auto_confirm then
    perform set_config('petlive.auto_confirmar', v_id::text, true);
    perform public.solicitacao_mudar(v_id, 'confirmada', null, null);
    perform set_config('petlive.auto_confirmar', '', true);
  end if;
  return jsonb_build_object('id', v_id, 'status', (select status from requests where id = v_id), 'total_cents', v_sub + v_taxa);
end;
$$;

-- ============================================================
-- Máquina de estados (20.1)
-- ============================================================
create or replace function public.solicitacao_transicao_valida(p_de text, p_para text)
returns boolean language sql immutable as $$
  select (p_de, p_para) in (
    ('enviada', 'confirmada'), ('enviada', 'recusada'), ('enviada', 'expirada'), ('enviada', 'cancelada'),
    ('confirmada', 'pronta'), ('confirmada', 'em_andamento'), ('confirmada', 'cancelada'), ('confirmada', 'nao_compareceu'),
    ('pronta', 'em_entrega'), ('pronta', 'concluida'), ('pronta', 'cancelada'), ('pronta', 'nao_compareceu'),
    ('em_entrega', 'concluida'), ('em_andamento', 'concluida'));
$$;

create or replace function public.solicitacao_mudar(p_id uuid, p_para text, p_motivo text default null, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r requests; s stores; it record;
  v_loja boolean; v_tutor boolean; v_sistema boolean;
  v_titulo text; v_corpo text;
begin
  select * into r from requests where id = p_id for update;
  if r.id is null then raise exception 'Solicitação não encontrada.' using errcode = '22023'; end if;
  select * into s from stores where id = r.store_id;
  -- Sistema: cron (sem conta) ou a confirmação automática da loja, marcada só dentro de solicitacao_criar.
  v_sistema := (auth.uid() is null and current_user in ('postgres', 'service_role', 'supabase_admin'))
               or coalesce(current_setting('petlive.auto_confirmar', true), '') = p_id::text;
  v_loja := public.loja_membro(r.store_id);
  v_tutor := r.user_id = auth.uid();
  if not (v_loja or v_tutor or v_sistema) then raise exception 'Você não pode mudar esta solicitação.' using errcode = '42501'; end if;
  if not public.solicitacao_transicao_valida(r.status, p_para) then
    raise exception 'Não dá para passar de % para %.', r.status, p_para using errcode = '22023', hint = 'transicao';
  end if;

  -- Quem pode cada passo.
  if p_para = 'cancelada' then
    if v_tutor and not v_loja and r.status <> 'enviada'
       and r.starts_at is not null and now() > r.starts_at - make_interval(mins => s.cancel_until_min) then
      raise exception 'O prazo para cancelar sem custo já passou. Fale com a loja.' using errcode = '22023';
    end if;
    if v_tutor and not v_loja and r.status = 'pronta' then raise exception 'O pedido já está pronto. Fale com a loja.' using errcode = '22023'; end if;
  elsif p_para = 'expirada' then
    if not v_sistema then raise exception 'Só o sistema expira solicitações.' using errcode = '42501'; end if;
  elsif not v_loja and not (v_sistema and p_para = 'confirmada') then
    raise exception 'Só a loja faz este passo.' using errcode = '42501';
  end if;
  if p_para in ('recusada', 'nao_compareceu') and char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo: o tutor vê no app.' using errcode = '22023';
  end if;
  if p_para = 'em_entrega' and r.fulfillment <> 'entrega' then raise exception 'Este pedido é para retirada.' using errcode = '22023'; end if;
  if r.status = 'pronta' and p_para = 'concluida' and r.fulfillment = 'entrega' then raise exception 'Pedido de entrega: marque Saiu para entrega.' using errcode = '22023'; end if;
  if r.status = 'em_entrega' and p_para = 'concluida' and coalesce(p_codigo, '') <> r.codigo_entrega then
    raise exception 'Código de entrega incorreto. Peça o código de 4 dígitos ao tutor.' using errcode = '22023', hint = 'codigo';
  end if;

  -- Estoque (5.10): baixa ao confirmar, nunca negativo; cancelamento devolve.
  if p_para = 'confirmada' and r.kind = 'produto' and not r.estoque_baixado then
    for it in select ri.product_id, ri.qty, ri.nome from request_items ri where ri.request_id = r.id and ri.product_id is not null loop
      update products set stock = stock - it.qty, atualizado_em = now() where id = it.product_id and stock >= it.qty;
      if not found then raise exception 'Sem estoque de % para confirmar.', it.nome using errcode = '22023', hint = 'estoque'; end if;
    end loop;
    r.estoque_baixado := true;
  elsif p_para in ('cancelada', 'nao_compareceu') and r.estoque_baixado then
    update products pr set stock = pr.stock + ri.qty, atualizado_em = now()
    from request_items ri where ri.request_id = r.id and ri.product_id = pr.id;
    r.estoque_baixado := false;
  end if;

  update requests set status = p_para, motivo = nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), estoque_baixado = r.estoque_baixado,
    responded_at = case when r.status = 'enviada' and p_para in ('confirmada', 'recusada') then now() else responded_at end,
    atualizado_em = now()
  where id = r.id;

  -- Aviso ao tutor (e à loja quando o tutor cancela).
  v_titulo := case p_para
    when 'confirmada' then 'Solicitação confirmada'
    when 'recusada' then 'Solicitação recusada'
    when 'expirada' then 'A loja não respondeu'
    when 'pronta' then 'Pronto para retirar'
    when 'em_entrega' then 'Saiu para entrega'
    when 'concluida' then 'Pedido concluído'
    when 'cancelada' then 'Solicitação cancelada'
    when 'nao_compareceu' then 'Pedido não retirado'
    when 'em_andamento' then 'Atendimento começou' end;
  v_corpo := case p_para
    when 'confirmada' then s.name || ' confirmou seu pedido.'
    when 'recusada' then s.name || ' recusou: ' || coalesce(btrim(p_motivo), '')
    when 'expirada' then s.name || ' não respondeu no prazo. Tente outra loja.'
    when 'pronta' then 'Seu pedido está pronto em ' || s.name || '.'
    when 'em_entrega' then 'Seu pedido saiu de ' || s.name || '. Código de entrega: ' || r.codigo_entrega || '.'
    when 'concluida' then 'Obrigado por comprar em ' || s.name || '. Avalie quando puder.'
    when 'cancelada' then 'O pedido em ' || s.name || ' foi cancelado.'
    when 'nao_compareceu' then s.name || ': ' || coalesce(btrim(p_motivo), '')
    when 'em_andamento' then s.name || ' começou o atendimento.' end;
  if not v_tutor or v_loja or v_sistema then
    insert into notification_log (user_id, type, title, body, deep_link) values (r.user_id, 'pedido', v_titulo, v_corpo, '/pedidos/' || r.id);
  end if;
  if v_tutor and not v_loja and p_para = 'cancelada' then
    insert into notification_log (user_id, type, title, body, deep_link)
    select m.user_id, 'pedido', 'Solicitação cancelada pelo tutor', 'O pedido nº ' || r.numero || ' foi cancelado.', '/loja-painel/pedido/' || r.id
    from store_members m where m.store_id = r.store_id and m.active;
  end if;
  return jsonb_build_object('id', r.id, 'status', p_para);
end;
$$;

-- Sem resposta no prazo: expira e avisa o tutor (cron a cada 5 minutos).
create or replace function public.solicitacoes_expirar()
returns int language plpgsql security definer set search_path = public as $$
declare v_id uuid; v int := 0;
begin
  for v_id in select id from requests where status = 'enviada' and expira_em <= now() order by expira_em limit 500 loop
    perform public.solicitacao_mudar(v_id, 'expirada', 'Sem resposta da loja no prazo', null);
    v := v + 1;
  end loop;
  return v;
end;
$$;

-- ============================================================
-- Leitura do tutor
-- ============================================================
create or replace function public.solicitacao_json(r requests)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'numero', r.numero, 'status', r.status, 'kind', r.kind, 'fulfillment', r.fulfillment,
    'subtotal_cents', r.subtotal_cents, 'delivery_fee_cents', r.delivery_fee_cents, 'discount_cents', r.discount_cents, 'total_cents', r.total_cents,
    'pay_method', r.pay_method, 'message', r.message, 'motivo', r.motivo, 'endereco', r.endereco_texto,
    'codigo_entrega', case when r.user_id = auth.uid() and r.fulfillment = 'entrega' and r.status in ('confirmada', 'pronta', 'em_entrega') then r.codigo_entrega end,
    'expira_em', r.expira_em, 'criado_em', r.criado_em, 'starts_at', r.starts_at,
    'loja', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
                               'pickup_prepare_min', s.pickup_prepare_min, 'cancel_until_min', s.cancel_until_min),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', ri.nome, 'qty', ri.qty, 'unit_cents', ri.unit_cents, 'product_id', ri.product_id) order by ri.id)
                       from request_items ri where ri.request_id = r.id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.at, 'reason', e.reason) order by e.at)
                         from request_events e where e.request_id = r.id), '[]'::jsonb))
  from stores s where s.id = r.store_id;
$$;

create or replace function public.minhas_solicitacoes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.solicitacao_json(r) order by r.criado_em desc), '[]'::jsonb)
  from (select * from requests where user_id = auth.uid() order by criado_em desc limit 100) r;
$$;

create or replace function public.solicitacao_detalhe(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_id;
  if r.id is null or not (r.user_id = auth.uid() or public.loja_membro(r.store_id)) then return jsonb_build_object('disponivel', false); end if;
  return jsonb_build_object('disponivel', true, 'solicitacao', public.solicitacao_json(r));
end;
$$;

-- ============================================================
-- Permissões
-- ============================================================
revoke all on function public.loja_membro(uuid, text[]), public.request_registrar_evento(), public.produto_json(products),
  public.loja_publica_json(stores), public.solicitacoes_expirar(), public.solicitacao_json(requests) from public, anon, authenticated;
grant execute on function public.loja_membro(uuid, text[]) to authenticated;
revoke all on function public.loja_aberta_agora(uuid, timestamptz), public.loja_vitrine(uuid), public.loja_produto(uuid), public.loja_do_lugar(uuid),
  public.lojas_perto(double precision, double precision, double precision),
  public.solicitacao_criar(uuid, jsonb, text, text, uuid, text), public.solicitacao_mudar(uuid, text, text, text),
  public.minhas_solicitacoes(), public.solicitacao_detalhe(uuid) from public, anon;
grant execute on function public.loja_aberta_agora(uuid, timestamptz), public.loja_vitrine(uuid), public.loja_produto(uuid), public.loja_do_lugar(uuid),
  public.lojas_perto(double precision, double precision, double precision),
  public.solicitacao_criar(uuid, jsonb, text, text, uuid, text), public.solicitacao_mudar(uuid, text, text, text),
  public.minhas_solicitacoes(), public.solicitacao_detalhe(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-solicitacoes-expirar') where exists (select 1 from cron.job where jobname = 'petlive-solicitacoes-expirar');
    perform cron.schedule('petlive-solicitacoes-expirar', '*/5 * * * *', 'select public.solicitacoes_expirar()');
  end if;
end $$;

-- Avisos de pedido também vão por push (tutor e equipe da loja).
create or replace function public.aviso_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not (new.type in ('perdido', 'pedido') or (new.type = 'guarda' and new.pet_id is null)) then return new; end if;
  for v_token in select token from push_tokens where tutor_id = new.user_id and ativo loop
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', v_token, 'title', new.title, 'body', new.body, 'sound', 'default',
          'priority', case when new.type in ('perdido', 'pedido') then 'high' else 'default' end,
          'data', jsonb_build_object('tipo', new.type, 'url', coalesce(new.deep_link, '/avisos/caixa'), 'aviso_id', new.id)
        ),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      -- Sem push (pg_net fora do ar), o aviso continua na Caixa.
      null;
    end;
  end loop;
  return new;
end;
$$;
revoke all on function public.aviso_push() from public, anon, authenticated;

drop trigger if exists notification_log_push_perdido_guarda on public.notification_log;
create trigger notification_log_push_perdido_guarda
  after insert on public.notification_log
  for each row when (new.type in ('perdido', 'guarda', 'pedido'))
  execute function public.aviso_push();

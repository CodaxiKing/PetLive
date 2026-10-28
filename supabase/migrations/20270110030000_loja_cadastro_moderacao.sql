-- Cadastro e publicação da loja (BUSINESS.md 20.5 e 19.14), assumir o lugar do
-- mapa com verificação do dono (5.15) e moderação de anúncios e denúncias.
-- rascunho → em_analise → (aprovada | correcao_pedida | recusada); aprovada
-- pode ser suspensa e reativada pelo admin. O lugar do mapa só fica ligado à
-- loja quando o admin confere que quem cadastrou é o dono.

alter table public.stores add column if not exists documento text check (documento ~ '^([0-9]{11}|[0-9]{14})$');
alter table public.stores add column if not exists responsavel text check (char_length(responsavel) <= 120);
alter table public.stores add column if not exists motivo_status text check (char_length(motivo_status) <= 500);
alter table public.stores add column if not exists enviada_em timestamptz;
alter table public.stores add column if not exists decidida_em timestamptz;

-- CPF (11) ou CNPJ (14) com dígitos verificadores válidos.
create or replace function public.documento_valido(p text)
returns boolean language plpgsql immutable as $$
declare d int[]; s int; r int; i int; pesos1 int[]; pesos2 int[];
begin
  if p is null or p !~ '^([0-9]{11}|[0-9]{14})$' or p ~ '^(\d)\1+$' then return false; end if;
  d := (select array_agg(substr(p, n, 1)::int order by n) from generate_series(1, length(p)) n);
  if length(p) = 11 then
    s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> d[10] then return false; end if;
    s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if; return r = d[11];
  end if;
  pesos1 := array[5,4,3,2,9,8,7,6,5,4,3,2]; pesos2 := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s := 0; for i in 1..12 loop s := s + d[i] * pesos1[i]; end loop;
  r := case when s % 11 < 2 then 0 else 11 - s % 11 end; if r <> d[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + d[i] * pesos2[i]; end loop;
  r := case when s % 11 < 2 then 0 else 11 - s % 11 end; return r = d[14];
end;
$$;

create table if not exists public.store_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  tipo text not null check (tipo in ('cnpj', 'documento_responsavel', 'comprovante_endereco', 'alvara', 'crmv', 'outro')),
  path text not null,
  status text not null default 'enviado' check (status in ('enviado', 'aceito', 'recusado')),
  criado_em timestamptz not null default now()
);
create index if not exists store_documents_store on public.store_documents (store_id);
alter table public.store_documents enable row level security;
revoke all on public.store_documents from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lojas-docs', 'lojas-docs', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;
-- Pasta = id da loja; só a equipe (dono e gerente) envia e lê; o admin lê.
drop policy if exists "lojas-docs: equipe envia" on storage.objects;
create policy "lojas-docs: equipe envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'lojas-docs' and public.loja_membro(((storage.foldername(name))[1])::uuid, array['owner', 'manager']));
drop policy if exists "lojas-docs: equipe e admin leem" on storage.objects;
create policy "lojas-docs: equipe e admin leem" on storage.objects for select to authenticated
  using (bucket_id = 'lojas-docs' and (public.loja_membro(((storage.foldername(name))[1])::uuid, array['owner', 'manager']) or public.admin_papel() is not null));

create table if not exists public.store_place_claims (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  observacao text check (char_length(observacao) <= 300),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create unique index if not exists store_place_claims_pendente on public.store_place_claims (place_id) where status = 'pendente';
alter table public.store_place_claims enable row level security;
revoke all on public.store_place_claims from public, anon, authenticated;

-- ============================================================
-- Lado da loja (usado pelo app e pelo painel do lojista)
-- ============================================================
create or replace function public.loja_criar(p_nome text, p_kind text, p_oferece text, p_documento text, p_responsavel text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_doc text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome da loja.' using errcode = '22023'; end if;
  if not public.documento_valido(v_doc) then raise exception 'CNPJ ou CPF inválido.' using errcode = '22023'; end if;
  if (select count(*) from store_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'Limite de lojas por conta atingido. Fale com o suporte.' using errcode = '23514';
  end if;
  insert into stores (name, kind, oferece, documento, responsavel, status, criado_por)
  values (btrim(p_nome), coalesce(p_kind, 'petshop'), coalesce(p_oferece, 'ambos'), v_doc, nullif(btrim(coalesce(p_responsavel, '')), ''), 'rascunho', auth.uid())
  returning id into v_id;
  insert into store_members (store_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

-- Atualiza os campos que a loja controla (nunca status, nota ou lugar do mapa).
create or replace function public.loja_atualizar(p_store uuid, p_campos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_permitidos text[] := array['name', 'kind', 'oferece', 'address', 'neighborhood', 'city', 'lat', 'lng', 'phone', 'photo_url', 'responsavel',
  'is_open', 'response_deadline_min', 'auto_confirm', 'cancel_until_min', 'pickup_enabled', 'pickup_prepare_min', 'delivery_enabled', 'delivery_mode',
  'delivery_fee_cents', 'delivery_radius_km', 'delivery_min_order_cents', 'delivery_free_over_cents', 'delivery_eta_min', 'delivery_eta_max'];
  k text;
begin
  if not public.loja_membro(p_store, array['owner', 'manager']) then raise exception 'Só o dono ou o gerente muda a loja.' using errcode = '42501'; end if;
  for k in select jsonb_object_keys(coalesce(p_campos, '{}'::jsonb)) loop
    if not k = any (v_permitidos) then raise exception 'Campo não editável: %', k using errcode = '22023'; end if;
  end loop;
  update stores s set
    name = coalesce(nullif(btrim(p_campos->>'name'), ''), s.name),
    kind = coalesce(p_campos->>'kind', s.kind),
    oferece = coalesce(p_campos->>'oferece', s.oferece),
    address = case when p_campos ? 'address' then nullif(btrim(p_campos->>'address'), '') else s.address end,
    neighborhood = case when p_campos ? 'neighborhood' then nullif(btrim(p_campos->>'neighborhood'), '') else s.neighborhood end,
    city = case when p_campos ? 'city' then nullif(btrim(p_campos->>'city'), '') else s.city end,
    lat = case when p_campos ? 'lat' then (p_campos->>'lat')::double precision else s.lat end,
    lng = case when p_campos ? 'lng' then (p_campos->>'lng')::double precision else s.lng end,
    phone = case when p_campos ? 'phone' then nullif(regexp_replace(p_campos->>'phone', '\D', '', 'g'), '') else s.phone end,
    photo_url = case when p_campos ? 'photo_url' then p_campos->>'photo_url' else s.photo_url end,
    responsavel = case when p_campos ? 'responsavel' then nullif(btrim(p_campos->>'responsavel'), '') else s.responsavel end,
    is_open = coalesce((p_campos->>'is_open')::boolean, s.is_open),
    response_deadline_min = coalesce((p_campos->>'response_deadline_min')::int, s.response_deadline_min),
    auto_confirm = coalesce((p_campos->>'auto_confirm')::boolean, s.auto_confirm),
    cancel_until_min = coalesce((p_campos->>'cancel_until_min')::int, s.cancel_until_min),
    pickup_enabled = coalesce((p_campos->>'pickup_enabled')::boolean, s.pickup_enabled),
    pickup_prepare_min = coalesce((p_campos->>'pickup_prepare_min')::int, s.pickup_prepare_min),
    delivery_enabled = coalesce((p_campos->>'delivery_enabled')::boolean, s.delivery_enabled),
    delivery_mode = coalesce(p_campos->>'delivery_mode', s.delivery_mode),
    delivery_fee_cents = coalesce((p_campos->>'delivery_fee_cents')::int, s.delivery_fee_cents),
    delivery_radius_km = coalesce((p_campos->>'delivery_radius_km')::numeric, s.delivery_radius_km),
    delivery_min_order_cents = coalesce((p_campos->>'delivery_min_order_cents')::int, s.delivery_min_order_cents),
    delivery_free_over_cents = case when p_campos ? 'delivery_free_over_cents' then (p_campos->>'delivery_free_over_cents')::int else s.delivery_free_over_cents end,
    delivery_eta_min = coalesce((p_campos->>'delivery_eta_min')::int, s.delivery_eta_min),
    delivery_eta_max = coalesce((p_campos->>'delivery_eta_max')::int, s.delivery_eta_max),
    atualizado_em = now()
  where s.id = p_store;
end;
$$;

create or replace function public.loja_documento_registrar(p_store uuid, p_tipo text, p_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.loja_membro(p_store, array['owner', 'manager']) then raise exception 'Só o dono ou o gerente envia documentos.' using errcode = '42501'; end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> p_store::text then raise exception 'Arquivo inválido.' using errcode = '22023'; end if;
  insert into store_documents (store_id, tipo, path) values (p_store, p_tipo, p_path) returning id into v_id;
  return v_id;
end;
$$;

-- O que falta para enviar à análise (checklist do passo 5).
create or replace function public.loja_checklist(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s stores;
begin
  if not public.loja_membro(p_store) then raise exception 'Loja não disponível.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store;
  return jsonb_build_object(
    'dados', s.name is not null and public.documento_valido(s.documento),
    'endereco', s.address is not null and s.lat is not null and s.lng is not null,
    'contato', s.phone is not null,
    'documentos', exists (select 1 from store_documents d where d.store_id = s.id and d.status <> 'recusado'),
    'catalogo', exists (select 1 from products p where p.store_id = s.id and p.active and p.venda <> 'oculto')
                or exists (select 1 from services v where v.store_id = s.id and v.active),
    'horarios', exists (select 1 from store_hours h where h.store_id = s.id),
    'canal', s.oferece = 'servicos' or s.pickup_enabled or s.delivery_enabled);
end;
$$;

create or replace function public.loja_enviar_analise(p_store uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s stores; c jsonb; k text;
begin
  if not public.loja_membro(p_store, array['owner']) then raise exception 'Só o dono envia a loja para análise.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store for update;
  if s.status not in ('rascunho', 'correcao_pedida') then raise exception 'A loja já foi enviada.' using errcode = '22023'; end if;
  c := public.loja_checklist(p_store);
  for k in select key from jsonb_each(c) where value = 'false'::jsonb loop
    raise exception 'Falta completar: %', k using errcode = '22023', hint = k;
  end loop;
  update stores set status = 'em_analise', enviada_em = now(), motivo_status = null, atualizado_em = now() where id = p_store;
end;
$$;

-- Pedir para assumir o lugar do mapa: fica pendente até o admin conferir o dono.
create or replace function public.loja_assumir_lugar(p_store uuid, p_place uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.loja_membro(p_store, array['owner']) then raise exception 'Só o dono da loja pede o lugar.' using errcode = '42501'; end if;
  if not exists (select 1 from places where id = p_place) then raise exception 'Lugar não encontrado.' using errcode = '22023'; end if;
  if exists (select 1 from stores where place_id = p_place and id <> p_store and status <> 'recusada') then
    raise exception 'Este lugar já foi assumido por outra loja. Fale com o suporte se for o dono.' using errcode = '23505';
  end if;
  if exists (select 1 from store_place_claims where place_id = p_place and status = 'pendente' and store_id <> p_store) then
    raise exception 'Já existe um pedido para este lugar em análise.' using errcode = '23505';
  end if;
  update store_place_claims set status = 'recusado', observacao = 'Substituído por novo pedido', decidido_em = now()
  where store_id = p_store and status = 'pendente';
  insert into store_place_claims (store_id, place_id) values (p_store, p_place) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.minhas_lojas()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'status', s.status, 'motivo_status', s.motivo_status,
                                               'role', m.role, 'checklist', public.loja_checklist(s.id),
                                               'lugar_pendente', exists (select 1 from store_place_claims c where c.store_id = s.id and c.status = 'pendente'))
                    order by s.criado_em), '[]'::jsonb)
  from store_members m join stores s on s.id = m.store_id where m.user_id = auth.uid() and m.active;
$$;

-- ============================================================
-- Denúncias de produto, avaliação ou loja (tutor)
-- ============================================================
create table if not exists public.store_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('produto', 'avaliacao', 'loja')),
  target_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 300),
  status text not null default 'aberta' check (status in ('aberta', 'mantido', 'removido')),
  handled_by uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (kind, target_id, reporter_id)
);
alter table public.store_reports enable row level security;
revoke all on public.store_reports from public, anon, authenticated;
alter table public.products add column if not exists bloqueado_admin boolean not null default false;

-- Produto bloqueado pela moderação não aparece, mesmo ativo.
create or replace function public.produto_visivel(p products)
returns boolean language sql stable as $$
  select p.active and not p.bloqueado_admin and p.venda <> 'oculto' and not (p.hide_when_zero and p.stock = 0 and p.venda = 'app');
$$;

create or replace function public.loja_denunciar(p_kind text, p_target uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_store uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  v_store := case p_kind
    when 'produto' then (select store_id from products where id = p_target)
    when 'avaliacao' then (select store_id from reviews where id = p_target)
    when 'loja' then (select id from stores where id = p_target) end;
  if v_store is null then raise exception 'Conteúdo não encontrado.' using errcode = '22023'; end if;
  insert into store_reports (kind, target_id, store_id, reporter_id, reason)
  values (p_kind, p_target, v_store, auth.uid(), left(btrim(coalesce(nullif(btrim(p_motivo), ''), 'Sem motivo')), 300))
  on conflict (kind, target_id, reporter_id) do nothing;
end;
$$;

-- ============================================================
-- Admin: fila de lojas e moderação
-- ============================================================
create or replace function public.admin_lojas(p_status text default 'em_analise')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['moderacao', 'suporte', 'leitura']);
  return jsonb_build_object(
    'contagem', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from stores group by status) x),
    'lojas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'kind', s.kind, 'oferece', s.oferece, 'status', s.status, 'documento', s.documento, 'responsavel', s.responsavel,
        'address', s.address, 'city', s.city, 'phone', s.phone, 'lat', s.lat, 'lng', s.lng, 'motivo_status', s.motivo_status,
        'enviada_em', s.enviada_em, 'criado_em', s.criado_em,
        'dono', (select coalesce(p.nome, split_part(u.email, '@', 1)) from store_members m join auth.users u on u.id = m.user_id left join profiles p on p.id = m.user_id
                 where m.store_id = s.id and m.role = 'owner' limit 1),
        'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'path', d.path, 'status', d.status) order by d.criado_em)
                                from store_documents d where d.store_id = s.id), '[]'::jsonb),
        'produtos', (select count(*) from products p where p.store_id = s.id and p.active),
        'servicos', (select count(*) from services v where v.store_id = s.id and v.active),
        'lugar', (select jsonb_build_object('claim_id', c.id, 'place_id', pl.id, 'nome', pl.nome, 'endereco', pl.endereco, 'telefone', pl.telefone, 'status', c.status)
                  from store_place_claims c join places pl on pl.id = c.place_id where c.store_id = s.id order by c.criado_em desc limit 1)
      ) order by s.enviada_em nulls last, s.criado_em)
      from stores s where p_status = 'todas' or s.status = p_status), '[]'::jsonb));
end;
$$;

create or replace function public.admin_loja_decidir(p_store uuid, p_acao text, p_motivo text default null, p_lugar_ok boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare s stores; v_novo text; c store_place_claims; v_titulo text; v_corpo text;
begin
  perform public.admin_exigir(array['moderacao']);
  select * into s from stores where id = p_store for update;
  if s.id is null then raise exception 'Loja não encontrada.'; end if;
  v_novo := case p_acao
    when 'aprovar' then case when s.status in ('em_analise') then 'aprovada' end
    when 'correcao' then case when s.status = 'em_analise' then 'correcao_pedida' end
    when 'recusar' then case when s.status in ('em_analise', 'correcao_pedida') then 'recusada' end
    when 'suspender' then case when s.status = 'aprovada' then 'suspensa' end
    when 'reativar' then case when s.status = 'suspensa' then 'aprovada' end end;
  if v_novo is null then raise exception 'Ação % não vale para loja %.', p_acao, s.status; end if;
  if p_acao in ('correcao', 'recusar', 'suspender') and char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo: o lojista vê.';
  end if;
  update stores set status = v_novo, motivo_status = nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), decidida_em = now(), atualizado_em = now() where id = s.id;

  -- Lugar do mapa: liga só com o dono conferido.
  select * into c from store_place_claims where store_id = s.id and status = 'pendente' order by criado_em desc limit 1;
  if c.id is not null and p_lugar_ok is not null and p_acao in ('aprovar', 'reativar') then
    update store_place_claims set status = case when p_lugar_ok then 'aprovado' else 'recusado' end, decidido_em = now() where id = c.id;
    if p_lugar_ok then update stores set place_id = c.place_id where id = s.id; end if;
  end if;
  -- Loja suspensa some da vitrine; solicitações já confirmadas continuam com a loja.

  v_titulo := case v_novo when 'aprovada' then 'Loja publicada' when 'correcao_pedida' then 'Ajuste no cadastro da loja'
    when 'recusada' then 'Cadastro da loja recusado' when 'suspensa' then 'Loja suspensa' end;
  v_corpo := case v_novo when 'aprovada' then s.name || ' já aparece para os tutores no PetLive.'
    else s.name || ': ' || btrim(p_motivo) end;
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'sistema', v_titulo, v_corpo, '/loja-painel' from store_members m where m.store_id = s.id and m.role in ('owner', 'manager') and m.active;
  perform public.admin_registrar('loja: ' || p_acao, 'stores', s.id::text, jsonb_build_object('motivo', p_motivo, 'lugar_ok', p_lugar_ok));
end;
$$;

create or replace function public.admin_loja_denuncias()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['moderacao', 'suporte', 'leitura']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'kind', x.kind, 'target_id', x.target_id, 'loja', s.name, 'store_id', s.id, 'denuncias', x.total, 'motivos', x.motivos, 'ultima', x.ultima,
      'resumo', case x.kind when 'produto' then (select name || coalesce(' · ' || description, '') from products where id = x.target_id)
                            when 'avaliacao' then (select rating || '★ ' || coalesce(text, '') from reviews where id = x.target_id)
                            else s.name end
    ) order by x.total desc, x.ultima desc)
    from (select kind, target_id, store_id, count(*) total, jsonb_agg(distinct reason) motivos, max(criado_em) ultima
          from store_reports where status = 'aberta' group by kind, target_id, store_id) x join stores s on s.id = x.store_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_loja_denuncia_decidir(p_kind text, p_target uuid, p_remover boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_store uuid;
begin
  perform public.admin_exigir(array['moderacao']);
  if p_remover then
    if p_kind = 'produto' then update products set bloqueado_admin = true where id = p_target returning store_id into v_store;
    elsif p_kind = 'avaliacao' then
      update reviews set hidden = true where id = p_target returning store_id into v_store;
      perform public.loja_recalcular_nota(v_store);
    elsif p_kind = 'loja' then
      update stores set status = 'suspensa', motivo_status = 'Suspensa pela moderação após denúncias.', decidida_em = now() where id = p_target and status = 'aprovada';
    end if;
  end if;
  update store_reports set status = case when p_remover then 'removido' else 'mantido' end, handled_by = auth.uid()
  where kind = p_kind and target_id = p_target and status = 'aberta';
  perform public.admin_registrar(case when p_remover then 'removeu ' else 'manteve ' end || p_kind || ' denunciado', 'store_reports', p_target::text, '{}'::jsonb);
end;
$$;

revoke all on function public.loja_criar(text, text, text, text, text), public.loja_atualizar(uuid, jsonb), public.loja_documento_registrar(uuid, text, text),
  public.loja_checklist(uuid), public.loja_enviar_analise(uuid), public.loja_assumir_lugar(uuid, uuid), public.minhas_lojas(),
  public.loja_denunciar(text, uuid, text), public.admin_lojas(text), public.admin_loja_decidir(uuid, text, text, boolean),
  public.admin_loja_denuncias(), public.admin_loja_denuncia_decidir(text, uuid, boolean) from public, anon;
grant execute on function public.loja_criar(text, text, text, text, text), public.loja_atualizar(uuid, jsonb), public.loja_documento_registrar(uuid, text, text),
  public.loja_checklist(uuid), public.loja_enviar_analise(uuid), public.loja_assumir_lugar(uuid, uuid), public.minhas_lojas(),
  public.loja_denunciar(text, uuid, text), public.admin_lojas(text), public.admin_loja_decidir(uuid, text, text, boolean),
  public.admin_loja_denuncias(), public.admin_loja_denuncia_decidir(text, uuid, boolean) to authenticated;

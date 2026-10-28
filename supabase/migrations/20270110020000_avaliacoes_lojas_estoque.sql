-- Avaliações das lojas (BUSINESS.md 5.11) e aviso de estoque baixo (5.10).
-- Só quem teve a solicitação concluída avalia, uma vez por pedido; a nota da
-- loja é a média dos últimos 12 meses. A loja responde uma vez, em público.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}' check (tags <@ array['atendimento', 'pontualidade', 'preco', 'cuidado', 'limpeza']),
  text text check (char_length(text) <= 600),
  photo_path text,
  reply_text text check (char_length(reply_text) <= 600),
  replied_at timestamptz,
  hidden boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists reviews_store on public.reviews (store_id, criado_em desc) where not hidden;
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;

-- Fotos das avaliações: cada conta envia na própria pasta; quem tem conta lê.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avaliacoes', 'avaliacoes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "avaliacoes: enviar própria foto" on storage.objects;
create policy "avaliacoes: enviar própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avaliacoes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avaliacoes: ler foto visível" on storage.objects;
create policy "avaliacoes: ler foto visível" on storage.objects for select to authenticated
  using (bucket_id = 'avaliacoes' and exists (select 1 from public.reviews r where r.photo_path = name and not r.hidden));

-- Recalcula a nota da loja (últimos 12 meses, sem as escondidas).
create or replace function public.loja_recalcular_nota(p_store uuid)
returns void language sql security definer set search_path = public as $$
  update stores s set
    rating_avg = (select round(avg(rating)::numeric, 1) from reviews where store_id = p_store and not hidden and criado_em > now() - interval '12 months'),
    rating_count = (select count(*) from reviews where store_id = p_store and not hidden and criado_em > now() - interval '12 months')
  where s.id = p_store;
$$;

create or replace function public.avaliacao_enviar(p_request uuid, p_nota int, p_tags text[] default '{}', p_texto text default null, p_foto_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r requests; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into r from requests where id = p_request;
  if r.id is null or r.user_id <> auth.uid() then raise exception 'Pedido não encontrado.' using errcode = '42501'; end if;
  if r.status <> 'concluida' then raise exception 'Só dá para avaliar depois que o pedido for concluído.' using errcode = '22023'; end if;
  if p_nota is null or p_nota not between 1 and 5 then raise exception 'Escolha de 1 a 5 estrelas.' using errcode = '22023'; end if;
  if p_foto_path is not null and split_part(p_foto_path, '/', 1) <> auth.uid()::text then raise exception 'Foto inválida.' using errcode = '22023'; end if;
  if exists (select 1 from reviews where request_id = r.id) then raise exception 'Você já avaliou este pedido.' using errcode = '23505'; end if;
  insert into reviews (request_id, store_id, user_id, rating, tags, text, photo_path)
  values (r.id, r.store_id, auth.uid(), p_nota, coalesce(p_tags, '{}'), nullif(left(btrim(coalesce(p_texto, '')), 600), ''), p_foto_path)
  returning id into v_id;
  perform public.loja_recalcular_nota(r.store_id);
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'pedido', 'Nova avaliação', p_nota || ' estrela(s) no pedido nº ' || r.numero || '.', '/loja-painel/avaliacoes'
  from store_members m where m.store_id = r.store_id and m.active;
  return v_id;
end;
$$;

-- A loja responde uma vez, em público.
create or replace function public.avaliacao_responder(p_review uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare rv reviews;
begin
  select * into rv from reviews where id = p_review;
  if rv.id is null or not public.loja_membro(rv.store_id, array['owner', 'manager']) then raise exception 'Só a loja responde.' using errcode = '42501'; end if;
  if rv.reply_text is not null then raise exception 'A loja já respondeu esta avaliação.' using errcode = '23505'; end if;
  if char_length(btrim(coalesce(p_texto, ''))) < 2 then raise exception 'Escreva a resposta.' using errcode = '22023'; end if;
  update reviews set reply_text = left(btrim(p_texto), 600), replied_at = now() where id = rv.id;
end;
$$;

-- Avaliações públicas da loja e o pedido que ainda falta avaliar.
create or replace function public.loja_avaliacoes(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'media', s.rating_avg, 'total', s.rating_count,
    'itens', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'tags', r.tags, 'text', r.text, 'photo_path', r.photo_path,
                                                          'autor', public.comunidade_nome(r.user_id), 'criado_em', r.criado_em,
                                                          'reply_text', r.reply_text, 'replied_at', r.replied_at) order by r.criado_em desc)
                       from (select * from reviews where store_id = p_store and not hidden order by criado_em desc limit 50) r), '[]'::jsonb))
  from stores s where s.id = p_store and s.status = 'aprovada';
$$;

create or replace function public.avaliacao_do_pedido(p_request uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('id', id, 'rating', rating, 'tags', tags, 'text', text, 'reply_text', reply_text)
                   from reviews where request_id = p_request and user_id = auth.uid()), 'null'::jsonb);
$$;

revoke all on function public.loja_recalcular_nota(uuid) from public, anon, authenticated;
revoke all on function public.avaliacao_enviar(uuid, int, text[], text, text), public.avaliacao_responder(uuid, text),
  public.loja_avaliacoes(uuid), public.avaliacao_do_pedido(uuid) from public, anon;
grant execute on function public.avaliacao_enviar(uuid, int, text[], text, text), public.avaliacao_responder(uuid, text),
  public.loja_avaliacoes(uuid), public.avaliacao_do_pedido(uuid) to authenticated;

-- Estoque (5.10): quando a baixa chega ao mínimo, a equipe é avisada; zerado com
-- "esconder" já sai da vitrine (produto_visivel). Um aviso por produto a cada 12 h.
create or replace function public.produto_avisar_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock < old.stock and new.stock <= new.stock_min and new.venda <> 'oculto' then
    insert into notification_log (user_id, type, title, body, deep_link)
    select m.user_id, 'pedido', case when new.stock = 0 then 'Produto esgotado' else 'Estoque baixo' end,
           new.name || case when new.stock = 0 then case when new.hide_when_zero then ' saiu da vitrine.' else ' está sem estoque.' end
                            else ': restam ' || new.stock || '.' end,
           '/loja-painel/produto/' || new.id
    from store_members m where m.store_id = new.store_id and m.active and m.role in ('owner', 'manager')
      and not exists (select 1 from notification_log n where n.user_id = m.user_id and n.deep_link = '/loja-painel/produto/' || new.id and n.sent_at > now() - interval '12 hours');
  end if;
  return new;
end;
$$;
revoke all on function public.produto_avisar_estoque() from public, anon, authenticated;
drop trigger if exists products_aviso_estoque on public.products;
create trigger products_aviso_estoque after update of stock on public.products for each row execute function public.produto_avisar_estoque();

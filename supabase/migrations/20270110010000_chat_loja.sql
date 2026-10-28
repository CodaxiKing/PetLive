-- Chat tutor e loja (BUSINESS.md 5.12): uma conversa por solicitação, entre
-- o tutor e a equipe da loja. Fecha 7 dias depois de a solicitação terminar.
-- Mensagens em tempo real pela publicação do Realtime, com RLS: só quem é
-- parte da conversa lê.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  closed_at timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.conversations enable row level security;
revoke all on public.conversations from public, anon, authenticated;
grant select on public.conversations to authenticated;
drop policy if exists conversations_partes on public.conversations;
create policy conversations_partes on public.conversations for select to authenticated
  using (user_id = auth.uid() or public.loja_membro(store_id));

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  da_loja boolean not null,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  at timestamptz not null default now()
);
create index if not exists messages_conversa on public.messages (conversation_id, at);
alter table public.messages enable row level security;
revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
drop policy if exists messages_partes on public.messages;
create policy messages_partes on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.loja_membro(c.store_id))));

-- Realtime das mensagens (RLS vale também para a assinatura).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Abre (ou devolve) a conversa da solicitação. Só o tutor dela ou a equipe da loja.
create or replace function public.chat_abrir(p_request uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r requests; c conversations; v_loja boolean; v_fim timestamptz;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into r from requests where id = p_request;
  v_loja := r.id is not null and public.loja_membro(r.store_id);
  if r.id is null or not (r.user_id = auth.uid() or v_loja) then raise exception 'Conversa não disponível.' using errcode = '42501'; end if;
  insert into conversations (request_id, store_id, user_id) values (r.id, r.store_id, r.user_id)
  on conflict (request_id) do nothing;
  select * into c from conversations where request_id = r.id;
  -- Fecha 7 dias depois do fim da solicitação.
  if c.closed_at is null and r.status in ('concluida', 'recusada', 'expirada', 'cancelada', 'nao_compareceu') then
    select max(at) into v_fim from request_events where request_id = r.id and to_status = r.status;
    if v_fim is not null and v_fim < now() - interval '7 days' then
      update conversations set closed_at = v_fim + interval '7 days' where id = c.id returning * into c;
    end if;
  end if;
  -- Marca como lidas as mensagens do outro lado.
  update messages set read_at = now() where conversation_id = c.id and read_at is null and da_loja <> v_loja;
  return jsonb_build_object(
    'id', c.id, 'fechada', c.closed_at is not null, 'sou_loja', v_loja,
    'loja', (select name from stores where id = r.store_id), 'numero', r.numero,
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'da_loja', m.da_loja, 'body', m.body, 'at', m.at, 'lida', m.read_at is not null) order by m.at)
                           from (select * from messages where conversation_id = c.id order by at desc limit 200) m), '[]'::jsonb));
end;
$$;

create or replace function public.chat_enviar(p_conversa uuid, p_texto text)
returns bigint language plpgsql security definer set search_path = public as $$
declare c conversations; r requests; v_loja boolean; v_id bigint; v_texto text := btrim(coalesce(p_texto, ''));
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into c from conversations where id = p_conversa;
  if c.id is null then raise exception 'Conversa não encontrada.' using errcode = '22023'; end if;
  v_loja := public.loja_membro(c.store_id);
  if not (c.user_id = auth.uid() or v_loja) then raise exception 'Conversa não disponível.' using errcode = '42501'; end if;
  if c.closed_at is not null then raise exception 'Esta conversa foi encerrada.' using errcode = '22023'; end if;
  if char_length(v_texto) = 0 then raise exception 'Escreva a mensagem.' using errcode = '22023'; end if;
  if (select count(*) from messages where sender_id = auth.uid() and at > now() - interval '1 minute') >= 20 then
    raise exception 'Muitas mensagens seguidas. Aguarde um pouco.' using errcode = '23514';
  end if;
  insert into messages (conversation_id, sender_id, da_loja, body) values (c.id, auth.uid(), v_loja and c.user_id <> auth.uid(), left(v_texto, 1000))
  returning id into v_id;
  select * into r from requests where id = c.request_id;
  -- Avisa o outro lado (sem repetir enquanto houver mensagem dele não lida há menos de 10 min).
  if v_loja and c.user_id <> auth.uid() then
    if not exists (select 1 from notification_log where user_id = c.user_id and deep_link = '/pedidos/' || r.id || '/conversa' and sent_at > now() - interval '10 minutes') then
      insert into notification_log (user_id, type, title, body, deep_link)
      values (c.user_id, 'pedido', (select name from stores where id = c.store_id), left(v_texto, 140), '/pedidos/' || r.id || '/conversa');
    end if;
  else
    insert into notification_log (user_id, type, title, body, deep_link)
    select m.user_id, 'pedido', 'Mensagem do pedido nº ' || r.numero, left(v_texto, 140), '/loja-painel/pedido/' || r.id
    from store_members m where m.store_id = c.store_id and m.active
      and not exists (select 1 from notification_log n where n.user_id = m.user_id and n.deep_link = '/loja-painel/pedido/' || r.id and n.sent_at > now() - interval '10 minutes');
  end if;
  return v_id;
end;
$$;

revoke all on function public.chat_abrir(uuid), public.chat_enviar(uuid, text) from public, anon;
grant execute on function public.chat_abrir(uuid), public.chat_enviar(uuid, text) to authenticated;

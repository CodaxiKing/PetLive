-- SOS pré-chegada (BUSINESS.md 5.37; protótipos EstouACaminho e
-- WebEmergencias). O tutor escolhe uma clínica 24 h que está no PetLive e
-- avisa que está a caminho: a clínica recebe o link da ficha de emergência e o
-- tempo de chegada, responde (viu, preparando, sala liberada ou sem vaga) e o
-- tutor toca em Cheguei. Mudar de clínica encerra o aviso anterior e cria outro
-- com a mesma ficha. Um aviso sem resposta deixa de valer depois de 3 horas.

alter table public.stores add column if not exists emergencia_24h boolean not null default false;

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda', 'perdido', 'comunidade', 'pedido', 'pagamento', 'sos'));

create table if not exists public.sos_arrivals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  link_id uuid references public.carteirinha_links (id) on delete set null,
  eta_min int not null check (eta_min between 1 and 180),
  eta_at timestamptz not null,
  status text not null default 'enviada' check (status in ('enviada', 'vista', 'preparando', 'pronta', 'indisponivel', 'cancelada', 'chegou', 'expirada')),
  resposta text check (char_length(resposta) <= 300),
  -- Aviso que substituiu este quando o tutor mudou de clínica.
  substituido_por uuid references public.sos_arrivals (id) on delete set null,
  criado_em timestamptz not null default now(),
  vista_em timestamptz,
  preparando_em timestamptz,
  pronta_em timestamptz,
  chegou_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists sos_arrivals_user on public.sos_arrivals (user_id, criado_em desc);
create index if not exists sos_arrivals_store on public.sos_arrivals (store_id, criado_em desc);
alter table public.sos_arrivals enable row level security;
revoke all on public.sos_arrivals from public, anon, authenticated;
grant all on public.sos_arrivals to service_role;

-- Ainda em curso: não encerrado e com menos de 3 horas. Sem vaga continua em
-- curso para o tutor poder mudar de clínica a partir dele.
create or replace function public.sos_ativo(a sos_arrivals)
returns boolean language sql stable as $$
  select a.status in ('enviada', 'vista', 'preparando', 'pronta', 'indisponivel') and a.criado_em > now() - interval '3 hours';
$$;

-- Clínicas 24 h do PetLive mais perto (a lista de "Estou a caminho").
create or replace function public.clinicas_24h_perto(p_lat double precision, p_lng double precision, p_raio_km double precision default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(c order by (c->>'distancia_km')::numeric), '[]'::jsonb) from (
    select jsonb_build_object('id', s.id, 'name', s.name, 'address', s.address, 'neighborhood', s.neighborhood, 'phone', s.phone,
      'lat', s.lat, 'lng', s.lng, 'distancia_km', round(public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng)::numeric, 1)) as c
    from stores s
    where auth.uid() is not null and s.status = 'aprovada' and s.kind = 'clinica' and s.emergencia_24h and s.is_open
      and s.lat is not null and public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng) <= least(coalesce(p_raio_km, 30), 80)
    order by public.perdido_distancia_km(p_lat, p_lng, s.lat, s.lng) limit 10) x;
$$;

create or replace function public.sos_avisar_clinica(p_store uuid, p_titulo text, p_corpo text, p_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into notification_log (user_id, type, title, body, deep_link)
  select m.user_id, 'sos', p_titulo, p_corpo, '/loja-painel/emergencia/' || p_id from store_members m where m.store_id = p_store and m.active;
$$;

create or replace function public.sos_chegada_criar(p_store uuid, p_pet uuid, p_codigo text, p_eta_min int)
returns uuid language plpgsql security definer set search_path = public as $$
declare s stores; l carteirinha_links; v_id uuid; v_pet text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not public.is_pet_owner(p_pet) then raise exception 'Pet não disponível nesta conta.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store;
  if s.id is null or s.status <> 'aprovada' or s.kind <> 'clinica' or not s.emergencia_24h then
    raise exception 'Esta clínica não recebe avisos de emergência pelo PetLive.' using errcode = '22023';
  end if;
  select * into l from carteirinha_links where codigo = p_codigo and pet_id = p_pet and tutor_id = auth.uid() and cancelado_em is null and expira_em > now();
  if l.id is null then raise exception 'A ficha de emergência venceu. Gere outra.' using errcode = '22023', hint = 'ficha'; end if;
  if (select count(*) from sos_arrivals where user_id = auth.uid() and criado_em > now() - interval '1 hour') >= 6 then
    raise exception 'Muitos avisos seguidos. Ligue para a clínica.' using errcode = '23514';
  end if;
  -- Um aviso em curso por vez: o anterior é encerrado.
  update sos_arrivals a set status = 'cancelada', atualizado_em = now() where a.user_id = auth.uid() and public.sos_ativo(a);
  insert into sos_arrivals (user_id, pet_id, store_id, link_id, eta_min, eta_at)
  values (auth.uid(), p_pet, s.id, l.id, p_eta_min, now() + make_interval(mins => p_eta_min))
  returning id into v_id;
  select nome into v_pet from pets where id = p_pet;
  perform public.sos_avisar_clinica(s.id, 'Emergência a caminho', v_pet || ' chega em cerca de ' || p_eta_min || ' min. Abra a ficha.', v_id);
  return v_id;
end;
$$;

create or replace function public.sos_chegada_json(a sos_arrivals)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'status', case when a.status in ('enviada', 'vista', 'preparando', 'pronta', 'indisponivel') and not public.sos_ativo(a) then 'expirada' else a.status end,
    'eta_min', a.eta_min, 'eta_at', a.eta_at, 'resposta', a.resposta, 'criado_em', a.criado_em, 'vista_em', a.vista_em,
    'preparando_em', a.preparando_em, 'pronta_em', a.pronta_em, 'chegou_em', a.chegou_em, 'substituido_por', a.substituido_por,
    'pet', (select jsonb_build_object('id', p.id, 'nome', p.nome) from pets p where p.id = a.pet_id),
    'ficha', (select jsonb_build_object('codigo', l.codigo, 'secoes', l.secoes, 'expira_em', l.expira_em) from carteirinha_links l where l.id = a.link_id),
    'clinica', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address, 'lat', s.lat, 'lng', s.lng),
    'telefone_tutor', case when public.loja_membro(a.store_id) then (select pr.telefone from profiles pr where pr.id = a.user_id) end)
  from stores s where s.id = a.store_id;
$$;

create or replace function public.sos_chegada_detalhe(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a sos_arrivals;
begin
  select * into a from sos_arrivals where id = p_id;
  if a.id is null or not (a.user_id = auth.uid() or public.loja_membro(a.store_id)) then return null; end if;
  return public.sos_chegada_json(a);
end;
$$;

-- O tutor acompanha o aviso em curso a partir do SOS.
create or replace function public.sos_chegada_atual()
returns uuid language sql stable security definer set search_path = public as $$
  select a.id from sos_arrivals a where a.user_id = auth.uid() and public.sos_ativo(a) order by a.criado_em desc limit 1;
$$;

create or replace function public.sos_chegada_do_tutor(p_id uuid)
returns sos_arrivals language plpgsql stable security definer set search_path = public as $$
declare a sos_arrivals;
begin
  select * into a from sos_arrivals where id = p_id;
  if a.id is null or a.user_id is distinct from auth.uid() then raise exception 'Aviso não encontrado.' using errcode = '42501'; end if;
  if not public.sos_ativo(a) then raise exception 'Este aviso já foi encerrado.' using errcode = '22023', hint = 'encerrado'; end if;
  return a;
end;
$$;

create or replace function public.sos_chegada_mudar_clinica(p_id uuid, p_store uuid, p_eta_min int)
returns uuid language plpgsql security definer set search_path = public as $$
declare a sos_arrivals; v_codigo text; v_novo uuid; v_pet text;
begin
  a := public.sos_chegada_do_tutor(p_id);
  if a.store_id = p_store then raise exception 'Você já está indo para esta clínica.' using errcode = '22023'; end if;
  select codigo into v_codigo from carteirinha_links where id = a.link_id;
  v_novo := public.sos_chegada_criar(p_store, a.pet_id, v_codigo, p_eta_min);
  update sos_arrivals set substituido_por = v_novo, atualizado_em = now() where id = a.id;
  select nome into v_pet from pets where id = a.pet_id;
  perform public.sos_avisar_clinica(a.store_id, 'Tutor mudou de clínica', v_pet || ' não vai mais para aí. Obrigado pela ajuda.', a.id);
  return v_novo;
end;
$$;

create or replace function public.sos_chegada_encerrar(p_id uuid, p_cheguei boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a sos_arrivals; v_pet text;
begin
  a := public.sos_chegada_do_tutor(p_id);
  select nome into v_pet from pets where id = a.pet_id;
  if p_cheguei then
    update sos_arrivals set status = 'chegou', chegou_em = now(), atualizado_em = now() where id = a.id;
    perform public.sos_avisar_clinica(a.store_id, 'Chegou', v_pet || ' acabou de chegar na recepção.', a.id);
  else
    update sos_arrivals set status = 'cancelada', atualizado_em = now() where id = a.id;
    perform public.sos_avisar_clinica(a.store_id, 'Aviso cancelado', 'O tutor de ' || v_pet || ' cancelou a ida.', a.id);
  end if;
end;
$$;

-- A clínica responde. Sem vaga pede o motivo, que o tutor vê para escolher outra.
create or replace function public.sos_chegada_responder(p_id uuid, p_status text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a sos_arrivals; v_clinica text; v_msg text := nullif(left(btrim(coalesce(p_mensagem, '')), 300), '');
begin
  select * into a from sos_arrivals where id = p_id for update;
  if a.id is null or not public.loja_membro(a.store_id) then raise exception 'Aviso não encontrado.' using errcode = '42501'; end if;
  if not public.sos_ativo(a) then raise exception 'Este aviso já foi encerrado.' using errcode = '22023'; end if;
  if p_status not in ('vista', 'preparando', 'pronta', 'indisponivel') then raise exception 'Resposta inválida.' using errcode = '22023'; end if;
  if p_status = 'indisponivel' and v_msg is null then raise exception 'Diga ao tutor o motivo (ele vê no app).' using errcode = '22023'; end if;
  update sos_arrivals set status = p_status, resposta = coalesce(v_msg, resposta), atualizado_em = now(),
    vista_em = coalesce(vista_em, now()),
    preparando_em = case when p_status in ('preparando', 'pronta') then coalesce(preparando_em, now()) else preparando_em end,
    pronta_em = case when p_status = 'pronta' then coalesce(pronta_em, now()) else pronta_em end
  where id = a.id;
  select name into v_clinica from stores where id = a.store_id;
  insert into notification_log (user_id, type, title, body, deep_link)
  values (a.user_id, 'sos',
    case p_status when 'vista' then 'A clínica viu a ficha' when 'preparando' then 'Equipe se preparando'
                  when 'pronta' then 'Sala de emergência liberada' else 'A clínica não pode receber agora' end,
    v_clinica || coalesce(': ' || v_msg, case p_status when 'indisponivel' then '. Escolha outra clínica.' else ' está esperando vocês.' end),
    '/sos/chegada/' || a.id);
end;
$$;

-- Painel da clínica (WebEmergencias): avisos das últimas 3 horas.
create or replace function public.loja_emergencias(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.loja_membro(p_store) then raise exception 'Sem acesso a esta clínica.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(public.sos_chegada_json(a) order by a.criado_em desc)
                   from sos_arrivals a where a.store_id = p_store and a.criado_em > now() - interval '3 hours'), '[]'::jsonb);
end;
$$;

-- A clínica marca que atende emergência 24 h (dono ou gerente).
create or replace function public.loja_emergencia_24h(p_store uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.loja_membro(p_store, array['owner', 'manager']) then raise exception 'Só o dono ou o gerente muda isto.' using errcode = '42501'; end if;
  update stores set emergencia_24h = coalesce(p_ativo, false), atualizado_em = now() where id = p_store and kind = 'clinica';
  if not found then raise exception 'Só clínicas atendem emergência pelo PetLive.' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.sos_ativo(sos_arrivals), public.sos_avisar_clinica(uuid, text, text, uuid), public.sos_chegada_json(sos_arrivals),
  public.sos_chegada_do_tutor(uuid) from public, anon, authenticated;
revoke all on function public.clinicas_24h_perto(double precision, double precision, double precision), public.sos_chegada_criar(uuid, uuid, text, int),
  public.sos_chegada_detalhe(uuid), public.sos_chegada_atual(), public.sos_chegada_mudar_clinica(uuid, uuid, int), public.sos_chegada_encerrar(uuid, boolean),
  public.sos_chegada_responder(uuid, text, text), public.loja_emergencias(uuid), public.loja_emergencia_24h(uuid, boolean) from public, anon;
grant execute on function public.clinicas_24h_perto(double precision, double precision, double precision), public.sos_chegada_criar(uuid, uuid, text, int),
  public.sos_chegada_detalhe(uuid), public.sos_chegada_atual(), public.sos_chegada_mudar_clinica(uuid, uuid, int), public.sos_chegada_encerrar(uuid, boolean),
  public.sos_chegada_responder(uuid, text, text), public.loja_emergencias(uuid), public.loja_emergencia_24h(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

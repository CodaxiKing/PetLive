-- PetLive: QR da coleira e envio de localização por quem encontra o pet (BUSINESS.md 5.6).
-- O tutor escolhe o que aparece ao escanear: foto, telefone, alergias.
-- Quem acha o pet pode enviar a localização, só se o tutor autorizou (permitir_localizacao_finder).
-- O telefone de quem enviou NÃO é exposto ao tutor.

create table public.pet_qr_settings (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  -- Código curto e único para o QR (ex.: "aB3x9K2m").
  code text not null unique check (char_length(code) between 6 and 12),
  -- O que o tutor libera na página pública.
  show_photo boolean not null default true,
  show_phone boolean not null default false,
  show_allergies boolean not null default false,
  -- Se quem encontra o pet pode enviar a própria localização (botão "Enviar minha localização").
  -- O tutor ativa isso nas configurações do QR. Quando ligado, a página pública mostra o botão.
  permitir_localizacao_finder boolean not null default false,
  -- QR ativo ou não (o tutor pode desligar).
  active boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.pet_qr_settings is 'Configurações do QR da coleira do pet. Uma linha por pet.';
comment on column public.pet_qr_settings.permitir_localizacao_finder is 'Se verdadeiro, a página pública mostra o botão "Enviar minha localização" para quem encontrou o pet.';

-- Índice para busca por código (página pública /p/[code]).
create index pet_qr_settings_code_idx on public.pet_qr_settings (code) where active;

-- RLS: tutor lê e escreve a configuração do próprio pet.
alter table public.pet_qr_settings enable row level security;

create policy "Tutor gerencia QR do seu pet" on public.pet_qr_settings
  for all using (
    exists (select 1 from public.pets where id = pet_qr_settings.pet_id and tutor_id = auth.uid())
  );

-- Anônimo lê só o código ativo (para a página pública /p/[code]).
create policy "Anônimo lê QR ativo por código" on public.pet_qr_settings
  for select using (active = true);

-- Trigger updated_at.
create trigger pet_qr_settings_touch before update on public.pet_qr_settings
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Registro de scans do QR (quem escaneou, opcionalmente com lat/lng se enviou localização).
-- ============================================================
create table public.qr_scans (
  id bigint generated always as identity primary key,
  pet_id uuid not null references public.pets (id) on delete cascade,
  -- Quando o QR foi escaneado/página aberta.
  scanned_at timestamptz not null default now(),
  -- Latitude/longitude de quem escaneou (só preenchido se a pessoa tocou em "Enviar minha localização").
  lat numeric(9, 6),
  lng numeric(9, 6),
  -- Hash do IP para limitar spam (não guarda o IP direto).
  ip_hash text,
  -- Se a localização foi enviada (botão pressionado).
  location_sent boolean not null default false
);

comment on table public.qr_scans is 'Registro de cada abertura do QR da coleira. Lat/lng só se a pessoa enviou a localização.';

create index qr_scans_pet_id_idx on public.qr_scans (pet_id, scanned_at desc);

alter table public.qr_scans enable row level security;

-- Tutor lê os scans do seu pet.
create policy "Tutor lê scans do seu pet" on public.qr_scans
  for select using (
    exists (select 1 from public.pets where id = qr_scans.pet_id and tutor_id = auth.uid())
  );

-- Anônimo insere ao abrir a página (o RPC public-qr faz isso).
create policy "Anônimo insere scan" on public.qr_scans
  for insert with check (true);

-- ============================================================
-- RPC: public-qr — devolve os campos liberados do pet para a página pública /p/[code].
-- ============================================================
create or replace function public.public_qr(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr pet_qr_settings;
  v_pet pets;
  v_tutor profiles;
  v_ip text := coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ',', 1),
    'sem-ip'
  );
  v_ip_hash text := encode(extensions.digest(v_ip || 'petlive-qr', 'sha256'), 'hex');
begin
  -- Busca configuração do QR ativa pelo código.
  select * into v_qr from pet_qr_settings where code = p_codigo and active;
  if v_qr.pet_id is null then
    return jsonb_build_object('valido', false);
  end if;

  -- Registra o acesso (scan) com IP hash (sem lat/lng por enquanto).
  insert into qr_scans (pet_id, ip_hash) values (v_qr.pet_id, v_ip_hash);

  -- Busca dados do pet e tutor.
  select * into v_pet from pets where id = v_qr.pet_id;
  select * into v_tutor from profiles where id = v_pet.tutor_id;

  -- Monta resposta só com o que o tutor liberou.
  return jsonb_build_object(
    'valido', true,
    'pet', jsonb_build_object(
      'nome', v_pet.nome,
      'especie', v_pet.especie,
      'raca', v_pet.raca,
      'foto_url', case when v_qr.show_photo then v_pet.foto_url else null end,
      'alergias', case when v_qr.show_allergies then v_pet.alergias else null end
    ),
    'tutor', jsonb_build_object(
      'nome', v_tutor.nome,
      'telefone', case when v_qr.show_phone then v_tutor.telefone else null end,
      'cidade', v_tutor.cidade
    ),
    'permitir_localizacao_finder', v_qr.permitir_localizacao_finder
  );
end;
$$;

revoke all on function public.public_qr(text) from public;
grant execute on function public.public_qr(text) to anon, authenticated;

-- ============================================================
-- RPC: qr_location — registra a localização de quem encontrou o pet e avisa o tutor.
-- ============================================================
create or replace function public.qr_location(
  p_codigo text,
  p_lat numeric,
  p_lng numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr pet_qr_settings;
  v_pet pets;
  v_tutor profiles;
  v_ip text := coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ',', 1),
    'sem-ip'
  );
  v_ip_hash text := encode(extensions.digest(v_ip || 'petlive-qr', 'sha256'), 'hex');
  v_scan_id bigint;
  v_aviso uuid;
  v_titulo text;
  v_token text;
  v_existente boolean;
begin
  -- Validação de coordenadas: latitude entre -90 e 90, longitude entre -180 e 180.
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('sucesso', false, 'erro', 'Coordenadas inválidas.');
  end if;

  -- Busca configuração do QR ativa pelo código.
  select * into v_qr from pet_qr_settings where code = p_codigo and active;
  if v_qr.pet_id is null then
    return jsonb_build_object('sucesso', false, 'erro', 'QR inválido ou inativo.');
  end if;

  -- Verifica se o tutor autorizou o envio de localização.
  if not v_qr.permitir_localizacao_finder then
    return jsonb_build_object('sucesso', false, 'erro', 'O tutor não autorizou o envio de localização.');
  end if;

  -- Verifica se já enviou localização neste scan (evita spam: máx 1 por abertura).
  -- Usa o IP hash para identificar a mesma sessão.
  select exists (
    select 1 from qr_scans
    where pet_id = v_qr.pet_id and ip_hash = v_ip_hash and location_sent = true
  ) into v_existente;
  if v_existente then
    return jsonb_build_object('sucesso', false, 'erro', 'Localização já enviada para este QR. Peça ao tutor para gerar um novo link.');
  end if;

  -- Atualiza o scan mais recente deste IP com a localização.
  update qr_scans
  set lat = p_lat, lng = p_lng, location_sent = true
  where pet_id = v_qr.pet_id and ip_hash = v_ip_hash and location_sent = false
  order by scanned_at desc
  limit 1
  returning id into v_scan_id;

  if v_scan_id is null then
    -- Fallback: insere novo scan com localização (caso não tenha scan prévio).
    insert into qr_scans (pet_id, lat, lng, ip_hash, location_sent)
    values (v_qr.pet_id, p_lat, p_lng, v_ip_hash, true)
    returning id into v_scan_id;
  end if;

  -- Busca dados do pet e tutor para o push.
  select * into v_pet from pets where id = v_qr.pet_id;
  select * into v_tutor from profiles where id = v_pet.tutor_id;

  -- Cria notificação no log.
  v_titulo := 'Localização de ' || v_pet.nome || ' recebida';
  insert into notification_log (user_id, pet_id, type, title, body, deep_link)
  values (
    v_qr.pet_id, v_qr.pet_id, 'sistema', v_titulo,
    'Alguém encontrou o ' || v_pet.nome || ' e enviou a localização. Toque para ver no mapa.',
    '/mapa?lat=' || p_lat || '&lng=' || p_lng || '&pet=' || v_qr.pet_id
  )
  returning id into v_aviso;

  -- Dispara push para todos os tokens ativos do tutor.
  for v_token in select token from push_tokens where tutor_id = v_pet.tutor_id and ativo loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', v_token,
        'title', v_titulo,
        'body', 'Toque para ver a localização no mapa.',
        'sound', 'default',
        'data', jsonb_build_object(
          'tipo', 'qr_localizacao',
          'url', '/mapa?lat=' || p_lat || '&lng=' || p_lng || '&pet=' || v_qr.pet_id,
          'aviso_id', v_aviso,
          'lat', p_lat,
          'lng', p_lng,
          'pet_nome', v_pet.nome
        )
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;

  return jsonb_build_object('sucesso', true);
end;
$$;

revoke all on function public.qr_location(text, numeric, numeric) from public;
grant execute on function public.qr_location(text, numeric, numeric) to anon, authenticated;

-- ============================================================
-- RPC: atualizar_qr_pet — cria ou atualiza as configurações do QR do pet.
-- ============================================================
create or replace function public.atualizar_qr_pet(
  p_pet uuid,
  p_code text,
  p_show_photo boolean default true,
  p_show_phone boolean default false,
  p_show_allergies boolean default false,
  p_permitir_localizacao_finder boolean default false,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_qr pet_qr_settings;
begin
  -- Verifica se o pet pertence ao tutor autenticado.
  select * into v_pet from pets where id = p_pet and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  -- Valida código: 6-12 chars, alfanumérico.
  if not p_code ~ '^[A-Za-z0-9]{6,12}$' then
    raise exception 'Código inválido. Use 6 a 12 caracteres alfanuméricos.' using errcode = '42501';
  end if;

  -- Verifica se o código já existe para outro pet.
  select * into v_qr from pet_qr_settings where code = p_code;
  if v_qr.pet_id is not null and v_qr.pet_id <> p_pet then
    raise exception 'Este código já está em uso por outro pet.' using errcode = '42501';
  end if;

  -- Upsert: cria ou atualiza.
  insert into pet_qr_settings (pet_id, code, show_photo, show_phone, show_allergies, permitir_localizacao_finder, active)
  values (p_pet, p_code, p_show_photo, p_show_phone, p_show_allergies, p_permitir_localizacao_finder, p_active)
  on conflict (pet_id) do update set
    code = excluded.code,
    show_photo = excluded.show_photo,
    show_phone = excluded.show_phone,
    show_allergies = excluded.show_allergies,
    permitir_localizacao_finder = excluded.permitir_localizacao_finder,
    active = excluded.active,
    atualizado_em = now()
  returning * into v_qr;

  return jsonb_build_object(
    'pet_id', v_qr.pet_id,
    'code', v_qr.code,
    'show_photo', v_qr.show_photo,
    'show_phone', v_qr.show_phone,
    'show_allergies', v_qr.show_allergies,
    'permitir_localizacao_finder', v_qr.permitir_localizacao_finder,
    'active', v_qr.active
  );
end;
$$;

revoke all on function public.atualizar_qr_pet(uuid, text, boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.atualizar_qr_pet(uuid, text, boolean, boolean, boolean, boolean, boolean) to authenticated;
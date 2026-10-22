-- PetLive: Fix rate limiting for QR location - use secure token instead of IP hash.
-- O rate limiting baseado em IP (x-forwarded-for) pode ser burlado via spoofing.
-- Solução: token aleatório seguro gerado no public_qr e validado no qr_location.

-- Adiciona coluna token na tabela qr_scans
alter table public.qr_scans
  add column if not exists token text unique;

-- Índice para busca rápida do token
create index if not exists qr_scans_token_idx on public.qr_scans (token) where token is not null;

comment on column public.qr_scans.token is 'Token seguro para rate limiting (substitui IP hash). Gerado no public_qr, validado no qr_location.';

-- ============================================================
-- RPC: public_qr — devolve os campos liberados do pet + token seguro.
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
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_scan_id bigint;
begin
  -- Busca configuração do QR ativa pelo código.
  select * into v_qr from pet_qr_settings where code = p_codigo and active;
  if v_qr.pet_id is null then
    return jsonb_build_object('valido', false);
  end if;

  -- Registra o acesso (scan) com token seguro (sem lat/lng por enquanto).
  insert into qr_scans (pet_id, token) values (v_qr.pet_id, v_token)
  returning id into v_scan_id;

  -- Busca dados do pet e tutor.
  select * into v_pet from pets where id = v_qr.pet_id;
  select * into v_tutor from profiles where id = v_pet.tutor_id;

  -- Monta resposta só com o que o tutor liberou + token para rate limiting.
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
    'permitir_localizacao_finder', v_qr.permitir_localizacao_finder,
    'scan_token', v_token
  );
end;
$$;

revoke all on function public.public_qr(text) from public;
grant execute on function public.public_qr(text) to anon, authenticated;

-- ============================================================
-- RPC: qr_location — registra a localização validando o token.
-- ============================================================
create or replace function public.qr_location(
  p_codigo text,
  p_lat numeric,
  p_lng numeric,
  p_token text
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

  -- Validação do token: deve ser fornecido e ter 64 chars (32 bytes hex).
  if p_token is null or length(p_token) <> 64 then
    return jsonb_build_object('sucesso', false, 'erro', 'Token de sessão inválido. Recarregue a página e tente novamente.');
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

  -- Verifica se o token existe e pertence a este pet, e se ainda não enviou localização.
  select exists (
    select 1 from qr_scans
    where pet_id = v_qr.pet_id and token = p_token and location_sent = true
  ) into v_existente;
  if v_existente then
    return jsonb_build_object('sucesso', false, 'erro', 'Localização já enviada para este QR. Peça ao tutor para gerar um novo link.');
  end if;

  -- Atualiza o scan com este token com a localização.
  update qr_scans
  set lat = p_lat, lng = p_lng, location_sent = true
  where pet_id = v_qr.pet_id and token = p_token and location_sent = false
  returning id into v_scan_id;

  if v_scan_id is null then
    -- Token não encontrado ou já usado.
    return jsonb_build_object('sucesso', false, 'erro', 'Sessão inválida ou expirada. Recarregue a página e tente novamente.');
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

revoke all on function public.qr_location(text, numeric, numeric, text) from public;
grant execute on function public.qr_location(text, numeric, numeric, text) to anon, authenticated;
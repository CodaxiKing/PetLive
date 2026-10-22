-- PetLive: QR da coleira (BUSINESS.md 5.6, 5.29). QR não expira; o tutor
-- escolhe o que aparece (nome/foto, telefone, alergias). Página pública em
-- /p/[codigo] (sem login). Baixar etiqueta PDF/PNG (Premium).

-- ============================================================
-- Configurações do QR da coleira
-- ============================================================
create table public.pet_qr_settings (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  -- Código curto e único para a URL pública (petlive.app/r/[codigo]).
  codigo text not null unique check (char_length(codigo) between 8 and 16),
  -- Seções que o tutor liberou na página pública.
  -- Chaves possíveis: 'nome_foto', 'telefone', 'alergias'.
  secoes text[] not null default '{nome_foto}',
  -- Quando o tutor revogou o QR. Nulo = ativo.
  revogado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.pet_qr_settings is 'Configurações do QR da coleira por pet. Uma linha por pet.';

-- Índice para busca rápida pelo código na página pública.
create index pet_qr_settings_codigo_idx on public.pet_qr_settings (codigo);

-- Trigger de updated_at.
create trigger pet_qr_settings_touch before update on public.pet_qr_settings
  for each row execute function public.touch_updated_at();

-- RLS: tutor lê e escreve o do seu pet; anon só via função pública.
alter table public.pet_qr_settings enable row level security;

create policy "Tutor gerencia QR do seu pet" on public.pet_qr_settings
  for all using (
    pet_id in (select id from public.pets where tutor_id = auth.uid())
  )
  with check (
    pet_id in (select id from public.pets where tutor_id = auth.uid())
  );

-- Anônimo não acessa direto; usa a função pública obter_qr_publico.
revoke all on public.pet_qr_settings from anon;

-- ============================================================
-- Log de scans do QR (auditoria, rate-limit, LGPD)
-- ============================================================
create table public.qr_scans (
  id bigint generated always as identity primary key,
  pet_id uuid not null references public.pets (id) on delete cascade,
  codigo text not null,
  -- Hash do IP (SHA-256 com salt), não guarda IP bruto (LGPD).
  ip_hash text not null,
  user_agent text,
  -- Se a pessoa enviou a localização.
  lat numeric(9, 6),
  lng numeric(9, 6),
  criado_em timestamptz not null default now()
);

create index qr_scans_pet_id_idx on public.qr_scans (pet_id, criado_em desc);
create index qr_scans_codigo_idx on public.qr_scans (codigo, criado_em desc);
create index qr_scans_ip_hash_idx on public.qr_scans (ip_hash, criado_em desc);

comment on table public.qr_scans is 'Log de acessos à página pública do QR da coleira. IP hasheado.';

alter table public.qr_scans enable row level security;

-- Tutor vê os scans do seu pet (sem IP bruto).
create policy "Tutor vê scans do seu pet" on public.qr_scans
  for select using (
    pet_id in (select id from public.pets where tutor_id = auth.uid())
  );

-- Anônimo insere via função pública ao acessar a página.
revoke all on public.qr_scans from anon;

-- ============================================================
-- Função: gerar código curto único (base64url, 10 chars ~ 60 bits)
-- ============================================================
create or replace function public.gerar_codigo_qr()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_tentativas int := 0;
begin
  loop
    v_codigo := translate(
      encode(extensions.gen_random_bytes(8), 'base64'),
      '+/', '-_'
    );
    -- Garante comprimento entre 8 e 16 (base64url de 8 bytes = ~11 chars).
    v_codigo := substr(v_codigo, 1, 10);
    if not exists (select 1 from pet_qr_settings where codigo = v_codigo) then
      return v_codigo;
    end if;
    v_tentativas := v_tentativas + 1;
    if v_tentativas > 10 then
      raise exception 'Não foi possível gerar código único para o QR.';
    end if;
  end loop;
end;
$$;

-- ============================================================
-- RPC: criar QR da coleira (ou reativar se revogado)
-- ============================================================
create or replace function public.criar_qr_coleira(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_codigo text;
  v_settings pet_qr_settings;
begin
  -- Verifica se o pet existe e pertence ao tutor.
  select * into v_pet from public.pets
  where id = p_pet_id and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  -- Tenta buscar configuração existente.
  select * into v_settings from public.pet_qr_settings where pet_id = p_pet_id;

  if v_settings.pet_id is not null then
    -- Já existe: se estava revogado, reativa mantendo o mesmo código.
    if v_settings.revogado_em is not null then
      update public.pet_qr_settings
      set revogado_em = null, secoes = '{nome_foto}', atualizado_em = now()
      where pet_id = p_pet_id
      returning * into v_settings;
      return jsonb_build_object(
        'codigo', v_settings.codigo,
        'url', 'https://petlive.app/r/' || v_settings.codigo,
        'secoes', v_settings.secoes,
        'reativado', true
      );
    end if;
    -- Já ativo: retorna o existente.
    return jsonb_build_object(
      'codigo', v_settings.codigo,
      'url', 'https://petlive.app/r/' || v_settings.codigo,
      'secoes', v_settings.secoes,
      'reativado', false
    );
  end if;

  -- Não existe: cria novo.
  v_codigo := public.gerar_codigo_qr();
  insert into public.pet_qr_settings (pet_id, codigo, secoes)
  values (p_pet_id, v_codigo, '{nome_foto}')
  returning * into v_settings;

  return jsonb_build_object(
    'codigo', v_settings.codigo,
    'url', 'https://petlive.app/r/' || v_settings.codigo,
    'secoes', v_settings.secoes,
    'reativado', false
  );
end;
$$;

-- ============================================================
-- RPC: atualizar seções do QR (o que aparece ao escanear)
-- ============================================================
create or replace function public.atualizar_qr_coleira(p_pet_id uuid, p_secoes text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_settings pet_qr_settings;
  v_secoes_validas text[] := '{nome_foto,telefone,alergias}';
  v_secoes text[];
begin
  -- Verifica se o pet existe e pertence ao tutor.
  select * into v_pet from public.pets
  where id = p_pet_id and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  -- Valida seções: nome_foto é obrigatório, as outras são opcionais.
  v_secoes := coalesce(p_secoes, '{}');
  if not ('nome_foto' = any(v_secoes)) then
    raise exception 'nome_foto é obrigatório.' using errcode = '42501';
  end if;
  -- Remove seções inválidas.
  v_secoes := array(
    select distinct s from unnest(v_secoes) s
    where s = any(v_secoes_validas)
  );
  -- Garante que nome_foto está presente.
  if not ('nome_foto' = any(v_secoes)) then
    v_secoes := v_secoes || '{nome_foto}';
  end if;

  -- Atualiza ou cria (se não existir, cria com código novo).
  select * into v_settings from public.pet_qr_settings where pet_id = p_pet_id;

  if v_settings.pet_id is not null then
    update public.pet_qr_settings
    set secoes = v_secoes, atualizado_em = now()
    where pet_id = p_pet_id
    returning * into v_settings;
  else
    v_settings := (
      insert into public.pet_qr_settings (pet_id, codigo, secoes)
      values (p_pet_id, public.gerar_codigo_qr(), v_secoes)
      returning *
    );
  end if;

  return jsonb_build_object(
    'codigo', v_settings.codigo,
    'url', 'https://petlive.app/r/' || v_settings.codigo,
    'secoes', v_settings.secoes
  );
end;
$$;

-- ============================================================
-- RPC: revogar QR da coleira
-- ============================================================
create or replace function public.revogar_qr_coleira(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_settings pet_qr_settings;
begin
  select * into v_pet from public.pets
  where id = p_pet_id and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  update public.pet_qr_settings
  set revogado_em = now(), atualizado_em = now()
  where pet_id = p_pet_id and revogado_em is null
  returning * into v_settings;

  if v_settings.pet_id is null then
    raise exception 'QR não encontrado ou já revogado.' using errcode = '42501';
  end if;

  return jsonb_build_object('revogado', true, 'revogado_em', v_settings.revogado_em);
end;
$$;

-- ============================================================
-- RPC pública: obter dados do QR para a página pública (sem auth)
-- ============================================================
create or replace function public.obter_qr_publico(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings pet_qr_settings;
  v_pet pets;
  v_tutor profiles;
  v_ip text;
  v_ip_hash text;
  v_conteudo jsonb;
begin
  -- Rate limit: máx 60 scans/min por IP (edge function faz isso também,
  -- mas garantimos no banco como defesa em profundidade).
  v_ip := coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ',', 1),
    'sem-ip'
  );
  v_ip_hash := encode(extensions.digest(v_ip || 'petlive-qr-scan', 'sha256'), 'hex');

  if (select count(*) from public.qr_scans
      where ip_hash = v_ip_hash and criado_em > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('valido', false, 'erro', 'rate_limit');
  end if;

  -- Busca configuração do QR.
  select * into v_settings from public.pet_qr_settings where codigo = p_codigo;

  if v_settings.pet_id is null then
    -- Loga tentativa com código inválido.
    insert into public.qr_scans (pet_id, codigo, ip_hash, user_agent)
    values ('00000000-0000-0000-0000-000000000000'::uuid, p_codigo, v_ip_hash,
      current_setting('request.headers', true)::jsonb ->> 'user-agent');
    return jsonb_build_object('valido', false, 'erro', 'nao_encontrado');
  end if;

  -- QR revogado?
  if v_settings.revogado_em is not null then
    insert into public.qr_scans (pet_id, codigo, ip_hash, user_agent)
    values (v_settings.pet_id, p_codigo, v_ip_hash,
      current_setting('request.headers', true)::jsonb ->> 'user-agent');
    return jsonb_build_object('valido', false, 'erro', 'revogado');
  end if;

  -- Busca dados do pet e tutor.
  select * into v_pet from public.pets where id = v_settings.pet_id and ativo;
  if v_pet.id is null then
    return jsonb_build_object('valido', false, 'erro', 'pet_inativo');
  end if;

  select * into v_tutor from public.profiles where id = v_pet.tutor_id;

  -- Loga o scan.
  insert into public.qr_scans (pet_id, codigo, ip_hash, user_agent)
  values (v_settings.pet_id, p_codigo, v_ip_hash,
    current_setting('request.headers', true)::jsonb ->> 'user-agent');

  -- Monta o conteúdo respeitando as seções liberadas.
  v_conteudo := jsonb_build_object(
    'pet', jsonb_build_object(
      'id', v_pet.id,
      'nome', v_pet.nome,
      'especie', v_pet.especie,
      'raca', v_pet.raca,
      'nascimento', v_pet.nascimento,
      'foto_url', v_pet.foto_url
    ),
    'secoes', v_settings.secoes
  );

  -- Telefone do tutor (vem do profiles no momento do acesso, LGPD).
  if 'telefone' = any(v_settings.secoes) and v_tutor.telefone is not null then
    v_conteudo := v_conteudo || jsonb_build_object(
      'tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', v_tutor.telefone)
    );
  end if;

  -- Alergias e saúde do pet.
  if 'alergias' = any(v_settings.secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'alergias', v_pet.alergias,
      'veterinario', v_pet.veterinario,
      'observacoes', v_pet.observacoes
    );
  end if;

  return jsonb_build_object(
    'valido', true,
    'conteudo', v_conteudo,
    'codigo', v_settings.codigo
  );
end;
$$;

-- Permissões.
revoke all on function public.criar_qr_coleira(uuid) from public, anon;
grant execute on function public.criar_qr_coleira(uuid) to authenticated;

revoke all on function public.atualizar_qr_coleira(uuid, text[]) from public, anon;
grant execute on function public.atualizar_qr_coleira(uuid, text[]) to authenticated;

revoke all on function public.revogar_qr_coleira(uuid) from public, anon;
grant execute on function public.revogar_qr_coleira(uuid) to authenticated;

revoke all on function public.obter_qr_publico(text) from public;
grant execute on function public.obter_qr_publico(text) to anon, authenticated;

revoke all on function public.gerar_codigo_qr() from public, anon, authenticated;
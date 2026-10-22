-- PetLive: página pública do QR da coleira (BUSINESS.md 5.6 e seção 4.5).
-- Rota pública petlive.app/r/[codigo] mostrando só os dados que o tutor liberou.
-- Variante "pet procurado" quando há alerta de pet perdido ativo.

-- Tabela de links do QR da coleira.
create table public.qr_links (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  -- O que o tutor escolheu mostrar no QR (chaves do JSON de configuração).
  secoes text[] not null,
  -- Foto dos dados no momento da geração (snapshot imutável).
  conteudo jsonb not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz,
  cancelado_em timestamptz,
  -- Controle de acessos e abuso.
  aberturas int not null default 0,
  ultima_abertura_em timestamptz,
  ultima_abertura_ip_hash text
);
create index qr_links_pet on public.qr_links (pet_id, criado_em desc);
create index qr_links_codigo on public.qr_links (codigo);
comment on table public.qr_links is 'Links públicos do QR da coleira (sem login, só leitura).';

alter table public.qr_links enable row level security;
revoke all on public.qr_links from anon, authenticated;
-- O tutor vê os próprios links (sem o conteúdo: ele já tem os dados).
grant select (id, codigo, pet_id, secoes, criado_em, expira_em, cancelado_em, aberturas, ultima_abertura_em)
  on public.qr_links to authenticated;
create policy "qr_links: tutor vê os seus"
  on public.qr_links for select to authenticated
  using (tutor_id = auth.uid());

-- Registro de acessos à página do QR (para auditoria e limites).
create table public.qr_acessos (
  id bigint generated always as identity primary key,
  qr_link_id uuid not null references public.qr_links (id) on delete cascade,
  ip_hash text not null,
  user_agent text,
  criado_em timestamptz not null default now()
);
create index qr_acessos_link on public.qr_acessos (qr_link_id, criado_em desc);
create index qr_acessos_ip_hora on public.qr_acessos (ip_hash, criado_em desc);
comment on table public.qr_acessos is 'Registro de cada abertura da página pública do QR.';

alter table public.qr_acessos enable row level security;
revoke all on public.qr_acessos from anon, authenticated;
grant select on public.qr_acessos to authenticated;
create policy "qr_acessos: tutor vê os dos seus links"
  on public.qr_acessos for select to authenticated
  using (exists (select 1 from public.qr_links q where q.id = qr_link_id and q.tutor_id = auth.uid()));

-- Função para gerar o hash do IP (não guarda IP bruto).
create or replace function public.hash_ip(p_ip text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(digest(p_ip || current_setting('app.secret_key', true), 'sha256'), 'hex')
$$;

-- Gera o link do QR. p_secoes: chaves permitidas (identidade, saude, contato, procurado).
create or replace function public.criar_link_qr(
  p_pet uuid,
  p_secoes text[],
  p_expira_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_tutor profiles;
  v_secoes text[];
  v_conteudo jsonb;
  v_codigo text;
  v_expira timestamptz;
  v_peso_atual numeric;
  v_ultimo_peso timestamptz;
  v_vacinas jsonb;
  v_vermifugos jsonb;
  v_remedios jsonb;
  v_alergias text;
  v_castrado boolean;
  v_veterinario text;
  v_telefone_tutor text;
  v_whatsapp_tutor boolean;
begin
  -- Verifica se o pet pertence ao tutor e está ativo.
  select * into v_pet from pets where id = p_pet and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  -- Limite de links por dia (anti-abuso).
  if (select count(*) from qr_links where tutor_id = auth.uid() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Muitos links hoje. Tente de novo amanhã.' using errcode = '42501';
  end if;

  -- Valida e normaliza as seções solicitadas.
  select array_agg(distinct s) into v_secoes
  from unnest(coalesce(p_secoes, '{}')) s
  where s in ('identidade', 'saude', 'contato', 'procurado');
  v_secoes := coalesce(v_secoes, '{}');

  select * into v_tutor from profiles where id = auth.uid();

  -- Dados base: identidade sempre incluída se solicitada.
  v_conteudo := jsonb_build_object('nome', v_pet.nome, 'especie', v_pet.especie, 'foto_url', v_pet.foto_url);

  if 'identidade' = any (v_secoes) then
    -- Raça, idade/porte, sexo.
    select max(peso) into v_peso_atual from weights where pet_id = v_pet.id;
    select max(medido_em) into v_ultimo_peso from weights where pet_id = v_pet.id;
    v_conteudo := v_conteudo || jsonb_build_object(
      'raca', v_pet.raca,
      'nascimento', v_pet.nascimento,
      'sexo', v_pet.sexo,
      'peso', v_peso_atual,
      'peso_em', v_ultimo_peso
    );
  end if;

  if 'saude' = any (v_secoes) then
    -- Alergias/condições (em destaque).
    v_alergias := v_pet.alergias;
    -- Vacinas e vermífugo (resumo: em dia ou X atrasada(s)).
    v_vacinas := coalesce((
      select jsonb_agg(jsonb_build_object('nome', v.nome, 'aplicada_em', v.aplicada_em, 'proxima_dose', v.proxima_dose)
        order by v.aplicada_em desc)
      from vaccinations v where v.pet_id = v_pet.id
    ), '[]'::jsonb);
    v_vermifugos := coalesce((
      select jsonb_agg(jsonb_build_object('produto', d.produto, 'aplicado_em', d.aplicado_em, 'proxima_dose', d.proxima_dose)
        order by d.aplicado_em desc)
      from (select * from dewormings where pet_id = v_pet.id order by aplicado_em desc limit 3) d
    ), '[]'::jsonb);
    -- Remédios em uso (nome + dose).
    v_remedios := coalesce((
      select jsonb_agg(jsonb_build_object('nome', m.nome, 'dose', m.dose, 'frequencia', m.frequencia, 'horarios', m.horarios, 'fim', m.fim)
        order by m.inicio desc)
      from medications m
      where m.pet_id = v_pet.id and m.ativo and m.inicio <= current_date and (m.fim is null or m.fim >= current_date)
    ), '[]'::jsonb);
    v_castrado := v_pet.castrado;
    v_veterinario := v_pet.veterinario;

    v_conteudo := v_conteudo || jsonb_build_object(
      'alergias', v_alergias,
      'vacinas', v_vacinas,
      'vermifugos', v_vermifugos,
      'remedios', v_remedios,
      'castrado', v_castrado,
      'veterinario', v_veterinario
    );
  end if;

  if 'contato' = any (v_secoes) then
    v_telefone_tutor := v_tutor.telefone;
    -- WhatsApp é true se o tutor tem telefone e não desativou.
    v_whatsapp_tutor := v_tutor.telefone is not null and v_tutor.telefone ~ '^\s*\+?55\s*\d{2}\s*9\d{4}[-\s]?\d{4}\s*$';
    v_conteudo := v_conteudo || jsonb_build_object(
      'tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', v_telefone_tutor, 'whatsapp', v_whatsapp_tutor)
    );
  end if;

  if 'procurado' = any (v_secoes) then
    -- Dados extras para o alerta "pet procurado" (serão preenchidos pelo tutor na tela).
    -- último_lugar_visto, tempo_desaparecido, cor, porte, recado_tutor
    v_conteudo := v_conteudo || jsonb_build_object(
      'ultimo_lugar_visto', null,
      'tempo_desaparecido', null,
      'cor', null,
      'porte', null,
      'recado_tutor', null
    );
  end if;

  -- Gera código curto e único (base64url de 12 bytes = ~16 chars).
  v_codigo := translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/', '-_');
  v_expira := coalesce(p_expira_em, now() + interval '1 year'); -- QR da coleira dura mais (padrão 1 ano).

  insert into qr_links (codigo, pet_id, tutor_id, secoes, conteudo, expira_em)
  values (v_codigo, v_pet.id, auth.uid(), v_secoes, v_conteudo, v_expira);

  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira);
end;
$$;

-- Cancela/revoga o link do QR.
create or replace function public.cancelar_link_qr(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update qr_links set cancelado_em = now()
  where id = p_id and tutor_id = auth.uid() and cancelado_em is null;
$$;

-- Atualiza o conteúdo do link (ex.: quando tutor edita "o que aparece no QR" ou ativa alerta de procurado).
create or replace function public.atualizar_link_qr(p_id uuid, p_secoes text[], p_conteudo_extra jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link qr_links;
  v_pet pets;
  v_tutor profiles;
  v_secoes text[];
  v_conteudo jsonb;
  v_peso_atual numeric;
  v_ultimo_peso timestamptz;
  v_vacinas jsonb;
  v_vermifugos jsonb;
  v_remedios jsonb;
  v_alergias text;
  v_castrado boolean;
  v_veterinario text;
  v_telefone_tutor text;
  v_whatsapp_tutor boolean;
begin
  select * into v_link from qr_links where id = p_id and tutor_id = auth.uid() and cancelado_em is null;
  if v_link.id is null then
    raise exception 'Link não encontrado ou já cancelado.' using errcode = '42501';
  end if;

  select * into v_pet from pets where id = v_link.pet_id and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;

  select * into v_tutor from profiles where id = auth.uid();

  select array_agg(distinct s) into v_secoes
  from unnest(coalesce(p_secoes, '{}')) s
  where s in ('identidade', 'saude', 'contato', 'procurado');
  v_secoes := coalesce(v_secoes, '{}');

  v_conteudo := jsonb_build_object('nome', v_pet.nome, 'especie', v_pet.especie, 'foto_url', v_pet.foto_url);

  if 'identidade' = any (v_secoes) then
    select max(peso) into v_peso_atual from weights where pet_id = v_pet.id;
    select max(medido_em) into v_ultimo_peso from weights where pet_id = v_pet.id;
    v_conteudo := v_conteudo || jsonb_build_object(
      'raca', v_pet.raca,
      'nascimento', v_pet.nascimento,
      'sexo', v_pet.sexo,
      'peso', v_peso_atual,
      'peso_em', v_ultimo_peso
    );
  end if;

  if 'saude' = any (v_secoes) then
    v_alergias := v_pet.alergias;
    v_vacinas := coalesce((
      select jsonb_agg(jsonb_build_object('nome', v.nome, 'aplicada_em', v.aplicada_em, 'proxima_dose', v.proxima_dose)
        order by v.aplicada_em desc)
      from vaccinations v where v.pet_id = v_pet.id
    ), '[]'::jsonb);
    v_vermifugos := coalesce((
      select jsonb_agg(jsonb_build_object('produto', d.produto, 'aplicado_em', d.aplicado_em, 'proxima_dose', d.proxima_dose)
        order by d.aplicado_em desc)
      from (select * from dewormings where pet_id = v_pet.id order by aplicado_em desc limit 3) d
    ), '[]'::jsonb);
    v_remedios := coalesce((
      select jsonb_agg(jsonb_build_object('nome', m.nome, 'dose', m.dose, 'frequencia', m.frequencia, 'horarios', m.horarios, 'fim', m.fim)
        order by m.inicio desc)
      from medications m
      where m.pet_id = v_pet.id and m.ativo and m.inicio <= current_date and (m.fim is null or m.fim >= current_date)
    ), '[]'::jsonb);
    v_castrado := v_pet.castrado;
    v_veterinario := v_pet.veterinario;

    v_conteudo := v_conteudo || jsonb_build_object(
      'alergias', v_alergias,
      'vacinas', v_vacinas,
      'vermifugos', v_vermifugos,
      'remedios', v_remedios,
      'castrado', v_castrado,
      'veterinario', v_veterinario
    );
  end if;

  if 'contato' = any (v_secoes) then
    v_telefone_tutor := v_tutor.telefone;
    v_whatsapp_tutor := v_tutor.telefone is not null and v_tutor.telefone ~ '^\s*\+?55\s*\d{2}\s*9\d{4}[-\s]?\d{4}\s*$';
    v_conteudo := v_conteudo || jsonb_build_object(
      'tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', v_telefone_tutor, 'whatsapp', v_whatsapp_tutor)
    );
  end if;

  if 'procurado' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'ultimo_lugar_visto', coalesce(p_conteudo_extra ->> 'ultimo_lugar_visto', v_link.conteudo ->> 'ultimo_lugar_visto'),
      'tempo_desaparecido', coalesce(p_conteudo_extra ->> 'tempo_desaparecido', v_link.conteudo ->> 'tempo_desaparecido'),
      'cor', coalesce(p_conteudo_extra ->> 'cor', v_link.conteudo ->> 'cor'),
      'porte', coalesce(p_conteudo_extra ->> 'porte', v_link.conteudo ->> 'porte'),
      'recado_tutor', coalesce(p_conteudo_extra ->> 'recado_tutor', v_link.conteudo ->> 'recado_tutor')
    );
  end if;

  update qr_links
  set secoes = v_secoes, conteudo = v_conteudo
  where id = p_id;
end;
$$;

-- ============================================================
-- RPC PÚBLICA: o que a página /r/[codigo] consome.
-- ============================================================
create or replace function public.qr_publica(p_codigo text, p_ip_hash text default null, p_user_agent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link qr_links;
  v_agora timestamptz := now();
  v_tutor profiles;
  v_procurado_ativo boolean := false;
begin
  -- Busca o link válido (não cancelado, não expirado).
  update qr_links
  set aberturas = aberturas + 1,
      ultima_abertura_em = v_agora,
      ultima_abertura_ip_hash = p_ip_hash
  where codigo = p_codigo
    and cancelado_em is null
    and (expira_em is null or expira_em > v_agora)
  returning * into v_link;

  if v_link.id is null then
    return jsonb_build_object('valido', false);
  end if;

  -- Registra o acesso (para auditoria e limite por IP/hora).
  insert into qr_acessos (qr_link_id, ip_hash, user_agent)
  values (v_link.id, p_ip_hash, p_user_agent);

  -- Verifica se é "pet procurado" (tem seção procurado E dados preenchidos).
  v_procurado_ativo := 'procurado' = any (v_link.secoes)
    and (v_link.conteudo ->> 'ultimo_lugar_visto') is not null
    and (v_link.conteudo ->> 'tempo_desaparecido') is not null;

  select * into v_tutor from profiles where id = v_link.tutor_id;

  -- Dispara push para o tutor (uma vez por sessão de acesso: se não abriu na última hora).
  if not exists (
    select 1 from qr_acessos
    where qr_link_id = v_link.id
      and ip_hash = p_ip_hash
      and criado_em > v_agora - interval '1 hour'
      and id != (select max(id) from qr_acessos where qr_link_id = v_link.id)
  ) then
    perform public.avisar_tutor(
      v_link.tutor_id,
      v_link.pet_id,
      'qr_aberto',
      'Alguém abriu o QR do ' || v_link.conteudo ->> 'nome',
      'A página pública do QR foi acessada agora.',
      '/qr/' || p_codigo
    );
  end if;

  return jsonb_build_object(
    'valido', true,
    'tipo', case when v_procurado_ativo then 'procurado' else 'normal' end,
    'pet', v_link.conteudo,
    'tutor', jsonb_build_object(
      'nome', v_tutor.nome,
      'telefone', case when 'contato' = any (v_link.secoes) then v_tutor.telefone end,
      'whatsapp', case when 'contato' = any (v_link.secoes) then (v_link.conteudo -> 'tutor' ->> 'whatsapp')::boolean end
    ),
    'expira_em', v_link.expira_em
  );
end;
$$;

-- ============================================================
-- RPC: Enviar localização do visitante (botão "Enviar minha localização").
-- ============================================================
create or replace function public.qr_enviar_localizacao(
  p_codigo text,
  p_lat double precision,
  p_lng double precision,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link qr_links;
  v_pet pets;
  v_tutor profiles;
  v_mensagem text;
begin
  select * into v_link from qr_links
  where codigo = p_codigo
    and cancelado_em is null
    and (expira_em is null or expira_em > now());

  if v_link.id is null then
    raise exception 'Link inválido ou expirado.' using errcode = '42501';
  end if;

  -- Limite de envios por IP/hora (anti-abuso).
  if (select count(*) from qr_acessos
      where qr_link_id = v_link.id
        and ip_hash = p_ip_hash
        and criado_em > now() - interval '1 hour') > 10 then
    raise exception 'Muitos envios. Tente novamente mais tarde.' using errcode = '42501';
  end if;

  select * into v_pet from pets where id = v_link.pet_id;
  select * into v_tutor from profiles where id = v_link.tutor_id;

  -- Registra o envio de localização.
  insert into qr_acessos (qr_link_id, ip_hash, user_agent, criado_em)
  values (v_link.id, p_ip_hash, 'localizacao:' || p_lat || ',' || p_lng, now());

  -- Prepara mensagem para o tutor.
  if 'procurado' = any (v_link.secoes) and (v_link.conteudo ->> 'ultimo_lugar_visto') is not null then
    v_mensagem := 'Alguém viu o ' || v_pet.nome || ' e enviou a localização atual.';
  else
    v_mensagem := 'Alguém encontrou o ' || v_pet.nome || ' e enviou a localização.';
  end if;

  -- Dispara push para o tutor com a localização.
  perform public.avisar_tutor(
    v_link.tutor_id,
    v_link.pet_id,
    'qr_localizacao',
    'Localização recebida: ' || v_pet.nome,
    v_mensagem || ' Coordenadas: ' || p_lat || ',' || p_lng,
    'https://maps.google.com/?q=' || p_lat || ',' || p_lng
  );

  return jsonb_build_object('ok', true, 'mensagem', 'Localização enviada ao tutor.');
end;
$$;

-- Permissões: anon pode chamar as funções públicas.
revoke all on function public.criar_link_qr(uuid, text[], timestamptz) from public, anon;
revoke all on function public.cancelar_link_qr(uuid) from public, anon;
revoke all on function public.atualizar_link_qr(uuid, text[], jsonb) from public, anon;
revoke all on function public.qr_publica(text, text, text) from public;
revoke all on function public.qr_enviar_localizacao(text, double precision, double precision, text) from public;

grant execute on function public.criar_link_qr(uuid, text[], timestamptz) to authenticated;
grant execute on function public.cancelar_link_qr(uuid) to authenticated;
grant execute on function public.atualizar_link_qr(uuid, text[], jsonb) to authenticated;
grant execute on function public.qr_publica(text, text, text) to anon, authenticated;
grant execute on function public.qr_enviar_localizacao(text, double precision, double precision, text) to anon, authenticated;
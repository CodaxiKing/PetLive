-- PetLive: compartilhar a carteirinha por link (BUSINESS.md 5.37 e a seção
-- "O que incluir ao compartilhar"). O tutor escolhe o que vai, o servidor
-- monta uma foto desses dados e devolve um link temporário, sem login, que
-- abre a página pública /ficha/[codigo] do site.

-- Campos da carteirinha que o tutor escreve (texto livre).
alter table public.pets
  add column alergias text check (char_length(alergias) <= 500),
  add column veterinario text check (char_length(veterinario) <= 300),
  add column observacoes text check (char_length(observacoes) <= 1000);

create table public.carteirinha_links (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  secoes text[] not null,
  -- Foto dos dados no momento em que o link foi gerado: quem abre vê isto,
  -- e só isto (mudanças depois não vazam por um link antigo).
  conteudo jsonb not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  cancelado_em timestamptz,
  aberturas int not null default 0,
  ultima_abertura_em timestamptz
);
create index carteirinha_links_pet on public.carteirinha_links (pet_id, criado_em desc);
comment on table public.carteirinha_links is 'Links temporários da carteirinha do pet (sem login).';

alter table public.carteirinha_links enable row level security;
revoke all on public.carteirinha_links from anon, authenticated;
-- O tutor vê os próprios links (o conteúdo fica de fora: ele já tem os dados).
grant select (id, codigo, pet_id, secoes, criado_em, expira_em, cancelado_em, aberturas, ultima_abertura_em)
  on public.carteirinha_links to authenticated;
create policy "carteirinha_links: tutor vê os seus"
  on public.carteirinha_links for select to authenticated
  using (tutor_id = auth.uid());

/**
 * Gera o link. p_secoes: dados, vacinas, alergias, remedios, saude,
 * veterinario, observacoes, telefone. O nome e a espécie vão sempre.
 */
create or replace function public.criar_link_carteirinha(p_pet uuid, p_secoes text[], p_horas int default 24)
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
begin
  select * into v_pet from pets where id = p_pet and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  if (select count(*) from carteirinha_links where tutor_id = auth.uid() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Muitos links hoje. Tente de novo amanhã.';
  end if;
  select array_agg(distinct s) into v_secoes from unnest(coalesce(p_secoes, '{}')) s
  where s in ('dados', 'vacinas', 'alergias', 'remedios', 'saude', 'veterinario', 'observacoes', 'telefone');
  v_secoes := coalesce(v_secoes, '{}');
  select * into v_tutor from profiles where id = auth.uid();

  v_conteudo := jsonb_build_object('nome', v_pet.nome, 'especie', v_pet.especie, 'foto_url', v_pet.foto_url);
  if 'dados' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'raca', v_pet.raca, 'nascimento', v_pet.nascimento, 'sexo', v_pet.sexo, 'peso', v_pet.peso_atual,
      'peso_em', (select max(medido_em) from weights where pet_id = v_pet.id)
    );
  end if;
  if 'vacinas' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'vacinas', coalesce((
        select jsonb_agg(jsonb_build_object('nome', nome, 'aplicada_em', aplicada_em, 'proxima_dose', proxima_dose)
          order by aplicada_em desc)
        from vaccinations where pet_id = v_pet.id
      ), '[]'::jsonb),
      'vermifugos', coalesce((
        select jsonb_agg(jsonb_build_object('produto', produto, 'aplicado_em', aplicado_em, 'proxima_dose', proxima_dose)
          order by aplicado_em desc)
        from (select * from dewormings where pet_id = v_pet.id order by aplicado_em desc limit 3) d
      ), '[]'::jsonb)
    );
  end if;
  if 'alergias' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('alergias', v_pet.alergias);
  end if;
  if 'remedios' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('remedios', coalesce((
      select jsonb_agg(jsonb_build_object('nome', nome, 'dose', dose, 'frequencia', frequencia, 'horarios', horarios, 'fim', fim)
        order by inicio desc)
      from medications
      where pet_id = v_pet.id and ativo and inicio <= current_date and (fim is null or fim >= current_date)
    ), '[]'::jsonb));
  end if;
  if 'saude' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('castrado', v_pet.castrado);
  end if;
  if 'veterinario' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('veterinario', v_pet.veterinario);
  end if;
  if 'observacoes' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('observacoes', v_pet.observacoes);
  end if;
  if 'telefone' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', v_tutor.telefone));
  end if;

  v_codigo := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  v_expira := now() + make_interval(hours => least(greatest(coalesce(p_horas, 24), 1), 72));
  insert into carteirinha_links (codigo, pet_id, tutor_id, secoes, conteudo, expira_em)
  values (v_codigo, v_pet.id, auth.uid(), v_secoes, v_conteudo, v_expira);
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira);
end;
$$;

create or replace function public.cancelar_link_carteirinha(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update carteirinha_links set cancelado_em = now()
  where id = p_id and tutor_id = auth.uid() and cancelado_em is null;
$$;

/**
 * O que a página pública mostra. Link vencido, cancelado ou inexistente:
 * nenhum dado do pet, nem o nome. Cada abertura válida conta.
 */
create or replace function public.carteirinha_publica(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link carteirinha_links;
begin
  update carteirinha_links set aberturas = aberturas + 1, ultima_abertura_em = now()
  where codigo = p_codigo and cancelado_em is null and expira_em > now()
  returning * into v_link;
  if v_link.id is null then
    return jsonb_build_object('valido', false);
  end if;
  return jsonb_build_object(
    'valido', true, 'conteudo', v_link.conteudo, 'secoes', to_jsonb(v_link.secoes),
    'criado_em', v_link.criado_em, 'expira_em', v_link.expira_em
  );
end;
$$;

revoke all on function public.criar_link_carteirinha(uuid, text[], int) from public, anon;
revoke all on function public.cancelar_link_carteirinha(uuid) from public, anon;
revoke all on function public.carteirinha_publica(text) from public;
grant execute on function public.criar_link_carteirinha(uuid, text[], int) to authenticated;
grant execute on function public.cancelar_link_carteirinha(uuid) to authenticated;
grant execute on function public.carteirinha_publica(text) to anon, authenticated;

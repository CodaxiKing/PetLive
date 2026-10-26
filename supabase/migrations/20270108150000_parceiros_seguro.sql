-- Plano e seguro pet com parceiros (BUSINESS.md 5.30): o admin cadastra os
-- parceiros; o app lista os ativos e Cotar leva ao site do parceiro. O PetLive
-- não vende nem garante o plano. Cada clique fica registrado para a comissão.

create table if not exists public.insurance_partners (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  tipo text not null default 'plano' check (tipo in ('plano', 'seguro')),
  beneficios text not null check (char_length(beneficios) between 2 and 240),
  preco_texto text check (char_length(preco_texto) <= 60),
  url text not null check (url ~ '^https://'),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  ordem int not null default 100,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.insurance_partners enable row level security;
revoke all on public.insurance_partners from public, anon, authenticated;
grant select on public.insurance_partners to authenticated;
drop policy if exists insurance_partners_ativos on public.insurance_partners;
create policy insurance_partners_ativos on public.insurance_partners for select to authenticated using (ativo);

create table if not exists public.insurance_clicks (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.insurance_partners(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists insurance_clicks_partner on public.insurance_clicks (partner_id, criado_em);
alter table public.insurance_clicks enable row level security;
revoke all on public.insurance_clicks from public, anon, authenticated;

-- Cotar: registra o clique (no máximo 1 por pessoa e parceiro a cada hora) e devolve o link.
create or replace function public.parceiro_cotar(p_partner uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select url into v_url from insurance_partners where id = p_partner and ativo;
  if v_url is null then raise exception 'Este parceiro não está mais disponível.' using errcode = '22023'; end if;
  if not exists (select 1 from insurance_clicks where partner_id = p_partner and user_id = auth.uid() and criado_em > now() - interval '1 hour') then
    insert into insurance_clicks (partner_id, user_id) values (p_partner, auth.uid());
  end if;
  return v_url;
end;
$$;

create or replace function public.admin_parceiros()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['marketing', 'financeiro', 'leitura']);
  return coalesce((
    select jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'cliques_30d', (select count(*) from insurance_clicks c where c.partner_id = p.id and c.criado_em > now() - interval '30 days'))
      order by p.ordem, p.nome)
    from insurance_partners p), '[]'::jsonb);
end;
$$;

create or replace function public.admin_parceiro_salvar(p_id uuid, p_nome text, p_tipo text, p_beneficios text, p_preco text, p_url text, p_ordem int, p_ativo boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.admin_exigir(array['marketing']);
  if coalesce(p_url, '') !~ '^https://' then raise exception 'Use o link do parceiro (https://).'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome do parceiro.'; end if;
  if char_length(trim(coalesce(p_beneficios, ''))) < 2 then raise exception 'Descreva os benefícios.'; end if;
  if p_id is null then
    insert into insurance_partners (nome, tipo, beneficios, preco_texto, url, ordem, ativo)
    values (trim(p_nome), coalesce(p_tipo, 'plano'), trim(p_beneficios), nullif(trim(coalesce(p_preco, '')), ''), trim(p_url), coalesce(p_ordem, 100), coalesce(p_ativo, true))
    returning id into v_id;
  else
    update insurance_partners set nome = trim(p_nome), tipo = coalesce(p_tipo, tipo), beneficios = trim(p_beneficios),
      preco_texto = nullif(trim(coalesce(p_preco, '')), ''), url = trim(p_url), ordem = coalesce(p_ordem, ordem),
      ativo = coalesce(p_ativo, ativo), atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Parceiro não encontrado.'; end if;
  end if;
  perform public.admin_registrar('editou parceiro de plano e seguro', 'insurance_partners', v_id::text, jsonb_build_object('nome', trim(p_nome), 'ativo', coalesce(p_ativo, true)));
  return v_id;
end;
$$;

revoke all on function public.parceiro_cotar(uuid) from public, anon;
revoke all on function public.admin_parceiros() from public, anon;
revoke all on function public.admin_parceiro_salvar(uuid, text, text, text, text, text, int, boolean) from public, anon;
grant execute on function public.parceiro_cotar(uuid) to authenticated;
grant execute on function public.admin_parceiros() to authenticated;
grant execute on function public.admin_parceiro_salvar(uuid, text, text, text, text, text, int, boolean) to authenticated;

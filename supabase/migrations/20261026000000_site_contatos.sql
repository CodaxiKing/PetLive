-- PetLive: mensagens do site (formulário de contato e interesse de lojistas).
-- O site é público: grava só pela função registrar_contato_site, que valida,
-- descarta robôs (campo isca) e limita por e-mail e por dia. Ninguém lê pela
-- API; a equipe lê no painel do Supabase (e no painel admin, Fase 2).

create table if not exists public.site_contacts (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('contato', 'lojista')),
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  telefone text check (char_length(telefone) <= 30),
  mensagem text check (char_length(mensagem) <= 2000),
  -- Só no interesse de lojistas.
  loja_nome text check (char_length(loja_nome) <= 120),
  loja_tipo text check (loja_tipo in ('petshop', 'clinica', 'banho_tosa', 'passeador', 'creche', 'hotelzinho', 'outro')),
  cidade text check (char_length(cidade) <= 120),
  criado_em timestamptz not null default now()
);

create index if not exists site_contacts_email_dia on public.site_contacts (lower(email), criado_em);

alter table public.site_contacts enable row level security;
-- Sem políticas: anon e authenticated não leem nem gravam direto.

create or replace function public.registrar_contato_site(
  p_tipo text,
  p_nome text,
  p_email text,
  p_telefone text default null,
  p_mensagem text default null,
  p_loja_nome text default null,
  p_loja_tipo text default null,
  p_cidade text default null,
  p_isca text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nome text := trim(coalesce(p_nome, ''));
begin
  -- Robô preencheu o campo escondido: finge que deu certo e não grava.
  if coalesce(trim(p_isca), '') <> '' then
    return 'ok';
  end if;

  if p_tipo not in ('contato', 'lojista') then
    raise exception 'tipo inválido' using errcode = '22023';
  end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    raise exception 'nome inválido' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if p_tipo = 'contato' and char_length(trim(coalesce(p_mensagem, ''))) < 5 then
    raise exception 'mensagem muito curta' using errcode = '22023';
  end if;

  -- Limites: 3 por e-mail por dia e 500 no total por dia.
  if (select count(*) from site_contacts
      where lower(email) = v_email and criado_em > now() - interval '1 day') >= 3 then
    return 'limite';
  end if;
  if (select count(*) from site_contacts where criado_em > now() - interval '1 day') >= 500 then
    return 'limite';
  end if;

  insert into site_contacts (tipo, nome, email, telefone, mensagem, loja_nome, loja_tipo, cidade)
  values (
    p_tipo,
    v_nome,
    v_email,
    nullif(left(trim(coalesce(p_telefone, '')), 30), ''),
    nullif(left(trim(coalesce(p_mensagem, '')), 2000), ''),
    nullif(left(trim(coalesce(p_loja_nome, '')), 120), ''),
    nullif(p_loja_tipo, ''),
    nullif(left(trim(coalesce(p_cidade, '')), 120), '')
  );
  return 'ok';
end;
$$;

revoke all on function public.registrar_contato_site(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_contato_site(text, text, text, text, text, text, text, text, text) to anon, authenticated;

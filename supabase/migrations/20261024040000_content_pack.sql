-- PetLive: pacote versionado de conteúdo offline (BUSINESS.md 5.18 e 5.20).
-- Tarefa: [BACKEND] "SOS: Função content-pack: pacote versionado de
-- emergência e calculadoras".
--
-- O app já vem com a versão 1 do conteúdo. Quando o conteúdo mestre publica
-- uma versão maior (sempre com revisão veterinária, no caso da emergência),
-- o app baixa em segundo plano e guarda no aparelho.

create table public.content_packs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('emergencia', 'calculadoras')),
  versao int not null check (versao > 0),
  conteudo jsonb not null,
  -- Revisão veterinária: obrigatória para publicar o pacote de emergência.
  revisado_por text,
  crmv text,
  revisado_em timestamptz,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (tipo, versao),
  constraint content_packs_emergencia_revisada check (
    tipo <> 'emergencia' or not publicado
    or (revisado_por is not null and crmv is not null and revisado_em is not null)
  )
);

comment on table public.content_packs is
  'Pacotes de conteúdo offline (emergência, tabelas das calculadoras), versionados.';

alter table public.content_packs enable row level security;
-- Sem policies: a leitura é só pela função abaixo; a escrita, pelo admin (service_role).

/**
 * content-pack: o pacote publicado mais novo do tipo, só quando for maior que
 * a versão que o aparelho já tem (senão null, e o app não baixa nada).
 */
create or replace function public.content_pack(p_tipo text, p_versao_atual int default 0)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'versao', c.versao,
    'revisao', case when c.revisado_por is null then null else jsonb_build_object(
      'veterinario', c.revisado_por, 'crmv', c.crmv, 'em', c.revisado_em
    ) end,
    'conteudo', c.conteudo
  )
  from public.content_packs c
  where c.tipo = p_tipo and c.publicado and c.versao > coalesce(p_versao_atual, 0)
  order by c.versao desc
  limit 1
$$;

-- O conteúdo de emergência não é sensível; o app consulta mesmo deslogado.
grant execute on function public.content_pack(text, int) to anon, authenticated;

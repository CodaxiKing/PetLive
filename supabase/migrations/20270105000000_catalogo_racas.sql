begin;
create table if not exists public.catalogo_racas (
  id uuid primary key default gen_random_uuid(),
  especie text not null check(especie in ('cao','gato')),
  nome text not null check(char_length(btrim(nome)) between 2 and 80),
  ativo boolean not null default true,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now()
);
create unique index if not exists catalogo_racas_nome on public.catalogo_racas(especie,lower(btrim(nome)));
alter table public.catalogo_racas enable row level security;
revoke all on public.catalogo_racas from public,anon,authenticated;
grant all on public.catalogo_racas to service_role;
insert into public.catalogo_racas(especie,nome) values
 ('cao','SRD'),('cao','Labrador'),('cao','Shih-tzu'),('cao','Poodle'),('cao','Golden Retriever'),
 ('gato','SRD'),('gato','Siamês'),('gato','Persa'),('gato','Maine Coon') on conflict do nothing;

create or replace function public.racas_sugerir(p_especie text,p_busca text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
  if p_especie is null or p_especie not in ('cao','gato') or char_length(coalesce(p_busca,''))>80 then
    raise exception 'Consulta inválida.' using errcode='22023';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome,id)
    from (select id,nome from catalogo_racas where ativo and especie=p_especie
      and position(lower(btrim(coalesce(p_busca,''))) in lower(nome))>0 order by nome,id limit 8) r),'[]'::jsonb);
end;
$$;

create or replace function public.admin_racas(p_busca text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  perform public.admin_exigir(array['financeiro','suporte','moderacao','marketing','leitura']);
  if p_pagina is null or p_pagina<0 or p_pagina>100000 or char_length(coalesce(p_busca,''))>80 then
    raise exception 'Consulta inválida.' using errcode='22023'; end if;
  return (with filtradas as (select * from catalogo_racas where
    position(lower(btrim(coalesce(p_busca,''))) in lower(nome))>0),
    pagina as (select * from filtradas order by especie,nome,id limit 50 offset p_pagina*50)
    select jsonb_build_object('total',(select count(*) from filtradas),
      'itens',coalesce((select jsonb_agg(to_jsonb(p) order by especie,nome,id) from pagina p),'[]'::jsonb)));
end;
$$;

create or replace function public.admin_raca_salvar(p_id uuid,p_versao integer,p_especie text,p_nome text,p_ativo boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_antes public.catalogo_racas; v_depois public.catalogo_racas;
begin
  perform public.admin_exigir(array[]::text[]);
  if p_especie is null or p_especie not in ('cao','gato') or p_nome is null
    or char_length(btrim(p_nome)) not between 2 and 80 or p_ativo is null or p_versao is null then
    raise exception 'Confira espécie e nome (2 a 80 caracteres).' using errcode='22023'; end if;
  if p_id is null then
    if p_versao<>0 then raise exception 'Versão inválida.' using errcode='22023'; end if;
    insert into catalogo_racas(especie,nome,ativo) values(p_especie,btrim(p_nome),p_ativo) returning * into v_depois;
  else
    select * into v_antes from catalogo_racas where id=p_id for update;
    if not found or v_antes.versao<>p_versao then
      raise exception 'Este cadastro mudou. Atualize a lista antes de editar.' using errcode='40001'; end if;
    update catalogo_racas set especie=p_especie,nome=btrim(p_nome),ativo=p_ativo,
      versao=versao+1,atualizado_em=now() where id=p_id returning * into v_depois;
  end if;
  perform public.admin_registrar('raca_salvar','catalogo_racas',v_depois.id::text,
    jsonb_build_object('antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois)));
  return v_depois.id;
exception when unique_violation then
  raise exception 'Essa raça já está cadastrada para a espécie. Busque na lista para editar ou reativar.' using errcode='23505';
end;
$$;
revoke all on function public.racas_sugerir(text,text),public.admin_racas(text,integer),public.admin_raca_salvar(uuid,integer,text,text,boolean) from public,anon;
grant execute on function public.racas_sugerir(text,text),public.admin_racas(text,integer),public.admin_raca_salvar(uuid,integer,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;

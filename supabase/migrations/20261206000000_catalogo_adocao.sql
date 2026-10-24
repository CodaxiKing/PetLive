-- Catálogo de adoção: publicação apenas por backend confiável; favoritos privados.
begin;
create table if not exists public.adocao_ongs (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null check(char_length(btrim(nome)) between 2 and 100),
  cidade text not null check(char_length(btrim(cidade)) between 2 and 80),
  bairro text not null check(char_length(btrim(bairro)) between 2 and 80),
  status text not null default 'pendente' check(status in ('pendente','aprovada','suspensa','recusada')),
  criado_em timestamptz not null default now()
);
create or replace function public.adocao_fotos_validas(p_fotos text[])
returns boolean language sql immutable set search_path='' as $$
  select p_fotos is not null and cardinality(p_fotos)<=6 and coalesce(array_ndims(p_fotos),1)=1
    and not exists(select 1 from unnest(p_fotos) f where f is null or char_length(f)>2048 or f !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$');
$$;
create table if not exists public.adocao_pets (
  id uuid primary key default gen_random_uuid(), ong_id uuid not null references public.adocao_ongs(id) on delete cascade,
  nome text not null check(char_length(btrim(nome)) between 1 and 60),
  especie text not null check(especie in ('cao','gato')),
  nascimento date check(nascimento between date '1900-01-01' and current_date),
  porte text not null check(porte in ('pequeno','medio','grande')),
  sexo text not null check(sexo in ('macho','femea','nao_informado')),
  castrado boolean, vacinado boolean, vermifugado boolean,
  descricao text not null check(char_length(btrim(descricao)) between 1 and 2000),
  fotos text[] not null default '{}' check(public.adocao_fotos_validas(fotos)),
  status text not null default 'rascunho' check(status in ('rascunho','publicado','adotado','oculto')),
  confirmado_em timestamptz not null default now(), criado_em timestamptz not null default now()
);
create index if not exists adocao_pets_catalogo on public.adocao_pets(criado_em desc,id desc) where status='publicado';
create index if not exists adocao_pets_ong on public.adocao_pets(ong_id);
create table if not exists public.adocao_favoritos (
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.adocao_pets(id) on delete cascade,
  criado_em timestamptz not null default now(), primary key(tutor_id,pet_id)
);
-- Reserva o armazenamento privado para a futura tela Tenho interesse.
-- Nenhuma API de envio de contato é exposta nesta entrega.
create table if not exists public.adocao_contatos (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid not null references public.adocao_pets(id) on delete cascade,
  mensagem text not null check(char_length(btrim(mensagem)) between 1 and 1000),
  criado_em timestamptz not null default now()
);
alter table public.adocao_ongs enable row level security;
alter table public.adocao_pets enable row level security;
alter table public.adocao_favoritos enable row level security;
alter table public.adocao_contatos enable row level security;
revoke all on public.adocao_ongs,public.adocao_pets,public.adocao_favoritos,public.adocao_contatos from public,anon,authenticated;
grant all on public.adocao_ongs,public.adocao_pets,public.adocao_favoritos,public.adocao_contatos to service_role;
grant select on public.adocao_ongs,public.adocao_pets,public.adocao_favoritos,public.adocao_contatos to authenticated;
drop policy if exists adocao_ong_propria on public.adocao_ongs;
create policy adocao_ong_propria on public.adocao_ongs for select to authenticated using(responsavel_id=auth.uid());
drop policy if exists adocao_pet_da_ong on public.adocao_pets;
create policy adocao_pet_da_ong on public.adocao_pets for select to authenticated
  using(exists(select 1 from public.adocao_ongs g where g.id=ong_id and g.responsavel_id=auth.uid()));
drop policy if exists adocao_favorito_proprio on public.adocao_favoritos;
create policy adocao_favorito_proprio on public.adocao_favoritos for select to authenticated using(tutor_id=auth.uid());
drop policy if exists adocao_contato_proprio on public.adocao_contatos;
create policy adocao_contato_proprio on public.adocao_contatos for select to authenticated
  using(tutor_id=auth.uid() or exists(select 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.id=pet_id and g.responsavel_id=auth.uid()));

create or replace function public.adocao_pet_visivel(p_pet uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where p.id=p_pet and p.status='publicado' and g.status='aprovada'
      and p.confirmado_em>now()-interval '60 days' and p.confirmado_em<=now());
$$;
revoke all on function public.adocao_pet_visivel(uuid) from public,anon;
grant execute on function public.adocao_pet_visivel(uuid) to authenticated;

create or replace function public.adocao_favoritar(p_tutor uuid,p_pet uuid,p_ativo boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if p_ativo is null then raise exception 'Escolha se deseja favoritar.'; end if;
  if p_ativo then
    if not public.adocao_pet_visivel(p_pet) then raise exception 'Este pet não está disponível para adoção. Atualize a lista.'; end if;
    insert into public.adocao_favoritos(tutor_id,pet_id) values(p_tutor,p_pet) on conflict do nothing;
  else delete from public.adocao_favoritos where tutor_id=p_tutor and pet_id=p_pet;
  end if;
  return p_ativo;
end;
$$;
revoke all on function public.adocao_favoritar(uuid,uuid,boolean) from public,anon;
grant execute on function public.adocao_favoritar(uuid,uuid,boolean) to authenticated;

create or replace function public.adocao_confirmar_pet(p_tutor uuid,p_pet uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  update public.adocao_pets p set confirmado_em=now()
    from public.adocao_ongs g where p.id=p_pet and p.ong_id=g.id and g.responsavel_id=p_tutor
      and g.status='aprovada' and p.status='publicado';
  if not found then raise exception 'Somente a ONG verificada pode confirmar este pet publicado.'; end if;
end;
$$;
revoke all on function public.adocao_confirmar_pet(uuid,uuid) from public,anon;
grant execute on function public.adocao_confirmar_pet(uuid,uuid) to authenticated;

create or replace function public.adocao_listar(p_tutor uuid,p_especie text default null,p_filhote boolean default false,
  p_porte text default null,p_sexo text default null,p_cidade text default null,p_favoritos boolean default false,
  p_antes timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if (p_especie is not null and p_especie not in ('cao','gato')) or (p_porte is not null and p_porte not in ('pequeno','medio','grande'))
    or (p_sexo is not null and p_sexo not in ('macho','femea')) or p_filhote is null or p_favoritos is null
    or char_length(p_cidade)>80 or (p_antes is null)<>(p_antes_id is null) then raise exception 'Filtros inválidos.'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc,t.id desc),'[]'::jsonb) into v_itens from (
    select p.id,p.nome,p.especie,p.nascimento,p.porte,p.sexo,p.castrado,p.vacinado,p.vermifugado,p.descricao,p.fotos,p.criado_em,
      g.nome as ong_nome,g.cidade,g.bairro,(f.pet_id is not null) as favorito
    from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    left join public.adocao_favoritos f on f.pet_id=p.id and f.tutor_id=p_tutor
    where p.status='publicado' and g.status='aprovada' and p.confirmado_em>now()-interval '60 days' and p.confirmado_em<=now()
      and (p_especie is null or p.especie=p_especie) and (p_porte is null or p.porte=p_porte)
      and (p_sexo is null or p.sexo=p_sexo) and (not p_filhote or p.nascimento>=(current_date-interval '1 year')::date)
      and (not p_favoritos or f.pet_id is not null)
      and (nullif(btrim(p_cidade),'') is null or strpos(
        translate(lower(g.cidade),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
        translate(lower(btrim(p_cidade)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'))>0)
      and (p_antes is null or (p.criado_em,p.id)<(p_antes,p_antes_id))
    order by p.criado_em desc,p.id desc limit 21
  ) t;
  return jsonb_build_object('itens',jsonb_path_query_array(v_itens,'$[0 to 19]'),'tem_mais',jsonb_array_length(v_itens)>20);
end;
$$;
revoke all on function public.adocao_listar(uuid,text,boolean,text,text,text,boolean,timestamptz,uuid) from public,anon;
grant execute on function public.adocao_listar(uuid,text,boolean,text,text,text,boolean,timestamptz,uuid) to authenticated;

do $$ begin
  if to_regprocedure('public.exportar_meus_dados_sem_adocao()') is null then
    alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_adocao;
  end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_adocao() from public,anon,authenticated;
create or replace function public.exportar_meus_dados()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  return public.exportar_meus_dados_sem_adocao()||jsonb_build_object(
    'adocao_favoritos',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from public.adocao_favoritos f where tutor_id=auth.uid()),
    'adocao_contatos_enviados',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.adocao_contatos c where tutor_id=auth.uid()),
    'adocao_ongs',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from public.adocao_ongs g where responsavel_id=auth.uid()),
    'adocao_pets_da_ong',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where g.responsavel_id=auth.uid()));
end;
$$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
commit;

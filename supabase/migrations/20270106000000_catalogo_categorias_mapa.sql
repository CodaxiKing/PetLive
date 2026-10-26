begin;
-- Códigos fixos: buscas, ícones e fontes externas continuam usando os mesmos valores.
create table if not exists public.catalogo_categorias_mapa (
 codigo text primary key check(codigo in ('clinica','banho_tosa','petshop','creche','hotelzinho','parque','praia','restaurante','hotel')),
 nome text not null check(char_length(btrim(nome)) between 2 and 32),
 plural text not null check(char_length(btrim(plural)) between 2 and 40),
 versao integer not null default 1,
 atualizado_em timestamptz not null default now()
);
alter table public.catalogo_categorias_mapa enable row level security;
revoke all on public.catalogo_categorias_mapa from public,anon,authenticated;
grant all on public.catalogo_categorias_mapa to service_role;
insert into public.catalogo_categorias_mapa(codigo,nome,plural) values
 ('clinica','Clínica','Clínicas'),('banho_tosa','Banho e tosa','Banho e tosa'),('petshop','Petshop','Petshops'),
 ('creche','Creche','Creches'),('hotelzinho','Hotelzinho','Hotelzinhos'),('parque','Parque','Parques'),
 ('praia','Praia','Praias'),('restaurante','Restaurante','Restaurantes'),('hotel','Hotel','Hotéis') on conflict do nothing;

create or replace function public.categorias_mapa()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'nome',nome,'plural',plural) order by codigo)
 from catalogo_categorias_mapa),'[]'::jsonb);
end;
$$;
create or replace function public.admin_categorias_mapa()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 perform public.admin_exigir(array['financeiro','suporte','moderacao','marketing','leitura']);
 return coalesce((select jsonb_agg(to_jsonb(c) order by codigo) from catalogo_categorias_mapa c),'[]'::jsonb);
end;
$$;
create or replace function public.admin_categoria_mapa_salvar(p_codigo text,p_versao integer,p_nome text,p_plural text)
returns void language plpgsql security definer set search_path=public as $$
declare v_antes public.catalogo_categorias_mapa; v_depois public.catalogo_categorias_mapa;
begin
 perform public.admin_exigir(array[]::text[]);
 if p_nome is null or p_plural is null or char_length(btrim(p_nome)) not between 2 and 32
 or char_length(btrim(p_plural)) not between 2 and 40 then
   raise exception 'Confira os nomes: singular de 2 a 32 e plural de 2 a 40 caracteres.' using errcode='22023'; end if;
 select * into v_antes from catalogo_categorias_mapa where codigo=p_codigo for update;
 if not found then raise exception 'Categoria inexistente.' using errcode='22023'; end if;
 if p_versao is null or p_versao<>v_antes.versao then
   raise exception 'Esta categoria mudou. Atualize a lista antes de editar.' using errcode='40001'; end if;
 update catalogo_categorias_mapa set nome=btrim(p_nome),plural=btrim(p_plural),versao=versao+1,atualizado_em=now()
 where codigo=p_codigo returning * into v_depois;
 perform public.admin_registrar('categoria_mapa_salvar','catalogo_categorias_mapa',p_codigo,
   jsonb_build_object('antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois)));
end;
$$;
revoke all on function public.categorias_mapa(),public.admin_categorias_mapa(),public.admin_categoria_mapa_salvar(text,integer,text,text) from public,anon;
grant execute on function public.categorias_mapa(),public.admin_categorias_mapa(),public.admin_categoria_mapa_salvar(text,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;

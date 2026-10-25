begin;
alter table public.adocao_pets add column if not exists versao integer not null default 1 check(versao>0);
create or replace function public.ong_pet_obter(p_tutor uuid,p_pet uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pet jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  select to_jsonb(p) into v_pet from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where p.id=p_pet and g.responsavel_id=p_tutor and g.status='aprovada';
  if v_pet is null then raise exception 'Pet indisponível para esta ONG aprovada.'; end if;
  return v_pet;
end;
$$;
create or replace function public.ong_pet_salvar(p_tutor uuid,p_pet uuid,p_ong uuid,p_versao integer,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_antigo public.adocao_pets; v_novo public.adocao_pets; v_fotos text[]; v_url text; v_path text; v_status text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if p_pet is null or p_versao is null or p_versao<0 or jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do pet inválidos.'; end if;
  perform 1 from public.adocao_ongs where id=p_ong and responsavel_id=p_tutor and status='aprovada' for share;
  if not found then raise exception 'Somente a ONG responsável e aprovada pode salvar pets.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_pet::text,91212));
  select * into v_antigo from public.adocao_pets where id=p_pet for update;
  if found then
    if v_antigo.ong_id<>p_ong then raise exception 'Pet indisponível para esta ONG aprovada.'; end if;
    if v_antigo.status not in ('rascunho','publicado') then raise exception 'Pets adotados ou ocultos não podem ser editados.'; end if;
    if v_antigo.versao<>p_versao then raise exception 'Este pet foi alterado. Atualize a ficha antes de salvar.'; end if;
  elsif p_versao<>0 then raise exception 'Este pet foi alterado. Atualize a ficha antes de salvar.';
  end if;
  if exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('nome','especie','nascimento','porte','sexo','castrado','vacinado','vermifugado','descricao','fotos','status')) then raise exception 'Dados do pet inválidos.'; end if;
  v_status:=p_dados->>'status';
  if v_status is null or v_status not in ('rascunho','publicado') or jsonb_typeof(p_dados->'fotos') is distinct from 'array' then raise exception 'Dados do pet inválidos.'; end if;
  if exists(select 1 from jsonb_array_elements(p_dados->'fotos') f where jsonb_typeof(f)<>'string') then raise exception 'Fotos inválidas.'; end if;
  select coalesce(array_agg(f),'{}') into v_fotos from jsonb_array_elements_text(p_dados->'fotos') f;
  if not public.adocao_fotos_validas(v_fotos) or cardinality(v_fotos)<>(select count(distinct f) from unnest(v_fotos) f) then raise exception 'Use até seis fotos diferentes.'; end if;
  if v_status='publicado' and cardinality(v_fotos)=0 then raise exception 'Adicione ao menos uma foto antes de publicar.'; end if;
  foreach v_url in array v_fotos loop
    -- Preserva fotos legadas; novas fotos precisam existir no Storage do próprio tutor/pet.
    if not coalesce(v_url=any(v_antigo.fotos),false) then
      v_path:=split_part(v_url,'/storage/v1/object/public/pets/',2);
      if v_path !~ ('^'||p_tutor::text||'/'||p_pet::text||'-[0-9a-f-]{36}\.(jpg|png|webp)$')
        or not exists(select 1 from storage.objects where bucket_id='pets' and name=v_path) then raise exception 'Uma foto não foi confirmada. Envie novamente.'; end if;
    end if;
  end loop;
  v_novo:=jsonb_populate_record(null::public.adocao_pets,p_dados);
  if v_antigo.id is null then
    insert into public.adocao_pets(id,ong_id,nome,especie,nascimento,porte,sexo,castrado,vacinado,vermifugado,descricao,fotos,status,versao)
    values(p_pet,p_ong,btrim(v_novo.nome),v_novo.especie,v_novo.nascimento,v_novo.porte,v_novo.sexo,v_novo.castrado,v_novo.vacinado,v_novo.vermifugado,btrim(v_novo.descricao),v_fotos,v_status,1);
  else
    update public.adocao_pets set nome=btrim(v_novo.nome),especie=v_novo.especie,nascimento=v_novo.nascimento,porte=v_novo.porte,sexo=v_novo.sexo,
      castrado=v_novo.castrado,vacinado=v_novo.vacinado,vermifugado=v_novo.vermifugado,descricao=btrim(v_novo.descricao),fotos=v_fotos,status=v_status,versao=versao+1,
      confirmado_em=case when v_status='publicado' then now() else confirmado_em end where id=p_pet;
  end if;
  return public.ong_pet_obter(p_tutor,p_pet);
end;
$$;
revoke all on function public.ong_pet_obter(uuid,uuid) from public,anon;
revoke all on function public.ong_pet_salvar(uuid,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.ong_pet_obter(uuid,uuid) to authenticated;
grant execute on function public.ong_pet_salvar(uuid,uuid,uuid,integer,jsonb) to authenticated;
-- IDs permitem abrir o formulário para a organização certa, sem expor cadastros alheios.

create or replace function public.ong_pets_listar(p_tutor uuid,p_antes timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if (p_antes is null)<>(p_antes_id is null) then raise exception 'Página inválida.'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc,t.id desc),'[]'::jsonb) into v_itens from (
    select p.id,p.nome,p.status,p.confirmado_em,p.criado_em,g.nome as ong_nome,g.status as ong_status,
      (select count(*) from public.adocao_contatos c where c.pet_id=p.id) as interesses
    from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where g.responsavel_id=p_tutor and (p_antes is null or (p.criado_em,p.id)<(p_antes,p_antes_id))
    order by p.criado_em desc,p.id desc limit 21
  ) t;
  return jsonb_build_object('itens',jsonb_path_query_array(v_itens,'$[0 to 19]'),'tem_mais',jsonb_array_length(v_itens)>20,
    'ongs',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'status',g.status) order by g.criado_em,g.id),'[]'::jsonb)
      from public.adocao_ongs g where g.responsavel_id=p_tutor));
end;
$$;

notify pgrst,'reload schema';
commit;

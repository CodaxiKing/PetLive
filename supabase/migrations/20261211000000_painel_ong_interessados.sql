begin;
create index if not exists adocao_contatos_pet_pagina on public.adocao_contatos(pet_id,criado_em desc,id desc);
drop policy if exists adocao_contato_proprio on public.adocao_contatos;
create policy adocao_contato_proprio on public.adocao_contatos for select to authenticated
  using(tutor_id=auth.uid() or exists(select 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where p.id=pet_id and g.responsavel_id=auth.uid() and g.status='aprovada'));
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
    'ongs',(select coalesce(jsonb_agg(jsonb_build_object('nome',g.nome,'status',g.status) order by g.criado_em,g.id),'[]'::jsonb)
      from public.adocao_ongs g where g.responsavel_id=p_tutor));
end;
$$;
create or replace function public.ong_interesses_listar(p_tutor uuid,p_pet uuid,p_antes timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if (p_antes is null)<>(p_antes_id is null) then raise exception 'Página inválida.'; end if;
  if not exists(select 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.id=p_pet and g.responsavel_id=p_tutor and g.status='aprovada') then
    raise exception 'Somente a ONG responsável e aprovada pode consultar os interessados.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc,t.id desc),'[]'::jsonb) into v_itens from (
    select c.id,c.mensagem,c.email_resposta,c.criado_em from public.adocao_contatos c
    where c.pet_id=p_pet and (p_antes is null or (c.criado_em,c.id)<(p_antes,p_antes_id))
    order by c.criado_em desc,c.id desc limit 21
  ) t;
  return jsonb_build_object('itens',jsonb_path_query_array(v_itens,'$[0 to 19]'),'tem_mais',jsonb_array_length(v_itens)>20);
end;
$$;
create or replace function public.ong_marcar_adotado(p_tutor uuid,p_pet uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  select p.status into v_status from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where p.id=p_pet and g.responsavel_id=p_tutor and g.status='aprovada' for update of p for share of g;
  if not found then raise exception 'Somente a ONG responsável e aprovada pode atualizar este pet.'; end if;
  if v_status='adotado' then return true; end if;
  if v_status<>'publicado' then raise exception 'Somente pets publicados podem ser marcados como adotados.'; end if;
  update public.adocao_pets set status='adotado' where id=p_pet;
  return true;
end;
$$;
create or replace function public.ong_contato_email(p_tutor uuid,p_contato uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_email text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  select c.email_resposta into v_email from public.adocao_contatos c
    join public.adocao_pets p on p.id=c.pet_id join public.adocao_ongs g on g.id=p.ong_id
    where c.id=p_contato and g.responsavel_id=p_tutor and g.status='aprovada';
  if not found or v_email is null then raise exception 'Contato indisponível para resposta.'; end if;
  return v_email;
end;
$$;
revoke all on function public.ong_contato_email(uuid,uuid) from public,anon;
grant execute on function public.ong_contato_email(uuid,uuid) to authenticated;
revoke all on function public.ong_pets_listar(uuid,timestamptz,uuid) from public,anon;
revoke all on function public.ong_interesses_listar(uuid,uuid,timestamptz,uuid) from public,anon;
revoke all on function public.ong_marcar_adotado(uuid,uuid) from public,anon;
grant execute on function public.ong_pets_listar(uuid,timestamptz,uuid) to authenticated;
grant execute on function public.ong_interesses_listar(uuid,uuid,timestamptz,uuid) to authenticated;
grant execute on function public.ong_marcar_adotado(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

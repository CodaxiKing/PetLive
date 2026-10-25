begin;
alter table public.adocao_pets add column if not exists moderacao_motivo text;
alter table public.adocao_pets add column if not exists moderacao_em timestamptz;

create or replace function public.admin_adocao_pet_ocultar(p_id uuid,p_versao integer,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.admin_exigir(array['moderacao']);
 if char_length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then raise exception 'Informe um motivo entre 5 e 500 caracteres.'; end if;
 update public.adocao_pets set status='oculto',versao=versao+1,moderacao_motivo=btrim(p_motivo),moderacao_em=now()
 where id=p_id and status='publicado' and versao=p_versao;
 if not found then raise exception 'O pet mudou. Atualize antes de moderar.'; end if;
 perform public.admin_registrar('adocao_pet_ocultar','adocao_pet',p_id::text,jsonb_build_object('motivo',btrim(p_motivo)));
end; $$;

create or replace function public.admin_adocao_pet_republicar(p_id uuid,p_versao integer,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.adocao_pets; v_ong uuid;
begin
 perform public.admin_exigir(array['moderacao']);
 if char_length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then raise exception 'Informe um motivo entre 5 e 500 caracteres.'; end if;
 select ong_id into v_ong from public.adocao_pets where id=p_id;
 -- Mesma ordem da edição pelo responsável: ONG primeiro, pet depois.
 perform 1 from public.adocao_ongs where id=v_ong and status='aprovada' for share;
 if not found then raise exception 'A ONG precisa estar aprovada para republicar.'; end if;
 select * into p from public.adocao_pets where id=p_id for update;
 if not found or p.ong_id<>v_ong or p.status<>'oculto' or p.versao is distinct from p_versao then raise exception 'O pet mudou. Atualize antes de moderar.'; end if;
 if cardinality(p.fotos)=0 or not public.adocao_fotos_validas(p.fotos) then raise exception 'O anúncio precisa de ao menos uma foto válida.'; end if;
 update public.adocao_pets set status='publicado',versao=versao+1,moderacao_motivo=btrim(p_motivo),moderacao_em=now() where id=p_id;
 -- A confirmação de disponibilidade continua sendo feita pela ONG, não pelo admin.
 perform public.admin_registrar('adocao_pet_republicar','adocao_pet',p_id::text,jsonb_build_object('motivo',btrim(p_motivo)));
end; $$;

create or replace function public.admin_adocao_pets(p_status text default 'publicado',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.admin_exigir(array['moderacao','leitura']);
 if p_status is null or p_status not in ('publicado','oculto') or p_pagina is null or p_pagina<0 or p_pagina>10000 then raise exception 'Filtro inválido.'; end if;
 return jsonb_build_object('total',(select count(*) from public.adocao_pets where status=p_status),
  'itens',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id desc) from (
   select p.id,p.nome,p.especie,p.descricao,p.fotos,p.status,p.versao,p.criado_em,p.confirmado_em,p.moderacao_motivo,p.moderacao_em,
     g.nome as ong_nome,g.status as ong_status
   from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.status=p_status
   order by p.criado_em desc,p.id desc limit 20 offset p_pagina*20
  ) x),'[]'::jsonb));
end; $$;
revoke all on function public.admin_adocao_pet_republicar(uuid,integer,text) from public,anon;
grant execute on function public.admin_adocao_pet_republicar(uuid,integer,text) to authenticated;

create or replace function public.ong_pets_listar(p_tutor uuid,p_antes timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
 if (p_antes is null)<>(p_antes_id is null) then raise exception 'Página inválida.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc,t.id desc),'[]'::jsonb) into v_itens from (
  select p.id,p.nome,p.status,p.confirmado_em,p.criado_em,p.moderacao_motivo,g.nome as ong_nome,g.status as ong_status,
   (select count(*) from public.adocao_contatos c where c.pet_id=p.id) as interesses
  from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
  where g.responsavel_id=p_tutor and (p_antes is null or (p.criado_em,p.id)<(p_antes,p_antes_id))
  order by p.criado_em desc,p.id desc limit 21
 ) t;
 return jsonb_build_object('itens',jsonb_path_query_array(v_itens,'$[0 to 19]'),'tem_mais',jsonb_array_length(v_itens)>20,
  'ongs',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'nome',g.nome,'status',g.status) order by g.criado_em,g.id),'[]'::jsonb)
   from public.adocao_ongs g where g.responsavel_id=p_tutor));
end; $$;
notify pgrst,'reload schema';
commit;

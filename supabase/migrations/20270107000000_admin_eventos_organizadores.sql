begin;
alter table public.organizers add column if not exists verificacao_versao integer not null default 1;

-- Recibo privado: repetir uma publicação após falha de rede não cria outro evento.
create table if not exists public.admin_eventos_pedidos (
 chave uuid primary key,
 admin_id uuid not null references auth.users(id) on delete cascade,
 evento_id uuid not null references public.events(id) on delete cascade,
 parametros jsonb not null
);
alter table public.admin_eventos_pedidos enable row level security;
revoke all on public.admin_eventos_pedidos from public,anon,authenticated;
grant all on public.admin_eventos_pedidos to service_role;

create or replace function public.admin_evento_chave()
returns uuid language plpgsql volatile security definer set search_path=public as $$
begin
 perform public.admin_exigir(array['moderacao']);
 return gen_random_uuid();
end;
$$;

create or replace function public.admin_evento_oficial_criar(p_chave uuid,p_evento jsonb,p_confirmar boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_recibo public.admin_eventos_pedidos;
begin
 perform public.admin_exigir(array['moderacao']);
 if p_confirmar is distinct from true then raise exception 'Confirme a publicação do evento oficial.' using errcode='22023'; end if;
 if p_chave is null or p_evento is null or jsonb_typeof(p_evento)<>'object' then
   raise exception 'Dados de evento inválidos.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_evento) k where k not in
   ('titulo','tipo','descricao','inicio_em','fim_em','local_nome','lat','lng','gratuito','preco_centavos','ingresso_url','vagas'))
 or jsonb_typeof(p_evento->'gratuito') is distinct from 'boolean' then
   raise exception 'Campos de evento inválidos.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
 select * into v_recibo from admin_eventos_pedidos where chave=p_chave;
 if found then
   if v_recibo.admin_id<>auth.uid() or v_recibo.parametros is distinct from p_evento then
     raise exception 'Esta chave já foi usada. Inicie um novo cadastro.' using errcode='22023'; end if;
   return v_recibo.evento_id;
 end if;
 -- Reutiliza as regras vigentes de datas, preço, vagas, local e publicação oficial.
 v_id:=public.evento_criar(
   p_titulo=>p_evento->>'titulo',p_tipo=>p_evento->>'tipo',p_descricao=>p_evento->>'descricao',
   p_inicio_em=>(p_evento->>'inicio_em')::timestamptz,p_fim_em=>(p_evento->>'fim_em')::timestamptz,
   p_local_nome=>p_evento->>'local_nome',p_lat=>(p_evento->>'lat')::double precision,
   p_lng=>(p_evento->>'lng')::double precision,p_gratuito=>(p_evento->>'gratuito')::boolean,
   p_preco_centavos=>(p_evento->>'preco_centavos')::integer,p_ingresso_url=>nullif(p_evento->>'ingresso_url',''),
   p_vagas=>(p_evento->>'vagas')::integer,p_oficial=>true);
 insert into admin_eventos_pedidos values(p_chave,auth.uid(),v_id,p_evento);
 perform public.admin_registrar('evento_oficial_criar','events',v_id::text,
   jsonb_build_object('titulo',p_evento->>'titulo','status','publicado'));
 return v_id;
end;
$$;

create or replace function public.admin_organizadores(p_busca text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 perform public.admin_exigir(array['moderacao','leitura']);
 if p_pagina is null or p_pagina<0 or p_pagina>100000 or char_length(coalesce(p_busca,''))>100 then
   raise exception 'Consulta inválida.' using errcode='22023'; end if;
 return (with candidatos as (
   select user_id from organizers union select criado_por from events where criado_por is not null
 ), base as (
   select p.id,coalesce(o.nome_publico,nullif(btrim(p.nome),''),'Organizador') as nome,
     coalesce(o.verificado,false) as verificado,coalesce(o.verificacao_versao,0) as versao,o.verificado_em,
     (select count(*) from events e where e.criado_por=p.id) as eventos
   from candidatos c join profiles p on p.id=c.user_id left join organizers o on o.user_id=p.id
 ), filtrados as (select * from base where position(lower(btrim(coalesce(p_busca,''))) in lower(nome))>0),
 pagina as (select * from filtrados order by nome,id limit 25 offset p_pagina*25)
 select jsonb_build_object('total',(select count(*) from filtrados),
   'itens',coalesce((select jsonb_agg(to_jsonb(p) order by nome,id) from pagina p),'[]'::jsonb)));
end;
$$;

create or replace function public.admin_organizador_verificar(p_usuario uuid,p_versao integer,p_verificado boolean,p_motivo text,p_confirmar boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare v_antes public.organizers; v_depois public.organizers;
begin
 perform public.admin_exigir(array['moderacao']);
 if p_confirmar is distinct from true or p_usuario is null or p_versao is null or p_verificado is null
   or p_motivo is null or char_length(btrim(p_motivo)) not between 5 and 500 then
   raise exception 'Confirme a decisão e informe um motivo de 5 a 500 caracteres.' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,1));
 select * into v_antes from organizers where user_id=p_usuario for update;
 if not found then
   if p_versao<>0 or not exists(select 1 from events where criado_por=p_usuario) then
     raise exception 'Organizador não encontrado ou alterado. Atualize a lista.' using errcode='40001'; end if;
   insert into organizers(user_id,nome_publico,verificacao_versao)
     select id,case when char_length(btrim(nome))>=2 then left(btrim(nome),100) else 'Organizador' end,0 from profiles where id=p_usuario;
   if not found then raise exception 'Perfil do organizador não encontrado.' using errcode='22023'; end if;
   select * into v_antes from organizers where user_id=p_usuario for update;
 end if;
 if v_antes.verificacao_versao<>p_versao then
   raise exception 'Este organizador mudou. Atualize a lista antes de decidir.' using errcode='40001'; end if;
 if v_antes.verificado=p_verificado then raise exception 'O organizador já está nesse estado.' using errcode='22023'; end if;
 update organizers set verificado=p_verificado,
   verificado_em=case when p_verificado then now() else null end,
   verificado_por=case when p_verificado then auth.uid() else null end,
   verificacao_versao=verificacao_versao+1 where user_id=p_usuario returning * into v_depois;
 perform public.admin_registrar('organizador_verificar','organizers',p_usuario::text,
   jsonb_build_object('antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois),'motivo',btrim(p_motivo)));
end;
$$;
revoke all on function public.admin_evento_chave(),public.admin_evento_oficial_criar(uuid,jsonb,boolean),public.admin_organizadores(text,integer),public.admin_organizador_verificar(uuid,integer,boolean,text,boolean) from public,anon;
grant execute on function public.admin_evento_chave(),public.admin_evento_oficial_criar(uuid,jsonb,boolean),public.admin_organizadores(text,integer),public.admin_organizador_verificar(uuid,integer,boolean,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;

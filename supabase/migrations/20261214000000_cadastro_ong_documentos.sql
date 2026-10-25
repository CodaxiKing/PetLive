begin;
create or replace function public.cnpj_valido(p_cnpj text)
returns boolean language plpgsql immutable set search_path='' as $$
declare v text:=upper(regexp_replace(btrim(p_cnpj),'[./[:space:]-]','','g')); base text; soma integer; dv integer; i integer; etapa integer;
begin
 if v is null or v !~ '^[A-Z0-9]{12}[0-9]{2}$' or v ~ '^([0-9])\1{13}$' then return false; end if;
 base:=left(v,12);
 for etapa in 1..2 loop
  soma:=0;
  for i in 1..char_length(base) loop soma:=soma+(ascii(substr(base,i,1))-48)*((char_length(base)-i)%8+2); end loop;
  dv:=case when soma%11<2 then 0 else 11-soma%11 end;
  if substr(v,12+etapa,1)<>dv::text then return false; end if;
  base:=base||dv::text;
 end loop;
 return true;
end;
$$;
create table if not exists public.ong_cadastros (
 id uuid primary key,
 responsavel_id uuid not null references public.profiles(id) on delete cascade,
 cnpj text not null unique check(public.cnpj_valido(cnpj)),
 nome text not null check(char_length(btrim(nome)) between 2 and 100),
 cidade text not null check(char_length(btrim(cidade)) between 2 and 80),
 bairro text not null check(char_length(btrim(bairro)) between 2 and 80),
 responsavel_nome text not null check(char_length(btrim(responsavel_nome)) between 2 and 100),
 email text not null check(char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 telefone text not null check(telefone ~ '^[0-9]{10,13}$'),
 documentos jsonb not null default '{}' check(jsonb_typeof(documentos)='object'),
 status text not null default 'rascunho' check(status in ('rascunho','enviado')),
 enviado_em timestamptz,
 versao integer not null default 1 check(versao>0),
 criado_em timestamptz not null default now()
);
create index if not exists ong_cadastros_dono on public.ong_cadastros(responsavel_id,criado_em desc,id desc);
alter table public.ong_cadastros enable row level security;
revoke all on public.ong_cadastros from public,anon,authenticated;
grant select on public.ong_cadastros to authenticated;
grant all on public.ong_cadastros to service_role;
drop policy if exists ong_cadastro_proprio on public.ong_cadastros;
create policy ong_cadastro_proprio on public.ong_cadastros for select to authenticated using(responsavel_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ong-documentos','ong-documentos',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='ong-documentos' and public) then raise exception 'O bucket de documentos da ONG precisa ser privado.'; end if;
end $$;
create or replace function public.ong_documento_permitido(p_nome text,p_escrita boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.ong_cadastros c where c.responsavel_id=auth.uid()
  and (not p_escrita or c.status='rascunho') and p_nome ~ ('^'||auth.uid()::text||'/'||c.id::text||'-(estatuto|comprovante|responsavel)-[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'));
$$;
revoke all on function public.ong_documento_permitido(text,boolean) from public,anon;
grant execute on function public.ong_documento_permitido(text,boolean) to authenticated;
drop policy if exists ong_documentos_leitura on storage.objects;
create policy ong_documentos_leitura on storage.objects for select to authenticated using(bucket_id='ong-documentos' and public.ong_documento_permitido(name,false));
drop policy if exists ong_documentos_envio on storage.objects;
create policy ong_documentos_envio on storage.objects for insert to authenticated with check(bucket_id='ong-documentos' and public.ong_documento_permitido(name,true));
-- Sem UPDATE/DELETE do cliente: arquivos imutáveis inclusive após o envio para análise.
drop policy if exists ong_documentos_limite_leitura on storage.objects;
create policy ong_documentos_limite_leitura on storage.objects as restrictive for select to authenticated using(bucket_id<>'ong-documentos' or public.ong_documento_permitido(name,false));
drop policy if exists ong_documentos_limite_envio on storage.objects;
create policy ong_documentos_limite_envio on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'ong-documentos' or public.ong_documento_permitido(name,true));
drop policy if exists ong_documentos_sem_update on storage.objects;
create policy ong_documentos_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'ong-documentos') with check(bucket_id<>'ong-documentos');
drop policy if exists ong_documentos_sem_delete on storage.objects;
create policy ong_documentos_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'ong-documentos');

create or replace function public.ong_cadastro_obter(p_tutor uuid,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
 select to_jsonb(c)||jsonb_build_object('ong_status',g.status) into r from public.ong_cadastros c left join public.adocao_ongs g on g.id=c.id
  where c.id=p_id and c.responsavel_id=p_tutor;
 if r is null then raise exception 'Cadastro indisponível para esta conta.'; end if;
 return r;
end;
$$;
create or replace function public.ong_cadastros_listar(p_tutor uuid,p_antes timestamptz default null,p_antes_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
 if (p_antes is null)<>(p_antes_id is null) then raise exception 'Página inválida.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc,t.id desc),'[]'::jsonb) into r from (
  select c.id,c.nome,c.status,c.criado_em,g.status as ong_status from public.ong_cadastros c left join public.adocao_ongs g on g.id=c.id
   where c.responsavel_id=p_tutor and (p_antes is null or (c.criado_em,c.id)<(p_antes,p_antes_id)) order by c.criado_em desc,c.id desc limit 21
 ) t;
 return jsonb_build_object('itens',jsonb_path_query_array(r,'$[0 to 19]'),'tem_mais',jsonb_array_length(r)>20);
end;
$$;
create or replace function public.ong_cadastro_salvar(p_tutor uuid,p_id uuid,p_versao integer,p_dados jsonb,p_enviar boolean default false,p_concordo boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare antigo public.ong_cadastros; novo public.ong_cadastros; docs jsonb; d record; tipo text; caminho text;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
 if p_id is null or p_versao is null or p_versao<0 or p_enviar is null or jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do cadastro inválidos.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,91214));
 select * into antigo from public.ong_cadastros where id=p_id for update;
 if found then
  if antigo.responsavel_id<>p_tutor then raise exception 'Cadastro indisponível para esta conta.'; end if;
  if antigo.status='enviado' and p_enviar and p_concordo is true then return public.ong_cadastro_obter(p_tutor,p_id); end if;
  if antigo.status<>'rascunho' then raise exception 'Este cadastro já foi enviado para análise.'; end if;
  if antigo.versao<>p_versao then raise exception 'O cadastro foi alterado. Atualize antes de salvar.'; end if;
 elsif p_versao<>0 then raise exception 'O cadastro foi alterado. Atualize antes de salvar.'; end if;
 if exists(select 1 from jsonb_object_keys(p_dados) k where k not in ('cnpj','nome','cidade','bairro','responsavel_nome','email','telefone','documentos')) then raise exception 'Dados do cadastro inválidos.'; end if;
 novo:=jsonb_populate_record(null::public.ong_cadastros,p_dados);
 docs:=coalesce(novo.documentos,'{}'::jsonb);
 if jsonb_typeof(docs)<>'object' or exists(select 1 from jsonb_each(docs) e where e.key not in ('estatuto','comprovante','responsavel') or jsonb_typeof(e.value)<>'string') then raise exception 'Documentos inválidos.'; end if;
 for d in select * from jsonb_each_text(docs) loop
  if d.value !~ ('^'||p_tutor::text||'/'||p_id::text||'-'||d.key||'-[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
   or not exists(select 1 from storage.objects o where o.bucket_id='ong-documentos' and o.name=d.value) then raise exception 'Um documento não foi confirmado. Envie novamente.'; end if;
 end loop;
 if p_enviar then
  if p_concordo is distinct from true then raise exception 'Confirme o envio dos dados e documentos para análise.'; end if;
  foreach tipo in array array['estatuto','comprovante','responsavel'] loop if not docs ? tipo then raise exception 'Anexe os três documentos antes de enviar.'; end if; end loop;
 end if;
 begin
  if antigo.id is null then
   insert into public.ong_cadastros(id,responsavel_id,cnpj,nome,cidade,bairro,responsavel_nome,email,telefone,documentos,status,enviado_em)
   values(p_id,p_tutor,upper(regexp_replace(btrim(novo.cnpj),'[./[:space:]-]','','g')),btrim(novo.nome),btrim(novo.cidade),btrim(novo.bairro),btrim(novo.responsavel_nome),lower(btrim(novo.email)),novo.telefone,docs,case when p_enviar then 'enviado' else 'rascunho' end,case when p_enviar then now() end);
  else
   update public.ong_cadastros set cnpj=upper(regexp_replace(btrim(novo.cnpj),'[./[:space:]-]','','g')),nome=btrim(novo.nome),cidade=btrim(novo.cidade),bairro=btrim(novo.bairro),responsavel_nome=btrim(novo.responsavel_nome),email=lower(btrim(novo.email)),telefone=novo.telefone,documentos=docs,status=case when p_enviar then 'enviado' else 'rascunho' end,enviado_em=case when p_enviar then now() end,versao=versao+1 where id=p_id;
  end if;
 exception when unique_violation then raise exception 'Este CNPJ já possui cadastro. Confira os dados ou entre na conta responsável.';
 end;
 if p_enviar then
  if exists(select 1 from public.adocao_ongs where id=p_id) then raise exception 'Cadastro indisponível para esta conta.'; end if;
  insert into public.adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) select id,responsavel_id,nome,cidade,bairro,'pendente' from public.ong_cadastros where id=p_id;
 end if;
 return public.ong_cadastro_obter(p_tutor,p_id);
end;
$$;
revoke all on function public.ong_cadastro_obter(uuid,uuid) from public,anon;
revoke all on function public.ong_cadastros_listar(uuid,timestamptz,uuid) from public,anon;
revoke all on function public.ong_cadastro_salvar(uuid,uuid,integer,jsonb,boolean,boolean) from public,anon;
grant execute on function public.ong_cadastro_obter(uuid,uuid), public.ong_cadastros_listar(uuid,timestamptz,uuid), public.ong_cadastro_salvar(uuid,uuid,integer,jsonb,boolean,boolean) to authenticated;
do $$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_cadastro_ong()') is null then alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_cadastro_ong; end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_cadastro_ong() from public,anon,authenticated;
create or replace function public.exportar_meus_dados() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return public.exportar_meus_dados_sem_cadastro_ong()||jsonb_build_object('cadastros_ong',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.ong_cadastros c where responsavel_id=auth.uid()));
end;
$$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
notify pgrst,'reload schema';
commit;

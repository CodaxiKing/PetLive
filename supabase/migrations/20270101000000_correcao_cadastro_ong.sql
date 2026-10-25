begin;
-- Correção administrativa reabre somente o cadastro, sem liberar a ONG.
alter table public.ong_cadastros add column if not exists correcao_motivo text check(correcao_motivo is null or char_length(btrim(correcao_motivo)) between 5 and 500);
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
  if exists(select 1 from public.adocao_ongs where id=p_id) then
   if antigo.correcao_motivo is null then raise exception 'Cadastro indisponível para esta conta.'; end if;
   update public.adocao_ongs g set nome=c.nome,cidade=c.cidade,bairro=c.bairro,status='pendente',revisao=g.revisao+1
    from public.ong_cadastros c where c.id=p_id and g.id=c.id and g.responsavel_id=p_tutor and g.status='recusada';
   if not found then raise exception 'Cadastro indisponível para esta conta.'; end if;
   update public.ong_cadastros set correcao_motivo=null where id=p_id;
  else
   insert into public.adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) select id,responsavel_id,nome,cidade,bairro,'pendente' from public.ong_cadastros where id=p_id;
  end if;
 end if;
 return public.ong_cadastro_obter(p_tutor,p_id);
end;
$$;

create or replace function public.admin_ong_pedir_correcao(p_id uuid,p_revisao integer,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.ong_cadastros; g public.adocao_ongs;
begin
 perform public.admin_exigir(array['moderacao']);
 if char_length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then raise exception 'Informe um motivo entre 5 e 500 caracteres.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,91214));
 select * into c from public.ong_cadastros where id=p_id for update;
 if not found or c.status<>'enviado' then raise exception 'O cadastro mudou. Atualize antes de pedir correções.'; end if;
 select * into g from public.adocao_ongs where id=p_id for update;
 if not found or g.revisao is distinct from p_revisao or g.responsavel_id<>c.responsavel_id
  or g.status not in ('pendente','recusada') then raise exception 'O cadastro mudou. Atualize antes de pedir correções.'; end if;
 update public.ong_cadastros set status='rascunho',correcao_motivo=btrim(p_motivo),versao=versao+1 where id=p_id;
 update public.adocao_ongs set status='recusada',motivo_decisao=btrim(p_motivo),revisao=revisao+1 where id=p_id;
 perform public.admin_registrar('ong_pedir_correcao','ong',p_id::text,jsonb_build_object('anterior',g.status,'motivo',btrim(p_motivo)));
end; $$;

-- Mostra ao admin o cadastro em correção, preservando documentos privados fora da lista.
create or replace function public.admin_ongs(p_status text default 'pendente',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 perform public.admin_exigir(array['moderacao','leitura']);
 if p_status is null or p_status not in ('pendente','aprovada','recusada','suspensa') or p_pagina is null or p_pagina<0 or p_pagina>10000 then raise exception 'Filtro inválido.'; end if;
 select jsonb_build_object('total',(select count(*) from public.adocao_ongs where status=p_status),
  'itens',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em,x.id) from (
    select g.id,g.nome,g.cidade,g.bairro,g.status,g.revisao,g.motivo_decisao,g.criado_em,
      c.cnpj,c.responsavel_nome,c.email,c.telefone,c.enviado_em,c.correcao_motivo,
      coalesce((select jsonb_agg(d.key order by d.key) from jsonb_each_text(c.documentos) d where c.status='enviado'),'[]'::jsonb) as documentos
    from public.adocao_ongs g left join public.ong_cadastros c on c.id=g.id
    where g.status=p_status order by g.criado_em,g.id limit 20 offset p_pagina*20
  ) x),'[]'::jsonb)) into r;
 return r;
end; $$;
revoke all on function public.admin_ong_pedir_correcao(uuid,integer,text) from public,anon;
grant execute on function public.admin_ong_pedir_correcao(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;

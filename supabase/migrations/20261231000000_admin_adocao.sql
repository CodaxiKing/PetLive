begin;
alter table public.adocao_ongs add column if not exists revisao integer not null default 1;
alter table public.adocao_ongs add column if not exists motivo_decisao text;

create or replace function public.admin_ongs(p_status text default 'pendente',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 perform public.admin_exigir(array['moderacao','leitura']);
 if p_status is null or p_status not in ('pendente','aprovada','recusada','suspensa') or p_pagina is null or p_pagina<0 or p_pagina>10000 then raise exception 'Filtro inválido.'; end if;
 select jsonb_build_object('total',(select count(*) from public.adocao_ongs where status=p_status),
  'itens',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em,x.id) from (
    select g.id,g.nome,g.cidade,g.bairro,g.status,g.revisao,g.motivo_decisao,g.criado_em,
      c.cnpj,c.responsavel_nome,c.email,c.telefone,c.enviado_em,
      coalesce((select jsonb_agg(d.key order by d.key) from jsonb_each_text(c.documentos) d),'[]'::jsonb) as documentos
    from public.adocao_ongs g left join public.ong_cadastros c on c.id=g.id and c.status='enviado'
    where g.status=p_status order by g.criado_em,g.id limit 20 offset p_pagina*20
  ) x),'[]'::jsonb)) into r;
 return r;
end; $$;

create or replace function public.admin_ong_decidir(p_id uuid,p_revisao integer,p_status text,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare g public.adocao_ongs; c public.ong_cadastros;
begin
 perform public.admin_exigir(array['moderacao']);
 if p_status is null or p_status not in ('aprovada','recusada','suspensa') or char_length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then raise exception 'Informe a decisão e um motivo entre 5 e 500 caracteres.'; end if;
 select * into g from public.adocao_ongs where id=p_id for update;
 if not found or g.revisao is distinct from p_revisao then raise exception 'O cadastro mudou. Atualize antes de decidir.'; end if;
 if not ((g.status='pendente' and p_status in ('aprovada','recusada')) or (g.status='aprovada' and p_status='suspensa') or (g.status='suspensa' and p_status='aprovada')) then raise exception 'Transição indisponível para este cadastro.'; end if;
 if p_status='aprovada' then
   select * into c from public.ong_cadastros where id=p_id and responsavel_id=g.responsavel_id and status='enviado';
   if not found or not (c.documentos ?& array['estatuto','comprovante','responsavel']) or exists(
     select 1 from jsonb_each_text(c.documentos) d where d.value !~ ('^'||c.responsavel_id::text||'/'||c.id::text||'-'||d.key||'-[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
     or not exists(select 1 from storage.objects o where o.bucket_id='ong-documentos' and o.name=d.value)
   ) then raise exception 'Cadastro enviado com os três documentos confirmados é obrigatório.'; end if;
 end if;
 update public.adocao_ongs set status=p_status,motivo_decisao=btrim(p_motivo),revisao=revisao+1 where id=p_id;
 perform public.admin_registrar('ong_decidir','ong',p_id::text,jsonb_build_object('anterior',g.status,'status',p_status,'motivo',btrim(p_motivo)));
end; $$;

-- Mantém acesso do responsável; permite leitura administrativa somente de anexos enviados.
create or replace function public.ong_documento_permitido(p_nome text,p_escrita boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.ong_cadastros c where c.responsavel_id=auth.uid() and (not p_escrita or c.status='rascunho')
   and p_nome ~ ('^'||auth.uid()::text||'/'||c.id::text||'-(estatuto|comprovante|responsavel)-[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'))
  or (not p_escrita and coalesce(public.admin_papel() in ('super','moderacao'),false) and exists(
   select 1 from public.ong_cadastros c cross join lateral jsonb_each_text(c.documentos) d
   where c.status='enviado' and d.value=p_nome))
 );
$$;

create or replace function public.admin_ong_documento(p_id uuid,p_tipo text)
returns text language plpgsql security definer set search_path='' as $$
declare caminho text;
begin
 perform public.admin_exigir(array['moderacao']);
 if p_tipo is null or p_tipo not in ('estatuto','comprovante','responsavel') then raise exception 'Documento inválido.'; end if;
 select documentos->>p_tipo into caminho from public.ong_cadastros where id=p_id and status='enviado';
 if caminho is null or not public.ong_documento_permitido(caminho,false)
 or not exists(select 1 from storage.objects where bucket_id='ong-documentos' and name=caminho) then raise exception 'Documento indisponível.'; end if;
 perform public.admin_registrar('ong_documento_consultar','ong',p_id::text,jsonb_build_object('tipo',p_tipo));
 return caminho;
end; $$;

create or replace function public.admin_adocao_pets(p_status text default 'publicado',p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.admin_exigir(array['moderacao','leitura']);
 if p_status is null or p_status not in ('publicado','oculto') or p_pagina is null or p_pagina<0 or p_pagina>10000 then raise exception 'Filtro inválido.'; end if;
 return jsonb_build_object('total',(select count(*) from public.adocao_pets where status=p_status),
  'itens',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id desc) from (
   select p.id,p.nome,p.especie,p.descricao,p.fotos,p.status,p.versao,p.criado_em,g.nome as ong_nome,g.status as ong_status
   from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.status=p_status
   order by p.criado_em desc,p.id desc limit 20 offset p_pagina*20
  ) x),'[]'::jsonb));
end; $$;

create or replace function public.admin_adocao_pet_ocultar(p_id uuid,p_versao integer,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.admin_exigir(array['moderacao']);
 if char_length(btrim(coalesce(p_motivo,''))) not between 5 and 500 then raise exception 'Informe um motivo entre 5 e 500 caracteres.'; end if;
 update public.adocao_pets set status='oculto',versao=versao+1 where id=p_id and status='publicado' and versao=p_versao;
 if not found then raise exception 'O pet mudou. Atualize antes de moderar.'; end if;
 perform public.admin_registrar('adocao_pet_ocultar','adocao_pet',p_id::text,jsonb_build_object('motivo',btrim(p_motivo)));
end; $$;

revoke all on function public.admin_ongs(text,integer),public.admin_ong_decidir(uuid,integer,text,text),public.admin_ong_documento(uuid,text),public.admin_adocao_pets(text,integer),public.admin_adocao_pet_ocultar(uuid,integer,text) from public,anon;
grant execute on function public.admin_ongs(text,integer),public.admin_ong_decidir(uuid,integer,text,text),public.admin_ong_documento(uuid,text),public.admin_adocao_pets(text,integer),public.admin_adocao_pet_ocultar(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;

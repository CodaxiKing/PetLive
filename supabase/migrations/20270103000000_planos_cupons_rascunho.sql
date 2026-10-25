begin;
create table if not exists public.premium_planos_rascunho (
 ciclo text primary key check(ciclo in ('mensal','anual')),
 preco_centavos integer check(preco_centavos>0),
 dias_teste integer not null default 7 check(dias_teste between 0 and 90),
 versao integer not null default 1 check(versao>0),
 atualizado_em timestamptz not null default now()
);
insert into public.premium_planos_rascunho(ciclo) values('mensal'),('anual') on conflict do nothing;
create table if not exists public.premium_cupons_rascunho (
 id uuid primary key,
 codigo text not null unique check(codigo ~ '^[A-Z0-9][A-Z0-9_-]{3,29}$'),
 tipo text not null check(tipo in ('percentual','valor_fixo','dias_gratis')),
 valor integer not null check(valor>0),
 inicio timestamptz not null,
 fim timestamptz not null,
 limite_usos integer not null check(limite_usos>0),
 minimo_centavos integer not null default 0 check(minimo_centavos>=0),
 arquivado boolean not null default false,
 versao integer not null default 1 check(versao>0),
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 check(fim>inicio),check(tipo<>'percentual' or valor<=100),check(tipo<>'dias_gratis' or valor<=365)
);
alter table public.premium_planos_rascunho enable row level security;
alter table public.premium_cupons_rascunho enable row level security;
revoke all on public.premium_planos_rascunho,public.premium_cupons_rascunho from public,anon,authenticated;
grant all on public.premium_planos_rascunho,public.premium_cupons_rascunho to service_role;

create or replace function public.admin_planos(p_pagina integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.admin_exigir(array['financeiro','leitura']);
 if p_pagina is null or p_pagina<0 or p_pagina>10000 then raise exception 'Página inválida.'; end if;
 return jsonb_build_object('venda_disponivel',false,
  'planos',(select jsonb_agg(to_jsonb(p) order by p.ciclo) from public.premium_planos_rascunho p),
  'total_cupons',(select count(*) from public.premium_cupons_rascunho),
  'cupons',coalesce((select jsonb_agg(to_jsonb(c) order by c.criado_em desc,c.id desc) from (
   select * from public.premium_cupons_rascunho order by criado_em desc,id desc limit 25 offset p_pagina*25
  ) c),'[]'::jsonb));
end; $$;

create or replace function public.admin_plano_salvar(p_ciclo text,p_versao integer,p_preco_centavos integer,p_dias_teste integer)
returns void language plpgsql security definer set search_path='' as $$
declare antigo public.premium_planos_rascunho;
begin
 perform public.admin_exigir(array['financeiro']);
 if p_ciclo is null or p_ciclo not in ('mensal','anual') or p_preco_centavos is null or p_preco_centavos<=0
  or p_dias_teste is null or p_dias_teste not between 0 and 90 then raise exception 'Confira o preço e os dias de teste.'; end if;
 select * into antigo from public.premium_planos_rascunho where ciclo=p_ciclo for update;
 if not found or antigo.versao is distinct from p_versao then raise exception 'O plano mudou. Atualize antes de salvar.'; end if;
 update public.premium_planos_rascunho set preco_centavos=p_preco_centavos,dias_teste=p_dias_teste,versao=versao+1,atualizado_em=now() where ciclo=p_ciclo;
 perform public.admin_registrar('plano_rascunho_salvar','plano',p_ciclo,jsonb_build_object('preco_anterior',antigo.preco_centavos,'preco_centavos',p_preco_centavos,'dias_teste_anterior',antigo.dias_teste,'dias_teste',p_dias_teste));
end; $$;

create or replace function public.admin_cupom_salvar(p_id uuid,p_versao integer,p_codigo text,p_tipo text,p_valor integer,
 p_inicio timestamptz,p_fim timestamptz,p_limite_usos integer,p_minimo_centavos integer,p_arquivado boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare antigo public.premium_cupons_rascunho; v_codigo text:=upper(btrim(p_codigo));
begin
 perform public.admin_exigir(array['financeiro']);
 if p_versao is null or p_versao<0 or (p_id is null and p_versao<>0) or v_codigo is null or v_codigo !~ '^[A-Z0-9][A-Z0-9_-]{3,29}$'
  or p_tipo is null or p_tipo not in ('percentual','valor_fixo','dias_gratis') or p_valor is null or p_valor<=0
  or (p_tipo='percentual' and p_valor>100) or (p_tipo='dias_gratis' and p_valor>365)
  or p_inicio is null or p_fim is null or p_fim<=p_inicio or p_limite_usos is null or p_limite_usos<=0
  or p_minimo_centavos is null or p_minimo_centavos<0 or p_arquivado is null then raise exception 'Confira os dados do cupom.'; end if;
 p_id:=coalesce(p_id,gen_random_uuid());
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,91303));
 select * into antigo from public.premium_cupons_rascunho where id=p_id for update;
 if found then
  if antigo.versao is distinct from p_versao then raise exception 'O cupom mudou. Atualize antes de salvar.'; end if;
 elsif p_versao<>0 then raise exception 'O cupom mudou. Atualize antes de salvar.';
 end if;
 begin
  if antigo.id is null then
   insert into public.premium_cupons_rascunho(id,codigo,tipo,valor,inicio,fim,limite_usos,minimo_centavos,arquivado)
    values(p_id,v_codigo,p_tipo,p_valor,p_inicio,p_fim,p_limite_usos,p_minimo_centavos,p_arquivado);
  else
   update public.premium_cupons_rascunho set codigo=v_codigo,tipo=p_tipo,valor=p_valor,inicio=p_inicio,fim=p_fim,
    limite_usos=p_limite_usos,minimo_centavos=p_minimo_centavos,arquivado=p_arquivado,versao=versao+1,atualizado_em=now() where id=p_id;
  end if;
 exception when unique_violation then raise exception 'Este código já possui um rascunho de cupom.';
 end;
 perform public.admin_registrar('cupom_premium_rascunho_salvar','cupom_premium',p_id::text,jsonb_build_object(
  'anterior',case when antigo.id is null then null else to_jsonb(antigo) end,
  'novo',jsonb_build_object('codigo',v_codigo,'tipo',p_tipo,'valor',p_valor,'inicio',p_inicio,'fim',p_fim,
   'limite_usos',p_limite_usos,'minimo_centavos',p_minimo_centavos,'arquivado',p_arquivado)));
end; $$;
revoke all on function public.admin_planos(integer),public.admin_plano_salvar(text,integer,integer,integer),public.admin_cupom_salvar(uuid,integer,text,text,integer,timestamptz,timestamptz,integer,integer,boolean) from public,anon;
grant execute on function public.admin_planos(integer),public.admin_plano_salvar(text,integer,integer,integer),public.admin_cupom_salvar(uuid,integer,text,text,integer,timestamptz,timestamptz,integer,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;

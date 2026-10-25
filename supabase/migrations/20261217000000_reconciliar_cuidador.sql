-- Repara produção sem cuidador; não agenda jobs nem envia notificações.
begin;
create table if not exists public.cuidador_acessos (
 id uuid primary key default gen_random_uuid(),codigo text not null unique,
 tutor_id uuid not null references public.profiles(id) on delete cascade,
 pet_ids uuid[] not null check(cardinality(pet_ids) between 1 and 10),
 cuidador text not null check(char_length(cuidador) between 2 and 80),
 inicio timestamptz not null default now(),fim timestamptz not null,
 ver_vacinas boolean not null default true,ver_remedios boolean not null default true,ver_contatos boolean not null default true,
 revogado_em timestamptz,aviso_expira_em timestamptz,aberturas int not null default 0,ultima_abertura_em timestamptz,
 criado_em timestamptz not null default now(),check(fim>inicio and fim<=inicio+interval '60 days')
);
create table if not exists public.cuidador_registros (
 id bigint generated always as identity primary key,acesso_id uuid not null references public.cuidador_acessos(id) on delete cascade,
 acao text not null check(acao in ('abriu','dose')),detalhe text,criado_em timestamptz not null default now()
);
create index if not exists cuidador_acessos_tutor on public.cuidador_acessos(tutor_id,fim desc);
create index if not exists cuidador_registros_acesso on public.cuidador_registros(acesso_id,criado_em desc);
alter table public.cuidador_acessos enable row level security;
alter table public.cuidador_registros enable row level security;
revoke all on public.cuidador_acessos,public.cuidador_registros from anon,authenticated;
grant select on public.cuidador_acessos,public.cuidador_registros to authenticated;
drop policy if exists cuidador_conta on public.cuidador_acessos;
create policy cuidador_conta on public.cuidador_acessos for select to authenticated using(tutor_id=auth.uid());
drop policy if exists cuidador_limite_conta on public.cuidador_acessos;
create policy cuidador_limite_conta on public.cuidador_acessos as restrictive for select to authenticated using(tutor_id=auth.uid());
drop policy if exists cuidador_registro_conta on public.cuidador_registros;
create policy cuidador_registro_conta on public.cuidador_registros for select to authenticated using(exists(select 1 from public.cuidador_acessos a where a.id=acesso_id and a.tutor_id=auth.uid()));
drop policy if exists cuidador_registro_limite on public.cuidador_registros;
create policy cuidador_registro_limite on public.cuidador_registros as restrictive for select to authenticated using(exists(select 1 from public.cuidador_acessos a where a.id=acesso_id and a.tutor_id=auth.uid()));
alter table public.medication_doses add column if not exists confirmada_por text;
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='public.medication_doses'::regclass and conname='medication_doses_origem_check') then
  alter table public.medication_doses drop constraint medication_doses_origem_check;
  alter table public.medication_doses add constraint medication_doses_origem_check check(origem in ('app','notificacao','widget','cuidador'));
 end if;
end $$;

create or replace function public.criar_acesso_cuidador(p_pets uuid[],p_cuidador text,p_fim timestamptz,p_vacinas boolean default true,p_remedios boolean default true,p_contatos boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_plano text;v_codigo text;
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 select plano into v_plano from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil indisponível.'; end if;
 if p_pets is null or cardinality(p_pets) not between 1 and 10 or
   (select count(distinct p.id) from public.pets p where p.id=any(p_pets) and p.tutor_id=auth.uid() and p.ativo and not coalesce(p.em_memoria,false))<>cardinality(p_pets) then raise exception 'Escolha de 1 a 10 pets próprios disponíveis, sem repetir.'; end if;
 if char_length(trim(coalesce(p_cuidador,''))) not between 2 and 80 then raise exception 'Informe o nome de quem vai cuidar (2 a 80 caracteres).'; end if;
 if p_fim is null or p_fim<=now() or p_fim>now()+interval '60 days' then raise exception 'Escolha prazo futuro de até 60 dias.'; end if;
 if p_vacinas is null or p_remedios is null or p_contatos is null then raise exception 'Informe as permissões.'; end if;
 if coalesce(v_plano,'gratis')<>'premium' and exists(select 1 from public.cuidador_acessos where tutor_id=auth.uid() and revogado_em is null and fim>now()) then raise exception 'No plano grátis é 1 acesso ativo por vez.'; end if;
 v_codigo:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.cuidador_acessos(codigo,tutor_id,pet_ids,cuidador,fim,ver_vacinas,ver_remedios,ver_contatos)
 values(v_codigo,auth.uid(),p_pets,trim(p_cuidador),p_fim,p_vacinas,p_remedios,p_contatos);
 return jsonb_build_object('codigo',v_codigo,'fim',p_fim);
end; $$;
create or replace function public.revogar_acesso_cuidador(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 update public.cuidador_acessos set revogado_em=now() where id=p_id and tutor_id=auth.uid() and revogado_em is null;
end; $$;

create or replace function public.cuidador_fuso(p_tutor uuid) returns text language sql stable security definer set search_path=public as $$
 select coalesce((select n.name from public.profiles p join pg_catalog.pg_timezone_names n on n.name=p.fuso_horario where p.id=p_tutor),'America/Sao_Paulo')
$$;
revoke all on function public.cuidador_fuso(uuid) from public,anon,authenticated;

create or replace function public.cuidador_visao(p_codigo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.cuidador_acessos;u public.profiles;v_fuso text;v_dia date;
begin
 select * into a from public.cuidador_acessos where codigo=p_codigo and revogado_em is null and inicio<=now() and fim>now() for update;
 if not found then return jsonb_build_object('valido',false); end if;
 update public.cuidador_acessos set aberturas=aberturas+1,ultima_abertura_em=now() where id=a.id;
 if not exists(select 1 from public.cuidador_registros where acesso_id=a.id and acao='abriu' and criado_em>now()-interval '1 hour') then insert into public.cuidador_registros(acesso_id,acao) values(a.id,'abriu'); end if;
 select * into u from public.profiles where id=a.tutor_id;
 v_fuso:=public.cuidador_fuso(a.tutor_id);v_dia:=(now() at time zone v_fuso)::date;
 return jsonb_build_object('valido',true,'cuidador',a.cuidador,'fim',a.fim,
 'tutor',jsonb_build_object('nome',u.nome,'telefone',case when a.ver_contatos then u.telefone end,'whatsapp',case when a.ver_contatos then (to_jsonb(u)->>'whatsapp')::boolean end,
 'emergencia_nome',case when a.ver_contatos then to_jsonb(u)->>'contato_emergencia_nome' end,'emergencia_telefone',case when a.ver_contatos then to_jsonb(u)->>'contato_emergencia_telefone' end),
 'ver',jsonb_build_object('vacinas',a.ver_vacinas,'remedios',a.ver_remedios,'contatos',a.ver_contatos),
 'pets',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nome',p.nome,'especie',p.especie,'sexo',p.sexo,'foto_url',p.foto_url,
 'alergias',case when a.ver_contatos then p.alergias end,'veterinario',case when a.ver_contatos then to_jsonb(p)->>'veterinario' end,
 'vacinas',case when a.ver_vacinas then coalesce((select jsonb_agg(jsonb_build_object('nome',v.nome,'proxima_dose',v.proxima_dose) order by v.nome) from (select distinct on (nome) nome,proxima_dose from public.vaccinations where pet_id=p.id order by nome,aplicada_em desc,id desc)v),'[]'::jsonb) end,
 'vermifugo',case when a.ver_vacinas then (select max(aplicado_em) from public.dewormings where pet_id=p.id) end,
 'doses',case when a.ver_remedios then coalesce((select jsonb_agg(jsonb_build_object('medication_id',m.id,'nome',m.nome,'dose',m.dose,'prevista_para',t.instante,'confirmada_em',d.confirmada_em,'confirmada_por',case when d.origem='cuidador' then d.confirmada_por else 'o tutor' end) order by t.instante,m.id)
 from public.medications m cross join lateral unnest(m.horarios) h(hora) cross join lateral(select ((v_dia+h.hora) at time zone v_fuso) instante)t
 left join public.medication_doses d on d.medication_id=m.id and d.prevista_para=t.instante
 where m.pet_id=p.id and m.ativo and m.inicio<=v_dia and (m.fim is null or m.fim>=v_dia)),'[]'::jsonb) end
 ) order by p.nome,p.id) from public.pets p where p.id=any(a.pet_ids) and p.tutor_id=a.tutor_id and p.ativo and not coalesce(p.em_memoria,false)),'[]'::jsonb));
end; $$;

create or replace function public.cuidador_marcar_dose(p_codigo text,p_medication uuid,p_prevista_para timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare a public.cuidador_acessos;m public.medications;v_fuso text;v_dia date;v_alteradas int;
begin
 select * into a from public.cuidador_acessos where codigo=p_codigo and revogado_em is null and inicio<=now() and fim>now() for update;
 if not found or not a.ver_remedios then raise exception 'Acesso indisponível ou sem permissão para remédios.'; end if;
 select med.* into m from public.medications med join public.pets p on p.id=med.pet_id where med.id=p_medication and p.id=any(a.pet_ids) and p.tutor_id=a.tutor_id and p.ativo and not coalesce(p.em_memoria,false) for update of med,p;
 if not found then raise exception 'Remédio indisponível.'; end if;
 v_fuso:=public.cuidador_fuso(a.tutor_id);v_dia:=(now() at time zone v_fuso)::date;
 if p_prevista_para is null or not m.ativo or m.inicio>v_dia or (m.fim is not null and m.fim<v_dia) or
   (p_prevista_para at time zone v_fuso)::date<>v_dia or p_prevista_para<a.inicio or p_prevista_para>=a.fim or
   not exists(select 1 from unnest(m.horarios) h(hora) where ((v_dia+h.hora) at time zone v_fuso)=p_prevista_para) then raise exception 'Só é possível confirmar um horário prescrito de hoje dentro do acesso.'; end if;
 if exists(select 1 from public.medication_doses where medication_id=m.id and prevista_para=p_prevista_para and pulada and confirmada_em is null) then raise exception 'Esta dose foi marcada como pulada. Confirme com o tutor.'; end if;
 insert into public.medication_doses(medication_id,prevista_para,confirmada_em,origem,confirmada_por)
 values(m.id,p_prevista_para,now(),'cuidador',a.cuidador)
 on conflict(medication_id,prevista_para) do update set confirmada_em=excluded.confirmada_em,origem=excluded.origem,confirmada_por=excluded.confirmada_por
 where medication_doses.confirmada_em is null and not coalesce(medication_doses.pulada,false);
 get diagnostics v_alteradas=row_count;
 if v_alteradas>0 then insert into public.cuidador_registros(acesso_id,acao,detalhe) values(a.id,'dose',m.nome); end if;
end; $$;
revoke all on function public.criar_acesso_cuidador(uuid[],text,timestamptz,boolean,boolean,boolean) from public,anon;
revoke all on function public.revogar_acesso_cuidador(uuid) from public,anon;
grant execute on function public.criar_acesso_cuidador(uuid[],text,timestamptz,boolean,boolean,boolean),public.revogar_acesso_cuidador(uuid) to authenticated;
revoke all on function public.cuidador_visao(text),public.cuidador_marcar_dose(text,uuid,timestamptz) from public;
grant execute on function public.cuidador_visao(text),public.cuidador_marcar_dose(text,uuid,timestamptz) to anon,authenticated;

-- Preserva o exportador composto anterior; tokens não são copiados para o arquivo.
do $$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_cuidador_reparado()') is null then
  alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_cuidador_reparado;
 end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_cuidador_reparado() from public,anon,authenticated;
create or replace function public.exportar_meus_dados() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_tutor uuid:=auth.uid();v_base jsonb;
begin
 if v_tutor is null then raise exception 'Entre na sua conta.'; end if;
 v_base:=public.exportar_meus_dados_sem_cuidador_reparado();
 return v_base||jsonb_build_object('cuidador_acessos',coalesce((select jsonb_agg((to_jsonb(a)-'codigo')||jsonb_build_object('registros',coalesce((select jsonb_agg(to_jsonb(r) order by r.criado_em,r.id) from public.cuidador_registros r where r.acesso_id=a.id),'[]'::jsonb)) order by a.criado_em,a.id) from public.cuidador_acessos a where a.tutor_id=v_tutor),'[]'::jsonb));
end $$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
commit;

-- Exportação Premium e resumo mensal na caixa de avisos, somente por adesão.
begin;
create or replace function public.despesas_exportar(p_tutor uuid,p_mes date,p_pet uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_itens jsonb; v_nome text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if not exists(select 1 from public.profiles where id=p_tutor and plano='premium') then raise exception 'A exportação de despesas faz parte do Premium.'; end if;
  if p_mes is null or p_mes<>date_trunc('month',p_mes)::date or p_mes<date '1900-01-01' or p_mes>date '9999-11-01'
    then raise exception 'Escolha um mês válido.'; end if;
  if p_pet is not null then
    select nome into v_nome from public.pets where id=p_pet and tutor_id=p_tutor;
    if not found then raise exception 'Pet indisponível nesta conta.'; end if;
  end if;
  -- Uma só consulta e uma só fotografia dos dados: nunca truncar silenciosamente
  -- no limite de linhas do PostgREST. Recibos privados não saem no relatório.
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'data',d.data,'categoria',d.categoria,
    'valor_centavos',d.valor_centavos,'anotacao',d.anotacao,
    'pet_nome',case when d.pet_id is null then 'Todos os pets' else coalesce(p.nome,'Pet') end)
    order by d.data,d.criado_em,d.id),'[]'::jsonb) into v_itens
  from (select * from public.despesas where tutor_id=p_tutor and data>=p_mes and data<(p_mes+interval '1 month')::date
    and (p_pet is null or pet_id=p_pet or pet_id is null) order by data,criado_em,id limit 5001) d
  left join public.pets p on p.id=d.pet_id and p.tutor_id=p_tutor;
  if jsonb_array_length(v_itens)>5000 then raise exception 'Este relatório ultrapassa 5.000 despesas. Selecione um pet ou peça a exportação completa em Privacidade e dados.'; end if;
  return jsonb_build_object('mes',to_char(p_mes,'YYYY-MM'),'pet_nome',coalesce(v_nome,'Todos os pets'),'itens',v_itens);
end;
$$;
revoke all on function public.despesas_exportar(uuid,date,uuid) from public,anon;
grant execute on function public.despesas_exportar(uuid,date,uuid) to authenticated;

create table if not exists public.despesas_resumo_preferencias (
  tutor_id uuid primary key references public.profiles(id) on delete cascade,
  ativo boolean not null default false, atualizado_em timestamptz not null default now()
);
create table if not exists public.despesas_resumos_enviados (
  tutor_id uuid references public.profiles(id) on delete cascade,
  mes date not null, criado_em timestamptz not null default now(), primary key(tutor_id,mes)
);
alter table public.despesas_resumo_preferencias enable row level security;
alter table public.despesas_resumos_enviados enable row level security;
revoke all on public.despesas_resumo_preferencias,public.despesas_resumos_enviados from public,anon,authenticated;
grant select on public.despesas_resumo_preferencias,public.despesas_resumos_enviados to authenticated;
grant all on public.despesas_resumo_preferencias,public.despesas_resumos_enviados to service_role;
drop policy if exists despesas_resumo_preferencia_propria on public.despesas_resumo_preferencias;
create policy despesas_resumo_preferencia_propria on public.despesas_resumo_preferencias for select to authenticated using(tutor_id=auth.uid());
drop policy if exists despesas_resumo_enviado_proprio on public.despesas_resumos_enviados;
create policy despesas_resumo_enviado_proprio on public.despesas_resumos_enviados for select to authenticated using(tutor_id=auth.uid());
create or replace function public.despesas_resumo_configurar(p_tutor uuid,p_ativo boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if p_ativo is null then raise exception 'Escolha se deseja o resumo.'; end if;
  insert into public.despesas_resumo_preferencias(tutor_id,ativo) values(p_tutor,p_ativo)
    on conflict(tutor_id) do update set ativo=excluded.ativo,atualizado_em=now();
  return p_ativo;
end;
$$;
revoke all on function public.despesas_resumo_configurar(uuid,boolean) from public,anon;
grant execute on function public.despesas_resumo_configurar(uuid,boolean) to authenticated;

create or replace function public.despesas_enviar_resumos(p_agora timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare r record; v_local timestamp; v_mes date; v_fuso text; v_total bigint; v_qtd integer; v_n integer:=0;
begin
  if p_agora is null then raise exception 'Data inválida.'; end if;
  if not pg_try_advisory_xact_lock(7370142605::bigint) then return 0; end if;
  for r in select p.id,p.fuso_horario,s.horario_avisos,d.atualizado_em from public.profiles p
    join public.despesas_resumo_preferencias d on d.tutor_id=p.id and d.ativo
    left join public.notification_settings s on s.tutor_id=p.id
    where p.notificacoes_ativas
  loop
    select name into v_fuso from pg_catalog.pg_timezone_names where name=r.fuso_horario;
    v_local:=p_agora at time zone coalesce(v_fuso,'America/Sao_Paulo');
    -- A adesão começa no próximo fechamento mensal, sem avisos retroativos.
    if (r.atualizado_em at time zone coalesce(v_fuso,'America/Sao_Paulo'))>=date_trunc('month',v_local) then continue; end if;
    -- Caixa de avisos apenas: sem email ou push expondo valores na tela bloqueada.
    if v_local::time<coalesce(r.horario_avisos,'09:00'::time) then continue; end if;
    v_mes:=(date_trunc('month',v_local)-interval '1 month')::date;
    select sum(valor_centavos),count(*) into v_total,v_qtd from public.despesas
      where tutor_id=r.id and data>=v_mes and data<(v_mes+interval '1 month')::date;
    if v_qtd=0 then continue; end if;
    insert into public.despesas_resumos_enviados(tutor_id,mes,criado_em) values(r.id,v_mes,p_agora) on conflict do nothing;
    if not found then continue; end if;
    insert into public.notification_log(user_id,type,title,body,deep_link,sent_at)
      values(r.id,'sistema','Seu resumo mensal de despesas',to_char(v_mes,'MM/YYYY')||': '||v_qtd||' registro(s), total de R$ '||
        replace(to_char(v_total::numeric/100,'FM999999999999990.00'),'.',',')||'. Confira por categoria no PetLive.',
        '/despesas?mes='||to_char(v_mes,'YYYY-MM'),p_agora);
    v_n:=v_n+1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.despesas_enviar_resumos(timestamptz) from public,anon,authenticated;
grant execute on function public.despesas_enviar_resumos(timestamptz) to service_role;
do $$ begin
  if to_regprocedure('public.exportar_meus_dados_sem_resumo_despesas()') is null then
    alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_resumo_despesas;
  end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_resumo_despesas() from public,anon,authenticated;
create or replace function public.exportar_meus_dados()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  return public.exportar_meus_dados_sem_resumo_despesas()||jsonb_build_object(
    'preferencia_resumo_despesas',(select to_jsonb(p) from public.despesas_resumo_preferencias p where tutor_id=auth.uid()),
    'resumos_despesas_enviados',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.despesas_resumos_enviados e where tutor_id=auth.uid()));
end;
$$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='petlive-resumo-despesas') then perform cron.unschedule('petlive-resumo-despesas'); end if;
    perform cron.schedule('petlive-resumo-despesas','15 * * * *','select public.despesas_enviar_resumos();');
  end if;
end $$;
commit;

-- Região aproximada, opt-in e temporária; não é um histórico de localização.
begin;
create table if not exists public.eventos_regioes (
  tutor_id uuid primary key references auth.users(id) on delete cascade,
  ativo boolean not null default false,
  raio_km integer not null default 10 check(raio_km in (2,5,10,25,50)),
  lat numeric(5,2), lng numeric(5,2), atualizado_em timestamptz, expira_em timestamptz,
  check((ativo and lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180 and expira_em is not null)
    or (not ativo and lat is null and lng is null and expira_em is null))
);
alter table public.eventos_regioes enable row level security;
revoke all on public.eventos_regioes from public,anon,authenticated;
grant select on public.eventos_regioes to authenticated;
drop policy if exists eventos_regiao_propria on public.eventos_regioes;
create policy eventos_regiao_propria on public.eventos_regioes for select to authenticated using(tutor_id=auth.uid());

create table if not exists public.eventos_avisos_proximos (
  tutor_id uuid not null references auth.users(id) on delete cascade,
  evento_id uuid not null references public.events(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key(tutor_id,evento_id)
);
create index if not exists eventos_avisos_proximos_data on public.eventos_avisos_proximos(tutor_id,criado_em);
alter table public.eventos_avisos_proximos enable row level security;
revoke all on public.eventos_avisos_proximos from public,anon,authenticated;
grant select on public.eventos_avisos_proximos to authenticated;
drop policy if exists eventos_aviso_proprio on public.eventos_avisos_proximos;
create policy eventos_aviso_proprio on public.eventos_avisos_proximos for select to authenticated using(tutor_id=auth.uid());
grant all on public.eventos_regioes,public.eventos_avisos_proximos to service_role;

create or replace function public.eventos_regiao_consultar(p_tutor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_reg public.eventos_regioes;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  update public.eventos_regioes set ativo=false,lat=null,lng=null,expira_em=null
    where tutor_id=p_tutor and expira_em<=now();
  select * into v_reg from public.eventos_regioes where tutor_id=p_tutor;
  if not found then return jsonb_build_object('ativo',false,'raio_km',10,'atualizado_em',null,'expira_em',null); end if;
  return jsonb_build_object('ativo',v_reg.ativo,'raio_km',v_reg.raio_km,'atualizado_em',v_reg.atualizado_em,'expira_em',v_reg.expira_em);
end;
$$;
revoke all on function public.eventos_regiao_consultar(uuid) from public,anon;
grant execute on function public.eventos_regiao_consultar(uuid) to authenticated;

create or replace function public.eventos_regiao_configurar(p_tutor uuid,p_ativo boolean,p_raio integer,p_lat numeric default null,p_lng numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_reg public.eventos_regioes;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if p_ativo is null or p_raio is null or p_raio not in (2,5,10,25,50) then raise exception 'Escolha um raio disponível.'; end if;
  if not p_ativo then
    update public.eventos_regioes set ativo=false,lat=null,lng=null,expira_em=null where tutor_id=p_tutor;
    return public.eventos_regiao_consultar(p_tutor);
  end if;
  if p_lat is null and p_lng is null then
    update public.eventos_regioes set raio_km=p_raio where tutor_id=p_tutor and ativo and expira_em>now();
    if not found then raise exception 'Atualize sua região para ativar os avisos.'; end if;
  else
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
      then raise exception 'Região inválida.'; end if;
    insert into public.eventos_regioes(tutor_id,ativo,raio_km,lat,lng,atualizado_em,expira_em)
      values(p_tutor,true,p_raio,round(p_lat,2),round(p_lng,2),now(),now()+interval '7 days')
      on conflict(tutor_id) do update set ativo=true,raio_km=excluded.raio_km,lat=excluded.lat,lng=excluded.lng,
        atualizado_em=excluded.atualizado_em,expira_em=excluded.expira_em;
  end if;
  return public.eventos_regiao_consultar(p_tutor);
end;
$$;
revoke all on function public.eventos_regiao_configurar(uuid,boolean,integer,numeric,numeric) from public,anon;
grant execute on function public.eventos_regiao_configurar(uuid,boolean,integer,numeric,numeric) to authenticated;

create or replace function public.eventos_avisar_proximos(p_agora timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare r record; e record; v_fuso text; v_local timestamp; v_inicio time; v_fim time;
  v_horario time; v_total integer:=0; v_diario integer; v_token text; v_body text;
begin
  if p_agora is null then raise exception 'Data inválida.'; end if;
  -- Um job por vez, inclusive durante execução manual/cron concorrente.
  if not pg_try_advisory_xact_lock(7370142604::bigint) then return 0; end if;
  update public.eventos_regioes set ativo=false,lat=null,lng=null,expira_em=null where expira_em<=p_agora;
  for r in select g.*,p.fuso_horario,np.tutor_id as tem_pref,np.ativo as eventos_ativos,
      np.nao_perturbe_inicio,np.nao_perturbe_fim,s.horario_avisos
    from public.eventos_regioes g join public.profiles p on p.id=g.tutor_id
    left join public.notification_prefs np on np.tutor_id=g.tutor_id and np.tipo='eventos'
    left join public.notification_settings s on s.tutor_id=g.tutor_id
    where g.ativo and g.expira_em>p_agora and p.notificacoes_ativas and np.ativo is distinct from false
  loop
    select name into v_fuso from pg_catalog.pg_timezone_names where name=r.fuso_horario;
    v_local:=p_agora at time zone coalesce(v_fuso,'America/Sao_Paulo');
    v_horario:=coalesce(r.horario_avisos,'09:00'::time);
    if v_local::time<v_horario then continue; end if;
    v_inicio:=case when r.tem_pref is null then '22:00'::time else r.nao_perturbe_inicio end;
    v_fim:=case when r.tem_pref is null then '07:00'::time else r.nao_perturbe_fim end;
    if v_inicio is not null and v_fim is not null and
      (case when v_inicio<=v_fim then v_local::time>=v_inicio and v_local::time<v_fim
        else v_local::time>=v_inicio or v_local::time<v_fim end) then continue; end if;
    select count(*) into v_diario from public.eventos_avisos_proximos a where a.tutor_id=r.tutor_id
      and (a.criado_em at time zone coalesce(v_fuso,'America/Sao_Paulo'))::date=v_local::date;
    if v_diario>=3 then continue; end if;
    for e in
      select ev.id,ev.titulo,ev.inicio_em,6371*2*asin(sqrt(least(1.0,greatest(0.0,
        power(sin(radians(coalesce(ev.lat,pl.lat)::double precision-r.lat::double precision)/2),2)
        +cos(radians(r.lat::double precision))*cos(radians(coalesce(ev.lat,pl.lat)::double precision))
        *power(sin(radians(coalesce(ev.lng,pl.lng)::double precision-r.lng::double precision)/2),2))))) as distancia
      from public.events ev left join public.places pl on pl.id=ev.place_id
      where ev.status='publicado' and ev.inicio_em>p_agora and ev.inicio_em<=p_agora+interval '30 days'
        and ev.atualizado_em>=p_agora-interval '7 days' and ev.criado_por is distinct from r.tutor_id
        and coalesce(ev.lat,pl.lat) between -90 and 90 and coalesce(ev.lng,pl.lng) between -180 and 180
        and not exists(select 1 from public.eventos_avisos_proximos a where a.tutor_id=r.tutor_id and a.evento_id=ev.id)
      order by distancia,ev.inicio_em,ev.id
    loop
      if e.distancia>r.raio_km then continue; end if;
      insert into public.eventos_avisos_proximos(tutor_id,evento_id,criado_em) values(r.tutor_id,e.id,p_agora) on conflict do nothing;
      if not found then continue; end if;
      v_body:=e.titulo || ' está na região escolhida. Confira os detalhes no PetLive.';
      insert into public.notification_log(user_id,type,title,body,deep_link,sent_at)
        values(r.tutor_id,'sistema','Evento pet perto de você',v_body,'/eventos/'||e.id,p_agora);
      -- A caixa funciona sem token. Push usa os tokens ativos da infraestrutura
      -- existente; enfileirar HTTP não equivale a confirmar entrega no aparelho.
      if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
        for v_token in select distinct t.token from public.push_tokens t where t.tutor_id=r.tutor_id and t.ativo loop
          perform net.http_post(url:='https://exp.host/--/api/v2/push/send',
            body:=jsonb_build_object('to',v_token,'title','Evento pet perto de você','body',v_body,'sound','default',
              'ttl',least(86400,greatest(0,extract(epoch from e.inicio_em-p_agora)))::integer,
              'data',jsonb_build_object('tipo','evento','url','/eventos/'||e.id,'event_id',e.id)),
            headers:=jsonb_build_object('Content-Type','application/json'));
        end loop;
      end if;
      v_total:=v_total+1; v_diario:=v_diario+1;
      exit when v_diario>=3;
    end loop;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.eventos_avisar_proximos(timestamptz) from public,anon,authenticated;
grant execute on function public.eventos_avisar_proximos(timestamptz) to service_role;

do $$ begin
  if to_regprocedure('public.exportar_meus_dados_sem_regiao_eventos()') is null then
    alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_regiao_eventos;
  end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_regiao_eventos() from public,anon,authenticated;
create or replace function public.exportar_meus_dados()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  return public.exportar_meus_dados_sem_regiao_eventos() || jsonb_build_object(
    'regiao_eventos',(select to_jsonb(g) from public.eventos_regioes g where tutor_id=auth.uid()),
    'avisos_eventos_proximos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.eventos_avisos_proximos a where tutor_id=auth.uid()));
end;
$$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='petlive-eventos-proximos') then perform cron.unschedule('petlive-eventos-proximos'); end if;
    perform cron.schedule('petlive-eventos-proximos','*/15 * * * *','select public.eventos_avisar_proximos();');
  end if;
end $$;
commit;

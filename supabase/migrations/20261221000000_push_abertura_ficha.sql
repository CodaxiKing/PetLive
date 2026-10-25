-- Fila privada. Ticket/recibo do provedor não comprovam leitura no aparelho.
begin;
create table if not exists public.ficha_push_fila (
 id uuid primary key default gen_random_uuid(),aviso_id uuid not null references public.notification_log(id) on delete cascade,
 link_id uuid not null references public.carteirinha_links(id) on delete cascade,
 tutor_id uuid not null references public.profiles(id) on delete cascade,
 push_token_id uuid not null references public.push_tokens(id) on delete cascade,token_hash text not null,
 estado text not null default 'pendente' check(estado in ('pendente','ticket','aguardando_recibo','recibo','aceito','suprimido','falhou','expirado')),
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),disponivel_em timestamptz not null default now(),
 requisicao_id bigint,requisitado_em timestamptz,ticket_id text,envios int not null default 0,consultas int not null default 0,motivo text,
 unique(aviso_id,push_token_id)
);
alter table public.ficha_push_fila enable row level security;
revoke all on public.ficha_push_fila from public,anon,authenticated;
create index if not exists ficha_push_pendente on public.ficha_push_fila(disponivel_em) where estado in ('pendente','ticket','aguardando_recibo','recibo');

create or replace function public.push_token_registrar(p_tutor uuid,p_token text,p_plataforma text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.'; end if;
 if p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$' or p_plataforma is null or p_plataforma not in ('android','ios') then raise exception 'Registro de dispositivo inválido.'; end if;
 perform 1 from public.profiles where id=p_tutor for update;
 if not found then raise exception 'Perfil indisponível.'; end if;
 if (select count(*) from public.push_tokens where tutor_id=p_tutor and ativo and token<>p_token)>=100 then raise exception 'Limite de dispositivos ativos atingido.'; end if;
 insert into public.push_tokens(tutor_id,token,plataforma,ativo) values(p_tutor,p_token,p_plataforma,true)
 on conflict(token) do update set tutor_id=excluded.tutor_id,plataforma=excluded.plataforma,ativo=true returning id into v_id;
 update public.ficha_push_fila set estado='suprimido',motivo='conta_alterada',atualizado_em=now() where push_token_id=v_id and tutor_id<>p_tutor and estado in ('pendente','ticket','aguardando_recibo','recibo');
 return v_id;
end $$;
create or replace function public.push_token_desativar(p_tutor uuid,p_token text) returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.'; end if;
 update public.push_tokens set ativo=false where tutor_id=p_tutor and token=p_token returning id into v_id;
 update public.ficha_push_fila set estado='suprimido',motivo='dispositivo_desativado',atualizado_em=now() where push_token_id=v_id and estado in ('pendente','ticket','aguardando_recibo','recibo');
end $$;
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon,authenticated;
revoke all on function public.push_token_registrar(uuid,text,text),public.push_token_desativar(uuid,text) from public,anon;
grant execute on function public.push_token_registrar(uuid,text,text),public.push_token_desativar(uuid,text) to authenticated;

create or replace function public.ficha_push_permissao(p_tutor uuid,p_agora timestamptz) returns text language plpgsql stable security definer set search_path=public as $$
declare v_fuso text;v_hora time;v_aceito boolean;
begin
 if not exists(select 1 from public.profiles where id=p_tutor and coalesce(notificacoes_ativas,true)) then return 'cancelar'; end if;
 select aceito into v_aceito from public.consentimentos where tutor_id=p_tutor and tipo='avisos_push' order by registrado_em desc,aceito,id desc limit 1;
 if v_aceito=false or exists(select 1 from public.notification_prefs where tutor_id=p_tutor and tipo='outro' and not ativo) then return 'cancelar'; end if;
 select n.name into v_fuso from public.notification_settings s join pg_catalog.pg_timezone_names n on n.name=s.fuso where s.tutor_id=p_tutor;
 if v_fuso is null then select n.name into v_fuso from public.profiles p join pg_catalog.pg_timezone_names n on n.name=p.fuso_horario where p.id=p_tutor; end if;
 v_hora:=(p_agora at time zone coalesce(v_fuso,'America/Sao_Paulo'))::time;
 if not exists(select 1 from public.notification_prefs where tutor_id=p_tutor) then
  if v_hora>='22:00'::time or v_hora<'07:00'::time then return 'aguardar'; end if;
 elsif exists(select 1 from public.notification_prefs where tutor_id=p_tutor and nao_perturbe_inicio is not null and nao_perturbe_fim is not null and nao_perturbe_inicio<>nao_perturbe_fim and
   case when nao_perturbe_inicio<nao_perturbe_fim then v_hora>=nao_perturbe_inicio and v_hora<nao_perturbe_fim else v_hora>=nao_perturbe_inicio or v_hora<nao_perturbe_fim end) then return 'aguardar'; end if;
 return 'enviar';
end $$;
revoke all on function public.ficha_push_permissao(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.ficha_push_headers() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_segredo text;v_headers jsonb:='{"Content-Type":"application/json"}'::jsonb;
begin
 if to_regclass('vault.decrypted_secrets') is not null then execute 'select decrypted_secret from vault.decrypted_secrets where name=''expo_push_access_token'' order by created_at desc limit 1' into v_segredo; end if;
 if nullif(v_segredo,'') is not null then v_headers:=v_headers||jsonb_build_object('Authorization','Bearer '||v_segredo); end if;
 return v_headers;
end $$;
revoke all on function public.ficha_push_headers() from public,anon,authenticated;

create or replace function public.registrar_abertura_ficha() returns trigger language plpgsql security definer set search_path=public as $$
declare v_aviso uuid;
begin
 if new.aberturas<=old.aberturas or new.cancelado_em is not null or new.expira_em<=now() or
   (new.avisado_em is not null and new.avisado_em>now()-interval '1 hour') or
   not exists(select 1 from public.pets p where p.id=new.pet_id and p.tutor_id=new.tutor_id and p.ativo and not coalesce(p.em_memoria,false)) then return new; end if;
 insert into public.notification_log(user_id,pet_id,type,title,body,deep_link)
 values(new.tutor_id,new.pet_id,'sistema',case when new.tipo='emergencia' then 'Seu link de emergência foi aberto' else 'Sua carteirinha por link foi aberta' end,
 'Pode ter sido você ou alguém que recebeu o link. Confira ou cancele os links compartilhados no app.','/pet/'||new.pet_id::text||'/compartilhar') returning id into v_aviso;
 insert into public.ficha_push_fila(aviso_id,link_id,tutor_id,push_token_id,token_hash)
 select v_aviso,new.id,new.tutor_id,t.id,encode(extensions.digest(t.token,'sha256'),'hex') from
 (select distinct on(token) id,token from public.push_tokens where tutor_id=new.tutor_id and ativo and token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$' order by token,id)t;
 update public.carteirinha_links set avisado_em=now() where id=new.id;
 return new;
end $$;
revoke all on function public.registrar_abertura_ficha() from public,anon,authenticated;

create or replace function public.ficha_push_processar() returns integer language plpgsql security definer set search_path=public as $$
declare q public.ficha_push_fila;t public.push_tokens;n public.notification_log;r record;v_json jsonb;v_item jsonb;v_id bigint;v_permissao text;v_erro text;v_total int:=0;
begin
 for q in select * from public.ficha_push_fila where estado in ('pendente','ticket','aguardando_recibo','recibo') and disponivel_em<=now() order by disponivel_em,criado_em,id limit 100 for update skip locked loop
  v_total:=v_total+1;
  begin
   if q.criado_em<now()-interval '24 hours' then update public.ficha_push_fila set estado='expirado',atualizado_em=now() where id=q.id;continue; end if;
   select * into t from public.push_tokens where id=q.push_token_id and tutor_id=q.tutor_id and ativo and encode(extensions.digest(token,'sha256'),'hex')=q.token_hash;
   if not found then update public.ficha_push_fila set estado='suprimido',motivo='destino_alterado',atualizado_em=now() where id=q.id;continue; end if;
   if q.estado='pendente' then
    select * into n from public.notification_log where id=q.aviso_id and user_id=q.tutor_id and read_at is null;
    if not found or not exists(select 1 from public.carteirinha_links l join public.pets p on p.id=l.pet_id where l.id=q.link_id and l.tutor_id=q.tutor_id and l.cancelado_em is null and l.expira_em>now() and p.tutor_id=q.tutor_id and p.ativo and not coalesce(p.em_memoria,false)) then update public.ficha_push_fila set estado='suprimido',motivo='aviso_encerrado',atualizado_em=now() where id=q.id;continue; end if;
    v_permissao:=public.ficha_push_permissao(q.tutor_id,now());
    if v_permissao='cancelar' then update public.ficha_push_fila set estado='suprimido',motivo='preferencias',atualizado_em=now() where id=q.id;continue; end if;
    if v_permissao='aguardar' then update public.ficha_push_fila set disponivel_em=now()+interval '1 minute' where id=q.id;continue; end if;
    v_id:=net.http_post(url:='https://exp.host/--/api/v2/push/send',headers:=public.ficha_push_headers(),body:=jsonb_build_object('to',t.token,'title',n.title,'body','Um link compartilhado foi aberto. Confira seus avisos no PetLive.','sound','default','channelId','lembretes','ttl',300,'data',jsonb_build_object('url',n.deep_link,'aviso_id',n.id,'tipo','ficha_aberta')));
    update public.ficha_push_fila set estado='ticket',requisicao_id=v_id,requisitado_em=now(),disponivel_em=now()+interval '30 seconds',envios=envios+1,atualizado_em=now(),motivo=null where id=q.id;
   elsif q.estado='aguardando_recibo' then
    v_id:=net.http_post(url:='https://exp.host/--/api/v2/push/getReceipts',headers:=public.ficha_push_headers(),body:=jsonb_build_object('ids',jsonb_build_array(q.ticket_id)));
    update public.ficha_push_fila set estado='recibo',requisicao_id=v_id,requisitado_em=now(),disponivel_em=now()+interval '30 seconds',consultas=consultas+1,atualizado_em=now() where id=q.id;
   else
    select status_code,content,timed_out,error_msg into r from net._http_response where id=q.requisicao_id;
    if not found then
     if q.requisitado_em<now()-interval '5 minutes' then update public.ficha_push_fila set estado='falhou',motivo='resposta_ausente',atualizado_em=now() where id=q.id;
     else update public.ficha_push_fila set disponivel_em=now()+interval '30 seconds' where id=q.id;end if;continue;
    end if;
    if r.timed_out or r.error_msg is not null or r.status_code is null then update public.ficha_push_fila set estado='falhou',motivo='transporte_incerto',atualizado_em=now() where id=q.id;continue; end if;
    if r.status_code=429 or r.status_code>=500 then
     update public.ficha_push_fila set estado=case when q.estado='ticket' and q.envios<3 then 'pendente' when q.estado='recibo' and q.consultas<6 then 'aguardando_recibo' else 'falhou' end,disponivel_em=now()+make_interval(mins=>case when q.estado='ticket' then q.envios*5 else 15 end),motivo='http_temporario',atualizado_em=now() where id=q.id;continue;
    end if;
    if r.status_code<>200 then update public.ficha_push_fila set estado='falhou',motivo='http_rejeitado',atualizado_em=now() where id=q.id;continue;end if;
    v_json:=r.content::jsonb;
    if q.estado='ticket' then v_item:=v_json->'data';if jsonb_typeof(v_item)='array' and jsonb_array_length(v_item)=1 then v_item:=v_item->0;end if;
    else v_item:=v_json#>array['data',q.ticket_id];end if;
    if v_item->>'status'='ok' then
     if q.estado='ticket' and nullif(v_item->>'id','') is not null then update public.ficha_push_fila set estado='aguardando_recibo',ticket_id=v_item->>'id',disponivel_em=now()+interval '15 minutes',atualizado_em=now() where id=q.id;
     elsif q.estado='recibo' then update public.ficha_push_fila set estado='aceito',motivo='provedor_aceitou',atualizado_em=now() where id=q.id;
     else update public.ficha_push_fila set estado='falhou',motivo='ticket_invalido',atualizado_em=now() where id=q.id;end if;
    elsif v_item#>>'{details,error}'='DeviceNotRegistered' then
     update public.push_tokens set ativo=false where id=t.id and tutor_id=q.tutor_id and encode(extensions.digest(token,'sha256'),'hex')=q.token_hash;
     update public.ficha_push_fila set estado='falhou',motivo='DeviceNotRegistered',atualizado_em=now() where id=q.id;
    elsif q.estado='recibo' and v_item is null and q.consultas<6 then update public.ficha_push_fila set estado='aguardando_recibo',disponivel_em=now()+interval '15 minutes',atualizado_em=now() where id=q.id;
    else update public.ficha_push_fila set estado='falhou',motivo='resposta_provedor_invalida',atualizado_em=now() where id=q.id;end if;
   end if;
  exception when others then
   -- Não copia erros de transporte que possam conter tokens/headers.
   update public.ficha_push_fila set estado='falhou',motivo='erro_processamento',atualizado_em=now() where id=q.id;
  end;
 end loop;
 delete from public.ficha_push_fila where estado in ('aceito','suprimido','falhou','expirado') and atualizado_em<now()-interval '30 days';
 return v_total;
end $$;
revoke all on function public.ficha_push_processar() from public,anon,authenticated;
grant execute on function public.ficha_push_processar() to service_role;
-- Não processa histórico anterior; somente novas aberturas após a migration.
do $$ begin if to_regnamespace('cron') is not null then perform cron.schedule('petlive-ficha-push','* * * * *','select public.ficha_push_processar();');end if;end $$;
commit;

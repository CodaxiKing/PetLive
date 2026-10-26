-- Fila operacional independente do formato legado dos pedidos.
-- Nasce desligada. Não importa pedidos antigos nem instala/aciona cron.
begin;
create table if not exists public.lgpd_worker_config (
 id boolean primary key default true check(id), ativo boolean not null default false,
 ultima_execucao timestamptz
);
insert into public.lgpd_worker_config(id) values(true) on conflict do nothing;
create table if not exists public.lgpd_exclusoes (
 pedido_id uuid primary key, user_id uuid, titular_hash text not null,
 status text not null check(status in ('agendada','executando','cancelada','concluida')),
 executar_em timestamptz not null, lease uuid, lease_ate timestamptz,
 tentativas integer not null default 0, ultimo_erro text, concluida_em timestamptz
);
create unique index if not exists lgpd_exclusao_aberta on public.lgpd_exclusoes(user_id)
 where status in ('agendada','executando');
alter table public.lgpd_worker_config enable row level security;
alter table public.lgpd_exclusoes enable row level security;
revoke all on public.lgpd_worker_config,public.lgpd_exclusoes from public,anon,authenticated;
grant select,update on public.lgpd_worker_config to service_role;

create or replace function public.privacidade_solicitar_exclusao(p_tutor uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_data timestamptz;v_tipo text:='apagar';v_status text:='novo';
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.';end if;
 if not exists(select 1 from public.lgpd_worker_config where id and ativo and ultima_execucao>now()-interval '15 minutes') then raise exception 'Exclusão temporariamente indisponível.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tutor::text,1901));
 select pedido_id,executar_em into v_id,v_data from public.lgpd_exclusoes
 where user_id=p_tutor and status in ('agendada','executando');
 if found then return v_data;end if;
 -- Pedidos históricos precisam ser cancelados/revisados; não são ativados implicitamente.
 if exists(select 1 from public.lgpd_requests where user_id=p_tutor and tipo in ('apagar','excluir')
   and status in ('novo','pendente','aguardando_confirmacao','em_andamento')) then
  raise exception 'Já existe um pedido de exclusão. Atualize a tela para acompanhar ou cancelar.';
 end if;
 if exists(select 1 from pg_constraint where conrelid='public.lgpd_requests'::regclass
   and contype='c' and pg_get_constraintdef(oid) like '%''excluir''%') then v_tipo:='excluir';end if;
 if exists(select 1 from pg_constraint where conrelid='public.lgpd_requests'::regclass
   and contype='c' and pg_get_constraintdef(oid) like '%''pendente''%') then v_status:='pendente';end if;
 v_data:=now()+interval '30 days';
 insert into public.lgpd_requests(user_id,tipo,status,executar_em)
 values(p_tutor,v_tipo,v_status,v_data) returning id into v_id;
 insert into public.lgpd_exclusoes(pedido_id,user_id,titular_hash,status,executar_em)
 values(v_id,p_tutor,encode(sha256(convert_to(p_tutor::text,'UTF8')),'hex'),'agendada',v_data);
 return v_data;
end $$;

-- Fecha também o ponto de entrada antigo: não contorna a flag operacional.
create or replace function public.solicitar_exclusao_conta() returns timestamptz
language sql security definer set search_path=public as $$ select public.privacidade_solicitar_exclusao(auth.uid()) $$;

create or replace function public.privacidade_estado(p_tutor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.lgpd_exclusoes;r public.lgpd_requests;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.';end if;
 select * into j from public.lgpd_exclusoes where user_id=p_tutor and status in ('agendada','executando');
 if found then return jsonb_build_object('pedido_id',j.pedido_id,'status',j.status,'executar_em',j.executar_em,
  'pode_solicitar',false,'pode_cancelar',j.status='agendada');end if;
 select * into r from public.lgpd_requests where user_id=p_tutor and tipo in ('excluir','apagar')
  and status in ('pendente','novo','aguardando_confirmacao','em_andamento') order by criado_em desc,id desc limit 1;
 return jsonb_build_object('pedido_id',r.id,'status',r.status,'executar_em',r.executar_em,
  'pode_solicitar',r.id is null and exists(select 1 from public.lgpd_worker_config where id and ativo and ultima_execucao>now()-interval '15 minutes'),
  'pode_cancelar',r.id is not null and r.status in ('pendente','novo','aguardando_confirmacao'));
end $$;

create or replace function public.privacidade_cancelar_exclusao(p_tutor uuid,p_pedido uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
 if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'A conta mudou. Entre novamente.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tutor::text,1901));
 select status into v_status from public.lgpd_exclusoes where pedido_id=p_pedido and user_id=p_tutor for update;
 if found then
  if v_status='cancelada' then return;end if;
  if v_status<>'agendada' then raise exception 'Este pedido não pode mais ser cancelado.';end if;
  update public.lgpd_exclusoes set status='cancelada',lease=null,lease_ate=null where pedido_id=p_pedido;
 end if;
 select status into v_status from public.lgpd_requests where id=p_pedido and user_id=p_tutor and tipo in ('excluir','apagar') for update;
 if not found then raise exception 'Pedido indisponível nesta conta.';end if;
 if v_status='cancelado' then return;end if;
 if v_status not in ('pendente','novo','aguardando_confirmacao') then raise exception 'Este pedido não pode mais ser cancelado.';end if;
 update public.lgpd_requests set status='cancelado',done_at=now() where id=p_pedido;
end $$;
create or replace function public.cancelar_exclusao_conta() returns void
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 select (public.privacidade_estado(auth.uid())->>'pedido_id')::uuid into v_id;
 if v_id is not null then perform public.privacidade_cancelar_exclusao(auth.uid(),v_id);end if;
end $$;

create or replace function public.lgpd_exclusao_reivindicar()
returns table(pedido_id uuid,user_id uuid,lease uuid)
language plpgsql security definer set search_path=public as $$
declare j public.lgpd_exclusoes;
begin
 update public.lgpd_worker_config set ultima_execucao=now() where id;
 if not exists(select 1 from public.lgpd_worker_config where id and ativo) then return;end if;
 for j in select e.* from public.lgpd_exclusoes e where e.user_id is not null and e.executar_em<=now()
  and (e.status='agendada' or (e.status='executando' and e.lease_ate<=now()))
  order by e.executar_em limit 10 loop
  if not pg_try_advisory_xact_lock(hashtextextended(j.user_id::text,1901)) then continue;end if;
  select e.* into j from public.lgpd_exclusoes e where e.pedido_id=j.pedido_id
   and (e.status='agendada' or (e.status='executando' and e.lease_ate<=now())) for update skip locked;
  if not found then continue;end if;
  update public.lgpd_exclusoes e set status='executando',lease=gen_random_uuid(),lease_ate=now()+interval '5 minutes',
   tentativas=e.tentativas+1,ultimo_erro=null where e.pedido_id=j.pedido_id
   returning e.* into j;
  update public.lgpd_requests set status='em_andamento' where id=j.pedido_id;
  pedido_id:=j.pedido_id;user_id:=j.user_id;lease:=j.lease;return next;return;
 end loop;
end $$;

create or replace function public.lgpd_exclusao_renovar(p_pedido uuid,p_lease uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.lgpd_exclusoes set lease_ate=now()+interval '5 minutes'
 where pedido_id=p_pedido and status='executando' and lease=p_lease and lease_ate>now();
 if not found then raise exception 'Reserva de processamento expirada.';end if;
end $$;

create or replace function public.lgpd_exclusao_concluir(p_pedido uuid,p_lease uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_user uuid;
begin
 select user_id into v_user from public.lgpd_exclusoes where pedido_id=p_pedido;
 if v_user is null then raise exception 'Reserva de processamento expirada.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,1901));
 select user_id into v_user from public.lgpd_exclusoes where pedido_id=p_pedido and status='executando'
  and lease=p_lease and lease_ate>now() for update;
 if v_user is null then raise exception 'Reserva de processamento expirada.';end if;
 if exists(select 1 from storage.objects where split_part(name,'/',1)=v_user::text) then
  raise exception 'Storage ainda contém arquivos. Repita a limpeza.';
 end if;
 -- O recibo operacional sobrevive inclusive a FKs legadas com cascata.
 update public.lgpd_exclusoes set status='concluida',user_id=null,lease=null,lease_ate=null,concluida_em=now() where pedido_id=p_pedido;
 delete from auth.users where id=v_user;
 update public.lgpd_requests set status='concluido',done_at=now() where id=p_pedido;
end $$;

-- Aplica-se a uploads normais, URLs assinadas e escritas pelo serviço.
-- A trava sincroniza a escrita de metadados com o início da exclusão.
create or replace function public.lgpd_bloquear_storage() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_tutor text;
begin
 for v_tutor in select distinct split_part(caminho,'/',1) from unnest(
  case when tg_op='UPDATE' then array[old.name,new.name] else array[new.name] end) as caminho order by 1 loop
  if v_tutor ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
   perform pg_advisory_xact_lock(hashtextextended(v_tutor,1901));
   if exists(select 1 from public.lgpd_exclusoes where
    titular_hash=encode(sha256(convert_to(v_tutor,'UTF8')),'hex') and status in ('executando','concluida')) then
    raise exception 'A conta está em exclusão. Não é possível enviar ou mover arquivos.';
   end if;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists petlive_lgpd_upload on storage.objects;
create trigger petlive_lgpd_upload before insert or update on storage.objects for each row execute function public.lgpd_bloquear_storage();

revoke all on function public.privacidade_solicitar_exclusao(uuid),public.solicitar_exclusao_conta(),public.cancelar_exclusao_conta(),public.privacidade_estado(uuid),public.privacidade_cancelar_exclusao(uuid,uuid) from public,anon;
grant execute on function public.privacidade_solicitar_exclusao(uuid),public.solicitar_exclusao_conta(),public.cancelar_exclusao_conta(),public.privacidade_estado(uuid),public.privacidade_cancelar_exclusao(uuid,uuid) to authenticated;
revoke all on function public.lgpd_exclusao_reivindicar(),public.lgpd_exclusao_renovar(uuid,uuid),public.lgpd_exclusao_concluir(uuid,uuid),public.lgpd_bloquear_storage() from public,anon,authenticated;
grant execute on function public.lgpd_exclusao_reivindicar(),public.lgpd_exclusao_renovar(uuid,uuid),public.lgpd_exclusao_concluir(uuid,uuid) to service_role;
-- Impede que um worker antigo ignore a fila, as reservas ou a configuração.
do $$ begin
 if to_regprocedure('public.lgpd_exclusoes_vencidas()') is not null then execute 'revoke all on function public.lgpd_exclusoes_vencidas() from public,anon,authenticated,service_role';end if;
 if to_regprocedure('public.lgpd_concluir_exclusao(uuid)') is not null then execute 'revoke all on function public.lgpd_concluir_exclusao(uuid) from public,anon,authenticated,service_role';end if;
end $$;
commit;

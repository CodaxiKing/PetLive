-- Aviso no histórico privado; não representa push entregue nem identifica clínica.
begin;
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon,authenticated;
grant select(id,pet_id,type,title,body,deep_link,sent_at,read_at) on public.notification_log to authenticated;
grant update(read_at) on public.notification_log to authenticated;
drop policy if exists aviso_conta_le on public.notification_log;
create policy aviso_conta_le on public.notification_log for select to authenticated using(user_id=auth.uid());
drop policy if exists aviso_limite_conta_le on public.notification_log;
create policy aviso_limite_conta_le on public.notification_log as restrictive for select to authenticated using(user_id=auth.uid());
drop policy if exists aviso_conta_lido on public.notification_log;
create policy aviso_conta_lido on public.notification_log for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists aviso_limite_conta_lido on public.notification_log;
create policy aviso_limite_conta_lido on public.notification_log as restrictive for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create index if not exists notification_log_user_sent on public.notification_log(user_id,sent_at desc);

create or replace function public.registrar_abertura_ficha() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.aberturas<=old.aberturas or new.cancelado_em is not null or new.expira_em<=now() or
   (new.avisado_em is not null and new.avisado_em>now()-interval '1 hour') or
   not exists(select 1 from public.pets p where p.id=new.pet_id and p.tutor_id=new.tutor_id and p.ativo and not coalesce(p.em_memoria,false)) then return new; end if;
 -- A atualização pública já bloqueia a linha: consultas simultâneas não duplicam o aviso.
 insert into public.notification_log(user_id,pet_id,type,title,body,deep_link)
 values(new.tutor_id,new.pet_id,'sistema',case when new.tipo='emergencia' then 'Seu link de emergência foi aberto' else 'Sua carteirinha por link foi aberta' end,
 'Pode ter sido você ou alguém que recebeu o link. Confira ou cancele os links compartilhados no app.',
 '/pet/'||new.pet_id::text||'/compartilhar');
 update public.carteirinha_links set avisado_em=now() where id=new.id;
 return new;
end $$;
revoke all on function public.registrar_abertura_ficha() from public,anon,authenticated;
drop trigger if exists carteirinha_aviso_abertura on public.carteirinha_links;
create trigger carteirinha_aviso_abertura after update of aberturas on public.carteirinha_links for each row execute function public.registrar_abertura_ficha();
commit;

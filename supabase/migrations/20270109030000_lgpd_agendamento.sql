-- Prepara o agendamento. A instalação não cria nem ativa nenhum job.
begin;
create or replace function public.lgpd_worker_disparar() returns void
language plpgsql security definer set search_path=public as $$
declare v_url text;v_chave text;
begin
 if not exists(select 1 from public.lgpd_worker_config where id and ativo) then return;end if;
 if to_regclass('vault.decrypted_secrets') is null then raise exception 'Configure o Vault do worker.';end if;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=''project_url'' limit 1' into v_url;
 execute 'select decrypted_secret from vault.decrypted_secrets where name=''service_role_key'' limit 1' into v_chave;
 if v_url is null or v_url !~ '^https://[a-z0-9-]+\.supabase\.co$' or coalesce(length(v_chave),0)<20 then
  raise exception 'Configuração do worker indisponível.';
 end if;
 -- Segredo somente no cabeçalho, destino restrito ao endpoint hosted Supabase.
 execute 'select net.http_post(url := $1,body := ''{}''::jsonb,headers := $2,timeout_milliseconds := 120000)'
 using v_url||'/functions/v1/lgpd-delete',jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_chave);
end $$;

create or replace function public.lgpd_worker_agendar() returns bigint
language plpgsql security definer set search_path=public as $$
declare v_job bigint;
begin
 if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null or
  to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
  raise exception 'Instale pg_cron, pg_net e configure o Vault antes do agendamento.';
 end if;
 execute 'select jobid from cron.job where jobname=''petlive-lgpd-delete-v2''' into v_job;
 if v_job is not null then return v_job;end if;
 execute 'select cron.schedule($1,$2,$3)' into v_job using 'petlive-lgpd-delete-v2','*/5 * * * *','select public.lgpd_worker_disparar();';
 execute 'select cron.alter_job($1,active:=false)' using v_job;
 return v_job;
end $$;
revoke all on function public.lgpd_worker_disparar(),public.lgpd_worker_agendar() from public,anon,authenticated;
grant execute on function public.lgpd_worker_disparar(),public.lgpd_worker_agendar() to service_role;
commit;

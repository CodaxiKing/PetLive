begin;
create or replace function public.admin_integracoes_diagnostico() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_nome text;v_job bigint;v_ativo boolean;v_estado text;v_quando timestamptz;
 v_jobs jsonb:='[]';v_push jsonb:=null;v_lgpd jsonb:=null;
begin
 perform public.admin_exigir(array['leitura']::text[]);
 foreach v_nome in array array['petlive-ficha-push','petlive-eventos-proximos','petlive-resumo-despesas','petlive-links-vencidos','petlive-lgpd-delete','petlive-lgpd-delete-v2'] loop
  v_job:=null;v_ativo:=false;v_estado:=null;v_quando:=null;
  if to_regclass('cron.job') is not null then
   execute 'select jobid,active from cron.job where jobname=$1 limit 1' into v_job,v_ativo using v_nome;
   if v_job is not null and to_regclass('cron.job_run_details') is not null then
    execute 'select status,start_time from cron.job_run_details where jobid=$1 order by start_time desc limit 1'
     into v_estado,v_quando using v_job;
   end if;
  end if;
  v_jobs:=v_jobs||jsonb_build_array(jsonb_build_object('nome',v_nome,'instalado',v_job is not null,
   'ativo',coalesce(v_ativo,false),'ultima_execucao',v_quando,'ultimo_estado',v_estado));
 end loop;
 if to_regclass('public.ficha_push_fila') is not null then
  execute $q$select jsonb_build_object('pendentes',count(*) filter(where estado in ('pendente','ticket','aguardando_recibo','recibo')),
   'falhas_24h',count(*) filter(where estado='falhou' and atualizado_em>now()-interval '24 hours'),
   'pendente_mais_antigo',min(criado_em) filter(where estado in ('pendente','ticket','aguardando_recibo','recibo'))) from public.ficha_push_fila$q$ into v_push;
 end if;
 if to_regclass('public.lgpd_worker_config') is not null then
  execute 'select jsonb_build_object(''habilitado'',ativo,''ultima_execucao'',ultima_execucao,''aceita_pedidos'',ativo and ultima_execucao>now()-interval ''15 minutes'') from public.lgpd_worker_config where id' into v_lgpd;
 end if;
 return jsonb_build_object('consultado_em',statement_timestamp(),'jobs',v_jobs,'push',v_push,'exclusao',v_lgpd);
end $$;
revoke all on function public.admin_integracoes_diagnostico() from public,anon;
grant execute on function public.admin_integracoes_diagnostico() to authenticated;
commit;

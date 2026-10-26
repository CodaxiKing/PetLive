-- Controle de versão para edição/cancelamento entre abas e administradores.
begin;
alter table public.campanhas add column if not exists revisao bigint not null default 1 check(revisao>0);

create or replace function public.campanha_incrementar_revisao() returns trigger
language plpgsql set search_path=public as $$
begin new.revisao:=old.revisao+1;return new;end $$;
revoke all on function public.campanha_incrementar_revisao() from public,anon,authenticated;
drop trigger if exists campanhas_revisao on public.campanhas;
create trigger campanhas_revisao before update on public.campanhas for each row execute function public.campanha_incrementar_revisao();

create or replace function public.admin_campanhas_v2() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_dados jsonb;v_lista jsonb;
begin
 -- A RPC original mantém a guarda real de papel/2FA e as métricas existentes.
 v_dados:=public.admin_campanhas();
 select coalesce(jsonb_agg(j.item||jsonb_build_object('revisao',c.revisao) order by j.ord),'[]'::jsonb)
 into v_lista from jsonb_array_elements(v_dados->'campanhas') with ordinality j(item,ord)
 join public.campanhas c on c.id=(j.item->>'id')::uuid;
 return jsonb_set(v_dados,'{campanhas}',v_lista);
end $$;

create or replace function public.admin_campanha_salvar_v2(
 p_id uuid,p_revisao bigint,p_titulo text,p_mensagem text,p_publico text,p_link text,p_agendar_para timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_revisao bigint;v_status text;
begin
 perform public.admin_exigir(array['marketing']);
 if p_agendar_para is not null and p_agendar_para<=now() then raise exception 'Escolha um horário no futuro.';end if;
 if p_id is null then
  if p_revisao is not null then raise exception 'Crie uma nova campanha sem revisão anterior.';end if;
 else
  select revisao,status into v_revisao,v_status from public.campanhas where id=p_id for update;
  if not found then raise exception 'Campanha não encontrada. Atualize a lista.';end if;
  if v_status not in ('rascunho','agendada') then raise exception 'Campanha já enviada ou cancelada: crie outra.';end if;
  if p_revisao is null or p_revisao<>v_revisao then
   raise exception 'Esta campanha foi alterada por outra operação. Atualize a lista e abra a campanha novamente.' using errcode='40001';
  end if;
 end if;
 return public.admin_campanha_salvar(p_id,p_titulo,p_mensagem,p_publico,p_link,p_agendar_para);
end $$;

create or replace function public.admin_campanha_cancelar_v2(p_id uuid,p_revisao bigint)
returns void language plpgsql security definer set search_path=public as $$
declare v_revisao bigint;v_status text;
begin
 perform public.admin_exigir(array['marketing']);
 select revisao,status into v_revisao,v_status from public.campanhas where id=p_id for update;
 if not found then raise exception 'Campanha não encontrada. Atualize a lista.';end if;
 if v_status not in ('rascunho','agendada') then raise exception 'Só dá para cancelar rascunho ou campanha agendada.';end if;
 if p_revisao is null or p_revisao<>v_revisao then
  raise exception 'Esta campanha foi alterada por outra operação. Atualize a lista e abra a campanha novamente.' using errcode='40001';
 end if;
 perform public.admin_campanha_cancelar(p_id);
end $$;

-- Impede contornar a revisão por um painel antigo. Wrappers executam como owner.
revoke all on function public.admin_campanha_salvar(uuid,text,text,text,text,timestamptz),public.admin_campanha_cancelar(uuid) from public,anon,authenticated;
revoke all on function public.admin_campanhas_v2(),public.admin_campanha_salvar_v2(uuid,bigint,text,text,text,text,timestamptz),public.admin_campanha_cancelar_v2(uuid,bigint) from public,anon;
grant execute on function public.admin_campanhas_v2(),public.admin_campanha_salvar_v2(uuid,bigint,text,text,text,text,timestamptz),public.admin_campanha_cancelar_v2(uuid,bigint) to authenticated;
commit;

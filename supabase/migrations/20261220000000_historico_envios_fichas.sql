-- Registra intenção de envio (gerar/reutilizar), não entrega por WhatsApp.
begin;
-- A API recebe ID em texto; o schema real de places usa UUID.
do $$ declare v_def text; begin
 v_def:=pg_get_functiondef('public.criar_link_carteirinha(uuid,text[],integer,text,text,text)'::regprocedure);
 if position('where id=p_lugar' in v_def)>0 then
  execute replace(v_def,'where id=p_lugar','where id::text=p_lugar');
 elsif position('where id::text=p_lugar' in v_def)=0 then
  raise exception 'Revisar a validação de lugar na função de ficha antes de aplicar.';
 end if;
end $$;
create table if not exists public.carteirinha_envios (
 id uuid primary key default gen_random_uuid(),link_id uuid not null references public.carteirinha_links(id) on delete cascade,
 tutor_id uuid not null references public.profiles(id) on delete cascade,
 tipo text not null check(tipo in ('carteirinha','emergencia')),acao text not null check(acao in ('gerar','reutilizar')),
 lugar_id uuid references public.places(id) on delete set null,
 canal text check(canal in ('whatsapp','compartilhar','qr','copiar')),criado_em timestamptz not null default now()
);
create index if not exists carteirinha_envios_conta_data on public.carteirinha_envios(tutor_id,criado_em desc);
alter table public.carteirinha_envios enable row level security;
revoke all on public.carteirinha_envios from anon,authenticated;
grant select(id,link_id,tipo,acao,lugar_id,canal,criado_em) on public.carteirinha_envios to authenticated;
drop policy if exists envio_ficha_conta on public.carteirinha_envios;
create policy envio_ficha_conta on public.carteirinha_envios for select to authenticated using(tutor_id=auth.uid());
drop policy if exists envio_ficha_limite_conta on public.carteirinha_envios;
create policy envio_ficha_limite_conta on public.carteirinha_envios as restrictive for select to authenticated using(tutor_id=auth.uid());

create or replace function public.registrar_envio_ficha() returns trigger language plpgsql security definer set search_path=public as $$
declare v_lugar uuid;
begin
 -- Mesmo bloqueio da geração: serializa inclusive reutilizações concorrentes.
 perform 1 from public.profiles where id=new.tutor_id for update;
 if (select count(*) from public.carteirinha_envios where tutor_id=new.tutor_id and criado_em>now()-interval '1 day')>=30 then raise exception 'Muitos envios hoje. Tente novamente amanhã.'; end if;
 if new.tipo='emergencia' and (select count(*) from public.carteirinha_envios where tutor_id=new.tutor_id and tipo='emergencia' and criado_em>now()-interval '1 day')>=10 then raise exception 'Muitos envios de emergência hoje. Tente novamente amanhã.'; end if;
 select id into v_lugar from public.places where id::text=new.lugar_id;
 insert into public.carteirinha_envios(link_id,tutor_id,tipo,acao,lugar_id,canal)
 values(new.id,new.tutor_id,new.tipo,case when tg_op='INSERT' then 'gerar' else 'reutilizar' end,v_lugar,new.canal);
 return new;
end $$;
revoke all on function public.registrar_envio_ficha() from public,anon,authenticated;
drop trigger if exists carteirinha_registro_envio on public.carteirinha_links;
create trigger carteirinha_registro_envio after insert or update of lugar_id,canal on public.carteirinha_links for each row execute function public.registrar_envio_ficha();

do $$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_envios_fichas()') is null then alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_envios_fichas; end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_envios_fichas() from public,anon,authenticated;
create or replace function public.exportar_meus_dados() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return public.exportar_meus_dados_sem_envios_fichas()||jsonb_build_object('envios_fichas',coalesce((select jsonb_agg(to_jsonb(e) order by e.criado_em,e.id) from public.carteirinha_envios e where e.tutor_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
commit;

-- Cancelar a assinatura mantendo o Premium até o fim do período pago
-- (BUSINESS.md 5.13). O tutor agenda o cancelamento pelo app: a assinatura
-- passa a "cancelando", nenhuma nova cobrança é feita e o Premium continua até
-- periodo_fim. Depois disso, o cron encerra e o perfil volta ao plano grátis.
-- Assinatura feita pela loja de apps (Google Play, App Store) é cancelada lá:
-- o banco só informa o caminho. O cancelamento no Asaas (parar as cobranças)
-- é feito pela função subscription-cancel logo depois desta chamada.

alter table public.subscriptions add column if not exists cancelamento_pedido_em timestamptz;
alter table public.subscriptions add column if not exists cancelamento_motivo text check (char_length(cancelamento_motivo) <= 300);
-- O provedor ainda precisa parar a recorrência (falha de rede é retomada pelo cron).
alter table public.subscriptions add column if not exists cancelar_no_provedor boolean not null default false;

create or replace function public.assinatura_vigente(p_tutor uuid)
returns public.subscriptions language sql stable security definer set search_path = '' as $$
  select s.* from public.subscriptions s
  where s.tutor_id = p_tutor and s.status in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando') and s.periodo_fim > now()
  order by s.criado_em desc, s.id desc limit 1;
$$;

create or replace function public.assinatura_cancelar(p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  s := public.assinatura_vigente(auth.uid());
  if s.id is null then raise exception 'Você não tem uma assinatura ativa.' using errcode = '22023'; end if;
  if s.provedor in ('google_play', 'app_store') then
    raise exception 'Esta assinatura foi feita pela %. Cancele por lá: o Premium continua até o fim do período.',
      case s.provedor when 'google_play' then 'Google Play' else 'App Store' end
      using errcode = '22023', hint = 'loja_apps';
  end if;
  if s.status = 'cancelando' then
    return jsonb_build_object('id', s.id, 'status', s.status, 'periodo_fim', s.periodo_fim);
  end if;
  update public.subscriptions set status = 'cancelando', cancelamento_pedido_em = now(),
    cancelamento_motivo = nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), cancelar_no_provedor = true, atualizado_em = now()
  where id = s.id;
  insert into public.notification_log (user_id, type, title, body, deep_link)
  values (auth.uid(), 'sistema', 'Cancelamento agendado',
          'Seu Premium continua até ' || to_char(s.periodo_fim at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || '. Nenhuma nova cobrança será feita.',
          '/premium/assinatura');
  return jsonb_build_object('id', s.id, 'status', 'cancelando', 'periodo_fim', s.periodo_fim);
end;
$$;

-- Desistiu de cancelar antes do fim do período: volta a renovar.
create or replace function public.assinatura_reativar()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  s := public.assinatura_vigente(auth.uid());
  if s.id is null or s.status <> 'cancelando' then raise exception 'Não há cancelamento agendado.' using errcode = '22023'; end if;
  if not s.cancelar_no_provedor then
    -- O provedor já encerrou a recorrência: é preciso assinar de novo.
    raise exception 'A renovação já foi encerrada no pagamento. Assine de novo pela tela Premium quando o período acabar.' using errcode = '22023', hint = 'assinar';
  end if;
  update public.subscriptions set status = 'ativa', cancelamento_pedido_em = null, cancelamento_motivo = null,
    cancelar_no_provedor = false, atualizado_em = now()
  where id = s.id;
  return jsonb_build_object('id', s.id, 'status', 'ativa', 'periodo_fim', s.periodo_fim);
end;
$$;

-- Para a função subscription-cancel (chave de serviço): qual recorrência parar no Asaas.
create or replace function public.assinaturas_para_cancelar(p_tutor uuid default null)
returns table (id uuid, referencia_provedor text) language sql stable security definer set search_path = '' as $$
  select s.id, s.referencia_provedor from public.subscriptions s
  where s.cancelar_no_provedor and s.status = 'cancelando' and s.provedor = 'asaas' and (p_tutor is null or s.tutor_id = p_tutor)
  order by s.cancelamento_pedido_em limit 50;
$$;

create or replace function public.assinatura_cancelada_no_provedor(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.subscriptions set cancelar_no_provedor = false, atualizado_em = now() where id = p_id and status = 'cancelando';
$$;

-- Fim do período: cancelada e plano grátis (quando não há outra assinatura vigente).
create or replace function public.assinaturas_encerrar()
returns int language plpgsql security definer set search_path = '' as $$
declare r record; v int := 0;
begin
  for r in update public.subscriptions set status = 'cancelada', atualizado_em = now()
           where status = 'cancelando' and periodo_fim <= now() returning tutor_id loop
    if (public.assinatura_vigente(r.tutor_id)).id is null then
      update public.profiles set plano = 'gratis' where id = r.tutor_id and plano = 'premium';
      insert into public.notification_log (user_id, type, title, body, deep_link)
      values (r.tutor_id, 'sistema', 'Seu Premium terminou', 'Você continua com o plano grátis. Pode assinar de novo quando quiser.', '/premium');
    end if;
    v := v + 1;
  end loop;
  return v;
end;
$$;

-- A tela Minha assinatura passa a oferecer o cancelamento quando ele é feito pelo PetLive.
create or replace function public.minha_assinatura(p_tutor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_plano text; v_assinatura jsonb; v_provedor text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then
    raise exception 'Sua conta mudou. Abra esta tela novamente.';
  end if;
  select plano into v_plano from public.profiles where id=p_tutor;
  if not found then raise exception 'Perfil indisponível.'; end if;
  select jsonb_build_object('id',s.id,'ciclo',s.ciclo,'status',s.status,
    'periodo_inicio',s.periodo_inicio,'periodo_fim',s.periodo_fim,
    'forma_pagamento',s.forma_pagamento,'valor_centavos',s.valor_centavos,'moeda',s.moeda,
    'provedor',s.provedor), s.provedor
  into v_assinatura, v_provedor from public.subscriptions s where tutor_id=p_tutor
  -- Uma tentativa mais recente, já encerrada, não esconde um contrato vigente.
  order by (s.status in ('em_teste','ativa','pagamento_falhou','cancelando') and s.periodo_fim>now()) desc,
    s.criado_em desc,s.id desc limit 1;
  return jsonb_build_object('plano',v_plano,'assinatura',v_assinatura,
    'gestao_disponivel', v_provedor = 'asaas');
end;
$$;

revoke all on function public.assinatura_vigente(uuid), public.assinaturas_para_cancelar(uuid), public.assinatura_cancelada_no_provedor(uuid),
  public.assinaturas_encerrar() from public, anon, authenticated;
grant execute on function public.assinaturas_para_cancelar(uuid), public.assinatura_cancelada_no_provedor(uuid), public.assinaturas_encerrar() to service_role;
revoke all on function public.assinatura_cancelar(text), public.assinatura_reativar(), public.minha_assinatura(uuid) from public, anon;
grant execute on function public.assinatura_cancelar(text), public.assinatura_reativar(), public.minha_assinatura(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-assinaturas-encerrar') where exists (select 1 from cron.job where jobname = 'petlive-assinaturas-encerrar');
    perform cron.schedule('petlive-assinaturas-encerrar', '15 * * * *', 'select public.assinaturas_encerrar()');
  end if;
end $$;

notify pgrst, 'reload schema';

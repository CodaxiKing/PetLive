-- Premium vendido só pela loja de apps (Google Play e App Store), como a
-- Apple e o Google exigem para assinatura digital (BUSINESS.md 5.13).
-- R$ 19,90 por mês com 7 dias grátis: o teste é a oferta da própria loja, que
-- só cobra depois e deixa cancelar a qualquer momento na conta da loja.
-- O app compra pelo RevenueCat; a função revenuecat-webhook avisa cada
-- compra, renovação, cancelamento e vencimento, e o banco liga ou desliga o
-- Premium do tutor. O preço aqui é o que a tela mostra quando a loja ainda
-- não respondeu; quem cobra é a loja, com o preço configurado nela.

update public.premium_planos_rascunho
  set preco_centavos = 1990, dias_teste = 7, versao = versao + 1, atualizado_em = now()
  where ciclo = 'mensal';

create or replace function public.premium_planos_publicos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ciclo', p.ciclo, 'preco_centavos', p.preco_centavos, 'dias_teste', p.dias_teste)
                            order by p.ciclo desc), '[]'::jsonb)
  from premium_planos_rascunho p where p.preco_centavos is not null;
$$;
grant execute on function public.premium_planos_publicos() to anon, authenticated;

-- Momento do evento da loja: um aviso atrasado não desfaz um mais novo.
alter table public.subscriptions add column if not exists evento_em timestamptz;

-- Evento da loja (só a função revenuecat-webhook, com a chave de serviço).
create or replace function public.assinatura_loja_evento(
  p_tutor uuid, p_provedor text, p_referencia text, p_status text,
  p_inicio timestamptz, p_fim timestamptz, p_valor_centavos int, p_evento_em timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s subscriptions; v_plano text;
begin
  if p_provedor not in ('google_play', 'app_store') then raise exception 'Loja inválida.' using errcode = '22023'; end if;
  if p_status not in ('em_teste', 'ativa', 'pagamento_falhou', 'cancelando', 'cancelada', 'expirada') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from profiles where id = p_tutor) then return jsonb_build_object('ok', false, 'motivo', 'tutor_desconhecido'); end if;

  select * into s from subscriptions where provedor = p_provedor and referencia_provedor = p_referencia for update;
  if s.id is not null and s.evento_em is not null and p_evento_em < s.evento_em then
    return jsonb_build_object('ok', true, 'ignorado', 'evento_antigo');
  end if;
  if s.id is null then
    insert into subscriptions (tutor_id, provedor, referencia_provedor, ciclo, status, periodo_inicio, periodo_fim, forma_pagamento, valor_centavos, evento_em)
    values (p_tutor, p_provedor, p_referencia, 'mensal', p_status, p_inicio, greatest(p_fim, p_inicio + interval '1 minute'), 'loja_apps', p_valor_centavos, p_evento_em);
  else
    update subscriptions set tutor_id = p_tutor, status = p_status, periodo_inicio = least(periodo_inicio, p_inicio),
      periodo_fim = greatest(p_fim, least(periodo_inicio, p_inicio) + interval '1 minute'),
      valor_centavos = coalesce(p_valor_centavos, valor_centavos), evento_em = p_evento_em, atualizado_em = now()
    where id = s.id;
  end if;

  -- O plano segue a assinatura: vigente libera, encerrada volta ao grátis (outra vigente mantém).
  v_plano := case when (public.assinatura_vigente(p_tutor)).id is not null then 'premium' else 'gratis' end;
  update profiles set plano = v_plano where id = p_tutor and plano is distinct from v_plano;
  if v_plano = 'gratis' and p_status in ('expirada', 'cancelada') then
    insert into notification_log (user_id, type, title, body, deep_link)
    values (p_tutor, 'sistema', 'Seu Premium terminou', 'Você continua com o plano grátis e seus dados ficam guardados. Assine quando quiser.', '/premium');
  end if;
  return jsonb_build_object('ok', true, 'plano', v_plano);
end;
$$;
revoke all on function public.assinatura_loja_evento(uuid, text, text, text, timestamptz, timestamptz, int, timestamptz) from public, anon, authenticated;
grant execute on function public.assinatura_loja_evento(uuid, text, text, text, timestamptz, timestamptz, int, timestamptz) to service_role;

notify pgrst, 'reload schema';

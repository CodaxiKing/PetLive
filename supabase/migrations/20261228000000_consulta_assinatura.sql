begin;

-- Somente o servidor de cobrança poderá alimentar esta tabela.
-- Não concede Premium: profiles.plano continua sendo a fonte de autorização.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  provedor text not null check (provedor in ('asaas','google_play','app_store')),
  referencia_provedor text not null check (char_length(referencia_provedor) between 1 and 255),
  ciclo text not null check (ciclo in ('mensal','anual')),
  status text not null check (status in ('em_teste','ativa','pagamento_falhou','cancelando','cancelada','expirada')),
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  forma_pagamento text check (forma_pagamento in ('pix','cartao','loja_apps')),
  valor_centavos integer check (valor_centavos >= 0),
  moeda text not null default 'BRL' check (moeda = 'BRL'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (provedor, referencia_provedor),
  check (periodo_fim > periodo_inicio)
);
create index if not exists subscriptions_tutor_recente on public.subscriptions(tutor_id, criado_em desc, id desc);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;
grant all on public.subscriptions to service_role;

create or replace function public.minha_assinatura(p_tutor uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_plano text; v_assinatura jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then
    raise exception 'Sua conta mudou. Abra esta tela novamente.';
  end if;
  select plano into v_plano from public.profiles where id=p_tutor;
  if not found then raise exception 'Perfil indisponível.'; end if;
  select jsonb_build_object('id',s.id,'ciclo',s.ciclo,'status',s.status,
    'periodo_inicio',s.periodo_inicio,'periodo_fim',s.periodo_fim,
    'forma_pagamento',s.forma_pagamento,'valor_centavos',s.valor_centavos,'moeda',s.moeda,
    'provedor',s.provedor)
  into v_assinatura from public.subscriptions s where tutor_id=p_tutor
  -- Uma tentativa mais recente, já encerrada, não esconde um contrato vigente.
  order by (s.status in ('em_teste','ativa','pagamento_falhou','cancelando') and s.periodo_fim>now()) desc,
    s.criado_em desc,s.id desc limit 1;
  return jsonb_build_object('plano',v_plano,'assinatura',v_assinatura,'gestao_disponivel',false);
end;
$$;
revoke all on function public.minha_assinatura(uuid) from public,anon;
grant execute on function public.minha_assinatura(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

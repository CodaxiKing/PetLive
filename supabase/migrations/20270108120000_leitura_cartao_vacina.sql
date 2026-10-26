-- Ler cartão de vacina por foto (BUSINESS.md 5.22, Premium). A foto vai direto
-- da câmera para a função scan-vaccine-card e não é guardada: o banco só conta
-- as leituras do mês para o limite do plano.
create table if not exists public.cartao_leituras (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete set null,
  criado_em timestamptz not null default now(),
  status text not null default 'iniciada' check (status in ('iniciada', 'lida', 'falhou')),
  vacinas_lidas int
);
create index if not exists cartao_leituras_tutor_mes on public.cartao_leituras (tutor_id, criado_em desc);
alter table public.cartao_leituras enable row level security;
revoke all on public.cartao_leituras from public, anon, authenticated;

-- Leituras por mês no Premium (BUSINESS.md 10: "[x] leituras por mês").
create or replace function public.cartao_limite_mensal() returns int language sql immutable as $$ select 10 $$;

create or replace function public.cartao_leituras_mes(p_tutor uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.cartao_leituras
  where tutor_id = p_tutor and status <> 'falhou'
    and criado_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

-- Reserva uma leitura antes de chamar o serviço de imagem. Falhas devolvem a vaga.
create or replace function public.cartao_leitura_reservar(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_usadas int;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para ler o cartão.' using errcode = '42501'; end if;
  if (select plano from public.profiles where id = auth.uid()) is distinct from 'premium' then
    raise exception 'Ler o cartão de vacina por foto faz parte do Premium.' using errcode = '42501', hint = 'plano_limite';
  end if;
  if not public.is_pet_owner(p_pet_id) then raise exception 'Este pet não está disponível nesta conta.' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  v_usadas := public.cartao_leituras_mes(auth.uid());
  if v_usadas >= public.cartao_limite_mensal() then
    raise exception 'Você já fez as % leituras deste mês. No próximo mês o limite volta.', public.cartao_limite_mensal()
      using errcode = '23514', hint = 'plano_limite';
  end if;
  insert into public.cartao_leituras (tutor_id, pet_id) values (auth.uid(), p_pet_id) returning id into v_id;
  return jsonb_build_object('id', v_id, 'restantes', public.cartao_limite_mensal() - v_usadas - 1);
end;
$$;

create or replace function public.cartao_leitura_concluir(p_id uuid, p_ok boolean, p_vacinas int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cartao_leituras set status = case when p_ok then 'lida' else 'falhou' end, vacinas_lidas = p_vacinas
  where id = p_id and tutor_id = auth.uid() and status = 'iniciada';
end;
$$;

-- Para a tela: quantas leituras restam no mês.
create or replace function public.cartao_leituras_restantes()
returns int language sql stable security definer set search_path = public as $$
  select greatest(public.cartao_limite_mensal() - public.cartao_leituras_mes(auth.uid()), 0)
$$;

revoke all on function public.cartao_leitura_reservar(uuid), public.cartao_leitura_concluir(uuid, boolean, int),
  public.cartao_leituras_restantes(), public.cartao_leituras_mes(uuid) from public, anon;
grant execute on function public.cartao_leitura_reservar(uuid), public.cartao_leitura_concluir(uuid, boolean, int),
  public.cartao_leituras_restantes() to authenticated;

notify pgrst, 'reload schema';

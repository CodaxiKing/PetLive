-- PetLive: botão Dei na notificação da dose (BUSINESS.md 5.34 e fluxo 19.25).
-- Tarefa: [BACKEND] "Registrar a dose pela notificação, com origem e horário,
-- e recalcular a próxima".
--
-- A notificação é agendada no aparelho com dias de antecedência, quando a
-- linha da dose ainda pode não existir (o app só cria as doses de hoje).
-- Por isso a função recebe remédio + horário previsto e faz upsert.

alter table public.medication_doses
  add column origem text check (origem in ('app', 'notificacao', 'widget')),
  add column adiada_ate timestamptz;

comment on column public.medication_doses.origem is 'De onde veio a confirmação: app, notificacao (botão Dei) ou widget.';
comment on column public.medication_doses.adiada_ate is 'Último "Adiar 15 min": a próxima notificação desta dose.';

/**
 * Registra a dose (Dei) ou o adiamento (Adiar) de um remédio do tutor logado.
 * Devolve o horário previsto da próxima dose pendente do mesmo remédio
 * (o "recalcula a próxima" do fluxo), ou null quando não há.
 */
create or replace function public.registrar_dose(
  p_medication_id uuid,
  p_prevista_para timestamptz,
  p_acao text,
  p_origem text default 'notificacao'
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_proxima timestamptz;
  v_horario time;
  v_dia date;
  v_fim date;
  v_fuso text;
  v_local timestamp;
begin
  if p_acao not in ('dei', 'adiar') then
    raise exception 'acao invalida: %', p_acao;
  end if;

  -- RLS de medications garante que o remédio é de um pet do tutor.
  if not exists (select 1 from public.medications m where m.id = p_medication_id) then
    raise exception 'remedio nao encontrado';
  end if;

  insert into public.medication_doses (medication_id, prevista_para, confirmada_em, origem, adiada_ate)
  values (
    p_medication_id,
    p_prevista_para,
    case when p_acao = 'dei' then now() end,
    case when p_acao = 'dei' then p_origem end,
    case when p_acao = 'adiar' then now() + interval '15 minutes' end
  )
  on conflict (medication_id, prevista_para) do update
    set confirmada_em = case
          when p_acao = 'dei' then coalesce(medication_doses.confirmada_em, now())
          else medication_doses.confirmada_em
        end,
        origem = case
          when p_acao = 'dei' then coalesce(medication_doses.origem, p_origem)
          else medication_doses.origem
        end,
        adiada_ate = case
          when p_acao = 'adiar' then now() + interval '15 minutes'
          else medication_doses.adiada_ate
        end;

  -- Próxima dose: o primeiro horário do remédio depois da dose registrada,
  -- dentro do tratamento (horários repetem todo dia). Os horários são da
  -- hora local do tutor; o banco roda em UTC.
  select coalesce((select ns.fuso from public.notification_settings ns where ns.tutor_id = auth.uid()),
                  'America/Sao_Paulo')
    into v_fuso;
  v_local := p_prevista_para at time zone v_fuso;

  select m.fim into v_fim from public.medications m where m.id = p_medication_id;
  select min(h) into v_horario
    from public.medications m, unnest(m.horarios) as h
    where m.id = p_medication_id and h > v_local::time;

  v_dia := v_local::date;
  if v_horario is null then
    select min(h) into v_horario from public.medications m, unnest(m.horarios) as h where m.id = p_medication_id;
    v_dia := v_dia + 1;
  end if;

  if v_horario is not null and (v_fim is null or v_dia <= v_fim) then
    v_proxima := (v_dia + v_horario) at time zone v_fuso;
  end if;

  return v_proxima;
end;
$$;

revoke execute on function public.registrar_dose(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.registrar_dose(uuid, timestamptz, text, text) to authenticated;

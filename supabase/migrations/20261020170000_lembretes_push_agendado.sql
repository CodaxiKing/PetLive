-- PetLive: função agendada que gera e envia os lembretes (push).
-- Tarefa: [BACKEND] "Função agendada que gera e envia os lembretes (push)".
--
-- Como funciona:
--   1. pg_cron roda a cada 10 minutos a função public.aviso_lembrete_push().
--   2. Ela varre reminders ativos cuja próxima ocorrência está nas próximas 24h
--      e que ainda não foram avisadas nas últimas 24h.
--   3. Para cada um, envia push (Expo Push API via pg_net) para os tokens
--      ativos do tutor, marca ultimo_aviso_em e, quando o lembrete repete,
--      anda para a próxima ocorrência (sem repetir: desativa).
--   4. Lembretes sem token registrado não são marcados, para que o aviso
--      aconteça assim que o app registrar o token.

create extension if not exists pg_cron with schema public;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- Utilitários de recorrência
-- ============================================================
/** Próxima ocorrência de um lembrete repetido. Null quando não repete. */
create or replace function public.proximo_disparo(
  p_momento timestamptz,
  p_repetir text,
  p_intervalo_dias int
)
returns timestamptz
language sql
immutable
as $$
  select case p_repetir
    when 'diario' then p_momento + interval '1 day'
    when 'semanal' then p_momento + interval '1 week'
    when 'mensal' then p_momento + interval '1 month'
    when 'anual' then p_momento + interval '1 year'
    when 'customizado' then p_momento + make_interval(days => coalesce(p_intervalo_dias, 1))
  end;
$$;

/** Texto humano do aviso: "Hoje às 18:00", "Amanhã às 09:00", "Em 3 dias...". */
create or replace function public.corpo_aviso(p_momento timestamptz)
returns text
language sql
stable
as $$
  select case
    when p_momento < now() then 'Atrasado: ' || to_char(p_momento, 'DD/MM às HH24:MI')
    when p_momento::date = current_date then 'Hoje às ' || to_char(p_momento, 'HH24:MI')
    when p_momento::date = current_date + 1 then 'Amanhã às ' || to_char(p_momento, 'HH24:MI')
    else 'Em ' || (p_momento::date - current_date) || ' dia(s), ' || to_char(p_momento, 'DD/MM às HH24:MI')
  end;
$$;

-- ============================================================
-- Envio dos avisos
-- ============================================================
create or replace function public.aviso_lembrete_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  l record;
  v_token text;
  v_momento timestamptz;
  v_novo timestamptz;
begin
  for l in
    select r.*
    from public.reminders r
    where r.ativo
      and r.proxima_em <= now() + interval '24 hours'
      and (r.ultimo_aviso_em is null or r.ultimo_aviso_em <= now() - interval '24 hours')
      and exists (
        select 1
        from public.push_tokens t
        where t.tutor_id = r.tutor_id
          and t.ativo
      )
    order by r.proxima_em
  loop
    for v_token in
      select t.token
      from public.push_tokens t
      where t.tutor_id = l.tutor_id
        and t.ativo
    loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', v_token,
          'title', l.titulo,
          'body', public.corpo_aviso(l.proxima_em),
          'sound', 'default',
          'data', jsonb_build_object(
            'tipo', 'lembrete',
            'lembrete_tipo', l.tipo,
            'reminder_id', l.id,
            'pet_id', l.pet_id
          )
        ),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    end loop;

    -- Um aviso por lembrete a cada 24h; sem repetição, encerra o lembrete.
    update public.reminders
      set ultimo_aviso_em = now(),
          ativo = case when l.repetir is null or l.repetir = 'nao' then false else ativo end
      where id = l.id;

    -- Repetição: anda até a próxima ocorrência futura (cobre atrasos longos).
    if l.repetir is not null and l.repetir <> 'nao' then
      loop
        select proxima_em into v_momento from public.reminders where id = l.id;
        v_novo := public.proximo_disparo(v_momento, l.repetir, l.intervalo_dias);
        exit when v_novo is null or v_novo <= v_momento;
        update public.reminders set proxima_em = v_novo where id = l.id;
        exit when v_novo > now();
      end loop;
    end if;
  end loop;
end;
$$;

comment on function public.aviso_lembrete_push() is
  'Varre lembretes próximos, envia push pelos tokens do tutor e avança a recorrência.';

-- Só o dono do banco (pg_cron / postgres) pode executar.
revoke all on function public.aviso_lembrete_push() from public;
revoke all on function public.aviso_lembrete_push() from anon;
revoke all on function public.aviso_lembrete_push() from authenticated;
revoke all on function public.aviso_lembrete_push() from service_role;

-- ============================================================
-- Agendamento
-- ============================================================
select cron.schedule(
  'petlive-lembretes-push',
  '*/10 * * * *',
  $$select public.aviso_lembrete_push();$$
);

-- Avisos sem horário escolhido: cada tipo de lembrete avisa com a
-- antecedência que o cuidado pede, contada a partir da hora do lembrete.
-- Vacina, vermífugo e consulta: 1 dia antes e 2 horas antes. Banho e tosa e
-- outros: 2 horas antes. Remédio avisa no celular, 10 minutos antes da dose.
-- A mesma tabela está no app (src/notificacoes/antecedencia.ts).
-- O "Avisar 1 dia antes" por lembrete sai do app; todos passam a avisar.

create or replace function public.antecedencias_aviso(p_tipo text)
returns interval[] language sql immutable as $$
  select case p_tipo
    when 'vacina' then array[interval '1 day', interval '2 hours']
    when 'vermifugo' then array[interval '1 day', interval '2 hours']
    when 'consulta' then array[interval '1 day', interval '2 hours']
    else array[interval '2 hours']
  end;
$$;

-- Etapa de aviso ainda não enviada e já no prazo (uma por antecedência).
create or replace function public.aviso_etapa_pendente(p_tipo text, p_proxima timestamptz, p_ultimo timestamptz)
returns boolean language sql stable as $$
  select exists (
    select 1 from unnest(public.antecedencias_aviso(p_tipo)) a
    where now() >= p_proxima - a and (p_ultimo is null or p_ultimo < p_proxima - a));
$$;

-- Última etapa (a mais perto da hora): depois dela o lembrete encerra ou anda.
create or replace function public.aviso_ultima_etapa(p_tipo text, p_proxima timestamptz)
returns boolean language sql stable as $$
  select now() >= p_proxima - (select min(a) from unnest(public.antecedencias_aviso(p_tipo)) a);
$$;

update public.reminders set aviso_antes = true where not aviso_antes;
alter table public.reminders alter column aviso_antes set default true;

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
      and r.aviso_antes
      -- Etapas do tipo (1 dia e 2 horas antes), contadas da hora do próprio lembrete.
      and public.aviso_etapa_pendente(r.tipo, r.proxima_em, r.ultimo_aviso_em)
      and exists (
        select 1
        from public.push_tokens t
        where t.tutor_id = r.tutor_id
          and t.ativo
      )
      -- Tela Avisos: tipo desligado não recebe aviso (sem linha = ligado).
      and not exists (
        select 1
        from public.notification_prefs np
        where np.tutor_id = r.tutor_id
          and np.tipo = r.tipo
          and not np.ativo
      )
      -- Tela Avisos: dentro da janela do "Não perturbe", adia para depois
      -- (o lembrete continua pendente e o próximo ciclo envia).
      and not exists (
        select 1
        from public.notification_prefs np
        join public.notification_settings ns on ns.tutor_id = np.tutor_id
        where np.tutor_id = r.tutor_id
          and np.nao_perturbe_inicio is not null
          and np.nao_perturbe_fim is not null
          and (
            case
              when np.nao_perturbe_inicio <= np.nao_perturbe_fim then
                (now() at time zone ns.fuso)::time
                  between np.nao_perturbe_inicio and np.nao_perturbe_fim
              else
                ((now() at time zone ns.fuso)::time >= np.nao_perturbe_inicio
                  or (now() at time zone ns.fuso)::time < np.nao_perturbe_fim)
            end
          )
      )
      -- Modo calmo (noite de fogos): espera a noite passar.
      and not public.em_modo_calmo(r.tutor_id)
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

    -- Marca a etapa enviada. Só na última etapa o lembrete sem repetição encerra.
    update public.reminders
      set ultimo_aviso_em = now(),
          ativo = case when public.aviso_ultima_etapa(l.tipo, l.proxima_em) and (l.repetir is null or l.repetir = 'nao') then false else ativo end
      where id = l.id;

    -- Repetição, depois da última etapa: anda até a próxima ocorrência futura (cobre atrasos longos).
    if public.aviso_ultima_etapa(l.tipo, l.proxima_em) and l.repetir is not null and l.repetir <> 'nao' then
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

revoke all on function public.antecedencias_aviso(text), public.aviso_etapa_pendente(text, timestamptz, timestamptz),
  public.aviso_ultima_etapa(text, timestamptz) from public, anon;
grant execute on function public.antecedencias_aviso(text) to authenticated, service_role;

notify pgrst, 'reload schema';

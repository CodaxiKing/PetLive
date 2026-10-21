-- PetLive: "Lembrete personalizado (banho e tosa, consulta, outro)".
-- Tarefa: [APP-CLIENTE] "Lembrete personalizado (banho e tosa, consulta,
-- outro)" — o formulário ganha o interruptor "Avisar 1 dia antes" do
-- protótipo Lembrete.dc.html; sem coluna, não seria possível guardar a
-- preferência por lembrete.
--
-- aviso_antes = false: o lembrete continua listado, mas não gera
-- notificação (nem push agendado, nem notificação local do aparelho).

alter table public.reminders
  add column aviso_antes boolean not null default true;

comment on column public.reminders.aviso_antes is
  'Avisar 1 dia antes: quando falso, o lembrete não dispara notificação.';

-- O push agendado passa a ignorar lembretes com o aviso desligado.
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
      and r.proxima_em <= now() + interval '24 hours'
      and (r.ultimo_aviso_em is null or r.ultimo_aviso_em <= now() - interval '24 hours')
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
  'Varre lembretes próximos (com aviso ligado, tipo ativo e fora do Não perturbe), envia push e avança a recorrência.';

-- Só o dono do banco (pg_cron / postgres) pode executar.
revoke all on function public.aviso_lembrete_push() from public;
revoke all on function public.aviso_lembrete_push() from anon;
revoke all on function public.aviso_lembrete_push() from authenticated;
revoke all on function public.aviso_lembrete_push() from service_role;

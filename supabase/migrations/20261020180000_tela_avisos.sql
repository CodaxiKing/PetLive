-- PetLive: tela "Avisos" (ligar/desligar por tipo, horário e Não perturbe).
-- Tarefa: [APP-CLIENTE] "Tela Avisos: ligar e desligar por tipo, horário e
-- Não perturbe".
--
-- O "ligar por tipo" e a janela do "Não perturbe" já existem em
-- notification_prefs (uma linha por tipo, por tutor). Falta:
--   1. notification_settings: o "Horário dos avisos" global (hora padrão de
--      novos lembretes) e o fuso do tutor, usado pelo Não perturbe;
--   2. o push passa a respeitar as preferências: tipo desligado não avisa
--      (sem linha = padrão ligado) e dentro da janela do Não perturbe o
--      aviso espera a janela passar (o lembrete não é marcado como avisado,
--      então o próximo ciclo tenta de novo).

-- ============================================================
-- Ajustes globais dos avisos
-- ============================================================
create table public.notification_settings (
  tutor_id uuid primary key references public.profiles (id) on delete cascade,
  -- "Horário dos avisos": hora usada ao criar um lembrete e no aviso local.
  horario_avisos time not null default '09:00',
  -- Fuso do tutor para o "Não perturbe". O app é pt-BR (Brasil sem horário
  -- de verão desde 2019), então o padrão cobre todos os usuários.
  fuso text not null default 'America/Sao_Paulo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.notification_settings is
  'Ajustes globais dos avisos: horário padrão e fuso do Não perturbe.';

alter table public.notification_settings enable row level security;

create policy "notification_settings: do proprio tutor"
  on public.notification_settings
  for all
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

-- ============================================================
-- Push respeitando a tela Avisos
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
  'Varre lembretes próximos respeitando a tela Avisos (tipo e Não perturbe), envia push e avança a recorrência.';

-- Só o dono do banco (pg_cron / postgres) pode executar.
revoke all on function public.aviso_lembrete_push() from public;
revoke all on function public.aviso_lembrete_push() from anon;
revoke all on function public.aviso_lembrete_push() from authenticated;
revoke all on function public.aviso_lembrete_push() from service_role;

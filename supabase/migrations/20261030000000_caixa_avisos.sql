-- PetLive: caixa de avisos (BUSINESS.md 5.43, tela CaixaAvisos).
-- Histórico dos últimos 30 dias do que o app avisou o tutor, com lido e não
-- lido. Entradas da Fase 1: cada lembrete enviado por push (aviso_lembrete_push)
-- e cada dose de remédio marcada como Feito (no app ou na notificação).

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete set null,
  type text not null check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema')),
  title text not null,
  body text,
  -- Rota do app aberta ao tocar (ex.: /lembretes, /pet/<id>/medicamentos).
  deep_link text,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create index notification_log_user_sent on public.notification_log (user_id, sent_at desc);
create index notification_log_user_nao_lidos on public.notification_log (user_id) where read_at is null;

alter table public.notification_log enable row level security;

create policy "notification_log: tutor le os seus"
  on public.notification_log for select to authenticated
  using (user_id = auth.uid());

-- O tutor só marca como lido (o resto vem do servidor).
create policy "notification_log: tutor marca lido"
  on public.notification_log for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notification_log from anon;
revoke insert, delete, update on public.notification_log from authenticated;
grant select on public.notification_log to authenticated;
grant update (read_at) on public.notification_log to authenticated;

-- ============================================================
-- Lembrete enviado por push entra na caixa (uma linha por lembrete,
-- não por aparelho).
-- ============================================================
create or replace function public.registrar_aviso_lembrete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ultimo_aviso_em is distinct from old.ultimo_aviso_em and new.ultimo_aviso_em is not null then
    insert into notification_log (user_id, pet_id, type, title, body, deep_link)
    values (
      new.tutor_id,
      new.pet_id,
      case when old.tipo = 'vacina' then 'vacina' else 'lembrete' end,
      old.titulo,
      public.corpo_aviso(old.proxima_em),
      '/lembretes'
    );
  end if;
  return new;
end;
$$;

create trigger reminders_caixa_avisos
  after update of ultimo_aviso_em on public.reminders
  for each row execute function public.registrar_aviso_lembrete();

-- ============================================================
-- Dose marcada como Feito entra na caixa ("Antibiótico do Rex dado").
-- ============================================================
create or replace function public.registrar_aviso_dose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remedio text;
  v_pet uuid;
  v_pet_nome text;
  v_tutor uuid;
begin
  if old.confirmada_em is null and new.confirmada_em is not null then
    select m.nome, p.id, p.nome, p.tutor_id
      into v_remedio, v_pet, v_pet_nome, v_tutor
      from medications m join pets p on p.id = m.pet_id
     where m.id = new.medication_id;
    if v_tutor is not null then
      insert into notification_log (user_id, pet_id, type, title, body, deep_link)
      values (
        v_tutor,
        v_pet,
        'dose',
        v_remedio || ' ' || case when v_pet_nome is null then '' else 'do ' || v_pet_nome || ' ' end || 'dado',
        'Marcado às ' || to_char(new.confirmada_em at time zone 'America/Sao_Paulo', 'HH24:MI')
          || case when new.origem = 'notificacao' then ' pela notificação.' else '.' end,
        '/pet/' || v_pet || '/medicamentos'
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger medication_doses_caixa_avisos
  after update of confirmada_em on public.medication_doses
  for each row execute function public.registrar_aviso_dose();

-- Só os últimos 30 dias ficam na caixa.
select cron.schedule(
  'petlive-caixa-avisos-retencao',
  '40 6 * * *',
  $$ delete from public.notification_log where sent_at < now() - interval '30 days' $$
);

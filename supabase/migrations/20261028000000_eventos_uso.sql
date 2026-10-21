-- PetLive: eventos de uso para as métricas da Fase 1 (BUSINESS.md 14 e 24).
-- Só o que não fica registrado nas próprias tabelas: app aberto (tutores
-- ativos), lembrete concluído, uso do SOS e do guia offline. Doses pela
-- notificação já ficam em medication_doses.origem.
--
-- Privacidade: evento do próprio app, ligado à conta, sem terceiros nem
-- rastreio entre apps; o app só grava (nem o tutor lê pela API), a equipe
-- lê as visões abaixo com a service role, e tudo é apagado em 13 meses.

create table public.eventos_uso (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  evento text not null check (evento in (
    'app_aberto',
    'lembrete_concluido',
    'sos_aberto',
    'sos_ligou',
    'sos_rota',
    'guia_aberto'
  )),
  -- Poucos campos e sem dado pessoal (ex.: {"segundos": 12}, {"guia": "intoxicacao", "offline": true}).
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 512),
  -- Quando aconteceu no aparelho (o envio pode atrasar sem internet).
  ocorreu_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index eventos_uso_evento_quando on public.eventos_uso (evento, ocorreu_em);
create index eventos_uso_user on public.eventos_uso (user_id);

alter table public.eventos_uso enable row level security;

create policy "eventos_uso: tutor grava os seus"
  on public.eventos_uso
  for insert
  to authenticated
  with check (user_id = auth.uid() and ocorreu_em <= now() + interval '5 minutes');

revoke all on public.eventos_uso from anon;
revoke select, update, delete on public.eventos_uso from authenticated;
grant insert on public.eventos_uso to authenticated;

-- ============================================================
-- Métricas (só service role: painel admin da Fase 2 e consultas da equipe)
-- ============================================================

-- Tutores ativos e lembretes concluídos por semana.
create view public.metricas_semanais
with (security_invoker = true) as
select
  date_trunc('week', ocorreu_em)::date as semana,
  count(distinct user_id) filter (where evento = 'app_aberto') as tutores_ativos,
  count(*) filter (where evento = 'lembrete_concluido') as lembretes_concluidos,
  count(*) filter (where evento = 'sos_aberto') as sos_abertos,
  count(*) filter (where evento = 'sos_ligou') as sos_ligacoes,
  percentile_cont(0.5) within group (order by (props ->> 'segundos')::numeric)
    filter (where evento = 'sos_ligou') as sos_segundos_ate_ligar_mediana,
  count(*) filter (where evento = 'guia_aberto') as guias_abertos,
  count(*) filter (where evento = 'guia_aberto' and (props ->> 'offline')::boolean) as guias_abertos_offline
from public.eventos_uso
group by 1
order by 1 desc;

-- Doses confirmadas por semana e por onde (notificação "Dei" ou app).
create view public.metricas_doses
with (security_invoker = true) as
select
  date_trunc('week', confirmada_em)::date as semana,
  coalesce(origem, 'app') as origem,
  count(*) as doses_confirmadas
from public.medication_doses
where confirmada_em is not null
group by 1, 2
order by 1 desc, 2;

-- Retenção: dos tutores que abriram o app numa semana, quantos voltaram
-- em cada semana seguinte (gate da rede social, BUSINESS.md 14).
create view public.metricas_retencao
with (security_invoker = true) as
with semanas as (
  select distinct user_id, date_trunc('week', ocorreu_em)::date as semana
  from public.eventos_uso
  where evento = 'app_aberto'
),
coortes as (
  select user_id, min(semana) as coorte from semanas group by 1
)
select
  c.coorte,
  (s.semana - c.coorte) / 7 as semanas_depois,
  count(distinct s.user_id) as tutores
from coortes c
join semanas s using (user_id)
group by 1, 2
order by 1 desc, 2;

revoke all on public.metricas_semanais, public.metricas_doses, public.metricas_retencao from anon, authenticated;
grant select on public.metricas_semanais, public.metricas_doses, public.metricas_retencao to service_role;

-- Retenção dos dados: eventos com mais de 13 meses saem todo dia.
select cron.schedule(
  'petlive-eventos-uso-retencao',
  '30 6 * * *',
  $$ delete from public.eventos_uso where ocorreu_em < now() - interval '13 months' $$
);

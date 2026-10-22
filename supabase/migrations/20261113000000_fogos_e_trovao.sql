-- PetLive: modo fogos e trovão (BUSINESS.md 5.33, tela ModoFogos, fluxo
-- 19.24). O conteúdo mestre guarda as datas com fogos (com região e data de
-- revisão); o app avisa 3 dias antes e no dia à tarde, lembra à noite de
-- manter o pet em casa, e o modo calmo silencia os avisos não urgentes
-- naquela noite. O conteúdo não recomenda remédio.

create table public.datas_fogos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 60),
  data date not null,
  regiao text not null default 'Rio de Janeiro',
  dica text check (char_length(dica) <= 200),
  revisado_em date,
  criado_em timestamptz not null default now()
);
create index datas_fogos_data on public.datas_fogos (data);
alter table public.datas_fogos enable row level security;
revoke all on public.datas_fogos from anon, authenticated;
grant select on public.datas_fogos to authenticated;
create policy "datas_fogos: leitura" on public.datas_fogos for select to authenticated using (true);

insert into public.datas_fogos (nome, data, regiao, dica) values
  ('Réveillon', '2026-12-31', 'Rio de Janeiro', 'Fogos na orla a partir da meia-noite, com barulho também nos bairros.'),
  ('Réveillon', '2027-12-31', 'Rio de Janeiro', 'Fogos na orla a partir da meia-noite, com barulho também nos bairros.');

-- Preferências do tutor (sem linha = avisos ligados).
create table public.fogos_prefs (
  tutor_id uuid primary key references public.profiles (id) on delete cascade,
  avisar boolean not null default true,
  lembrar_em_casa boolean not null default true,
  checklist text[] not null default '{}',
  -- Noite em que o modo calmo está ligado (das 18h até as 7h do dia seguinte).
  modo_calmo_em date,
  atualizado_em timestamptz not null default now()
);
alter table public.fogos_prefs enable row level security;
revoke all on public.fogos_prefs from anon;
grant select, insert, update on public.fogos_prefs to authenticated;
create policy "fogos_prefs: tutor lê" on public.fogos_prefs for select to authenticated using (tutor_id = auth.uid());
create policy "fogos_prefs: tutor cria" on public.fogos_prefs for insert to authenticated with check (tutor_id = auth.uid());
create policy "fogos_prefs: tutor muda" on public.fogos_prefs for update to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

/** O tutor está na noite do modo calmo (18h às 7h, no fuso dele)? */
create or replace function public.em_modo_calmo(p_tutor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from fogos_prefs f
    cross join lateral (
      select coalesce((select fuso from notification_settings where tutor_id = p_tutor), 'America/Sao_Paulo') as fuso
    ) z
    where f.tutor_id = p_tutor and f.modo_calmo_em is not null
      and (now() at time zone z.fuso) >= (f.modo_calmo_em + time '18:00')
      and (now() at time zone z.fuso) < (f.modo_calmo_em + 1 + time '07:00')
  )
$$;
revoke all on function public.em_modo_calmo(uuid) from public, anon, authenticated;

-- Avisos já enviados (um por data e tipo para cada tutor).
create table public.fogos_avisos (
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  data_id uuid not null references public.datas_fogos (id) on delete cascade,
  tipo text not null check (tipo in ('3_dias', 'no_dia', 'noite')),
  enviado_em timestamptz not null default now(),
  primary key (tutor_id, data_id, tipo)
);
alter table public.fogos_avisos enable row level security;
revoke all on public.fogos_avisos from anon, authenticated;

/**
 * Avisos de fogos (pg_cron, de hora em hora): 3 dias antes e no dia a partir
 * das 15h; à noite, a partir das 19h, o lembrete de manter o pet em casa.
 * Só para quem tem pet ativo e não desligou.
 */
create or replace function public.avisar_fogos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select p.id as tutor_id, d.id as data_id, d.nome, d.data,
      (now() at time zone coalesce(ns.fuso, 'America/Sao_Paulo')) as agora_local,
      coalesce(f.avisar, true) as avisar, coalesce(f.lembrar_em_casa, true) as em_casa
    from profiles p
    left join notification_settings ns on ns.tutor_id = p.id
    left join fogos_prefs f on f.tutor_id = p.id
    join datas_fogos d on d.data between current_date - 1 and current_date + 4
    where exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria)
  loop
    if r.avisar and r.agora_local::date = r.data - 3 and r.agora_local::time >= '15:00'
      and not exists (select 1 from fogos_avisos where tutor_id = r.tutor_id and data_id = r.data_id and tipo = '3_dias') then
      insert into fogos_avisos values (r.tutor_id, r.data_id, '3_dias');
      perform public.avisar_tutor(r.tutor_id, null, 'sistema', r.nome || ' em 3 dias: noite com fogos',
        'Veja as dicas para deixar o pet tranquilo e confira a plaquinha da coleira.', '/cuidados/fogos');
    end if;
    if r.avisar and r.agora_local::date = r.data and r.agora_local::time between '15:00' and '18:59'
      and not exists (select 1 from fogos_avisos where tutor_id = r.tutor_id and data_id = r.data_id and tipo = 'no_dia') then
      insert into fogos_avisos values (r.tutor_id, r.data_id, 'no_dia');
      perform public.avisar_tutor(r.tutor_id, null, 'sistema', 'Hoje tem fogos: ' || r.nome,
        'Deixe o pet num cômodo calmo e ative o modo calmo para a noite.', '/cuidados/fogos');
    end if;
    if r.em_casa and r.agora_local::date = r.data and r.agora_local::time >= '19:00'
      and not exists (select 1 from fogos_avisos where tutor_id = r.tutor_id and data_id = r.data_id and tipo = 'noite') then
      insert into fogos_avisos values (r.tutor_id, r.data_id, 'noite');
      perform public.avisar_tutor(r.tutor_id, null, 'sistema', 'Noite de fogos: pet em casa',
        'Mantenha o pet dentro de casa, com a janela fechada e alguém por perto.', '/cuidados/fogos');
    end if;
  end loop;
end;
$$;
revoke all on function public.avisar_fogos() from public, anon, authenticated;
select cron.schedule('petlive-fogos', '5 * * * *', $$select public.avisar_fogos();$$);

-- ============================================================
-- Modo calmo: os avisos de lembrete (vacina, consulta, banho...) esperam a
-- noite passar. Remédios avisam no próprio celular e não são afetados.
-- Campanhas também não saem nessa noite.
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

create or replace function public.campanha_destinatarios(p_publico text)
returns table (tutor_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with aceite as (
    select distinct on (c.tutor_id) c.tutor_id, c.aceito
    from consentimentos c
    where c.tipo = 'dicas_novidades'
    order by c.tutor_id, c.registrado_em desc
  )
  select p.id
  from profiles p
  join aceite a on a.tutor_id = p.id and a.aceito
  join auth.users u on u.id = p.id
  where coalesce(p.notificacoes_ativas, true)
    and (u.banned_until is null or u.banned_until < now())
    and not public.em_modo_calmo(p.id)
    -- Luto: nada comercial por 60 dias depois de registrar a partida de um pet.
    and not exists (
      select 1 from memorial m join pets pm on pm.id = m.pet_id
      where pm.tutor_id = p.id and m.reativado_em is null and m.criado_em > now() - interval '60 days'
    )
    and not exists (
      select 1 from notification_log n
      where n.user_id = p.id and n.type = 'campanha' and n.sent_at > now() - interval '20 hours'
    )
    and case p_publico
      when 'todos' then true
      when 'caes' then exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria and especie = 'cao')
      when 'gatos' then exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria and especie = 'gato')
      when 'sem_pet' then not exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria)
      when 'vacina_vencendo' then exists (
        select 1 from vaccinations v join pets pe on pe.id = v.pet_id
        where pe.tutor_id = p.id and pe.ativo and not pe.em_memoria and v.proxima_dose between current_date and current_date + 14
      )
      when 'inativos' then not exists (
        select 1 from eventos_uso e where e.user_id = p.id and e.evento = 'app_aberto' and e.ocorreu_em > now() - interval '30 days'
      )
      else false
    end
$$;

-- ============================================================
-- Conteúdo mestre (painel): datas com fogos. Super e marketing editam.
-- ============================================================
create or replace function public.admin_fogos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'data', data, 'regiao', regiao, 'dica', dica, 'revisado_em', revisado_em) order by data)
    from datas_fogos where data >= current_date - 30
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_fogos_salvar(p_id uuid, p_nome text, p_data date, p_regiao text, p_dica text, p_revisado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if char_length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Dê um nome para a data.'; end if;
  if p_data is null then raise exception 'Informe a data.'; end if;
  if p_id is null then
    insert into datas_fogos (nome, data, regiao, dica, revisado_em)
    values (trim(p_nome), p_data, coalesce(nullif(trim(p_regiao), ''), 'Rio de Janeiro'), nullif(trim(coalesce(p_dica, '')), ''),
      case when p_revisado then current_date end);
  else
    update datas_fogos set nome = trim(p_nome), data = p_data, regiao = coalesce(nullif(trim(p_regiao), ''), 'Rio de Janeiro'),
      dica = nullif(trim(coalesce(p_dica, '')), ''), revisado_em = case when p_revisado then current_date else revisado_em end
    where id = p_id;
  end if;
  perform public.admin_registrar(case when p_id is null then 'cadastrou a data com fogos' else 'editou a data com fogos' end,
    'conteudo', trim(p_nome) || ' ' || to_char(p_data, 'DD/MM/YYYY'), '{}'::jsonb);
end;
$$;

create or replace function public.admin_fogos_remover(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  perform public.admin_exigir(array['marketing']);
  delete from datas_fogos where id = p_id returning nome || ' ' || to_char(data, 'DD/MM/YYYY') into v_nome;
  if v_nome is null then raise exception 'Data não encontrada.'; end if;
  perform public.admin_registrar('removeu a data com fogos', 'conteudo', v_nome, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_fogos() from public, anon;
revoke all on function public.admin_fogos_salvar(uuid, text, date, text, text, boolean) from public, anon;
revoke all on function public.admin_fogos_remover(uuid) from public, anon;
grant execute on function public.admin_fogos() to authenticated;
grant execute on function public.admin_fogos_salvar(uuid, text, date, text, text, boolean) to authenticated;
grant execute on function public.admin_fogos_remover(uuid) to authenticated;

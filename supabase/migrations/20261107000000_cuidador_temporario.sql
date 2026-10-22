-- PetLive: cuidador temporário (BUSINESS.md 5.24, telas Cuidador e
-- CuidadorVisao). O tutor cria um acesso com prazo para um ou mais pets e
-- escolhe o que o cuidador vê. O cuidador abre por link, sem conta, vê os
-- dados ao vivo e marca a dose dada. Cada acesso fica registrado.
-- Plano grátis: 1 acesso ativo; Premium: vários (BUSINESS.md 10).

alter table public.medication_doses drop constraint medication_doses_origem_check;
alter table public.medication_doses add constraint medication_doses_origem_check
  check (origem in ('app', 'notificacao', 'widget', 'cuidador'));
alter table public.medication_doses add column confirmada_por text;
comment on column public.medication_doses.confirmada_por is 'Nome do cuidador temporário que marcou a dose (origem cuidador).';

create table public.cuidador_acessos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  pet_ids uuid[] not null check (cardinality(pet_ids) between 1 and 10),
  cuidador text not null check (char_length(cuidador) between 2 and 80),
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  ver_vacinas boolean not null default true,
  ver_remedios boolean not null default true,
  ver_contatos boolean not null default true,
  revogado_em timestamptz,
  aviso_expira_em timestamptz,
  aberturas int not null default 0,
  ultima_abertura_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint cuidador_acessos_periodo check (fim > inicio and fim <= inicio + interval '60 days')
);
create index cuidador_acessos_tutor on public.cuidador_acessos (tutor_id, fim desc);

create table public.cuidador_registros (
  id bigint generated always as identity primary key,
  acesso_id uuid not null references public.cuidador_acessos (id) on delete cascade,
  acao text not null check (acao in ('abriu', 'dose')),
  detalhe text,
  criado_em timestamptz not null default now()
);
create index cuidador_registros_acesso on public.cuidador_registros (acesso_id, criado_em desc);

alter table public.cuidador_acessos enable row level security;
alter table public.cuidador_registros enable row level security;
revoke all on public.cuidador_acessos from anon, authenticated;
revoke all on public.cuidador_registros from anon, authenticated;
grant select on public.cuidador_acessos to authenticated;
grant select on public.cuidador_registros to authenticated;
create policy "cuidador_acessos: tutor vê os seus"
  on public.cuidador_acessos for select to authenticated using (tutor_id = auth.uid());
create policy "cuidador_registros: tutor vê os dos seus acessos"
  on public.cuidador_registros for select to authenticated
  using (exists (select 1 from public.cuidador_acessos a where a.id = acesso_id and a.tutor_id = auth.uid()));

create or replace function public.criar_acesso_cuidador(
  p_pets uuid[], p_cuidador text, p_fim timestamptz,
  p_vacinas boolean default true, p_remedios boolean default true, p_contatos boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_plano text := (select plano from profiles where id = auth.uid());
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if p_pets is null or cardinality(p_pets) = 0 then raise exception 'Escolha pelo menos um pet.'; end if;
  if exists (select 1 from unnest(p_pets) p where not exists (select 1 from pets where id = p and tutor_id = auth.uid() and ativo)) then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_cuidador, ''))) < 2 then raise exception 'Diga o nome de quem vai cuidar.'; end if;
  if p_fim is null or p_fim <= now() then raise exception 'O acesso precisa terminar no futuro.'; end if;
  if p_fim > now() + interval '60 days' then raise exception 'O acesso pode durar até 60 dias.'; end if;
  if coalesce(v_plano, 'gratis') <> 'premium' and exists (
    select 1 from cuidador_acessos where tutor_id = auth.uid() and revogado_em is null and fim > now()
  ) then
    raise exception 'No plano grátis é 1 acesso ativo por vez. Revogue o atual ou assine o Premium.';
  end if;

  v_codigo := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  insert into cuidador_acessos (codigo, tutor_id, pet_ids, cuidador, fim, ver_vacinas, ver_remedios, ver_contatos)
  values (v_codigo, auth.uid(), p_pets, trim(p_cuidador), p_fim, coalesce(p_vacinas, true), coalesce(p_remedios, true), coalesce(p_contatos, true));
  return jsonb_build_object('codigo', v_codigo, 'fim', p_fim);
end;
$$;

create or replace function public.revogar_acesso_cuidador(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update cuidador_acessos set revogado_em = now()
  where id = p_id and tutor_id = auth.uid() and revogado_em is null;
$$;

-- Acesso válido pelo código (null se vencido, revogado ou inexistente).
create or replace function public.cuidador_acesso_valido(p_codigo text)
returns cuidador_acessos
language sql
stable
security definer
set search_path = public
as $$
  select * from cuidador_acessos
  where codigo = p_codigo and revogado_em is null and inicio <= now() and fim > now()
$$;
revoke all on function public.cuidador_acesso_valido(text) from public, anon, authenticated;

/** Avisa o tutor: linha na caixa de avisos e push nos celulares dele. */
create or replace function public.avisar_tutor(p_tutor uuid, p_pet uuid, p_tipo text, p_titulo text, p_corpo text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aviso uuid;
  v_token text;
begin
  insert into notification_log (user_id, pet_id, type, title, body, deep_link)
  values (p_tutor, p_pet, p_tipo, p_titulo, p_corpo, p_link)
  returning id into v_aviso;
  for v_token in select token from push_tokens where tutor_id = p_tutor and ativo loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', v_token, 'title', p_titulo, 'body', p_corpo, 'sound', 'default',
        'data', jsonb_build_object('tipo', p_tipo, 'url', p_link, 'aviso_id', v_aviso)
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end;
$$;
revoke all on function public.avisar_tutor(uuid, uuid, text, text, text, text) from public, anon, authenticated;

/**
 * Visão do cuidador (página /cuidador/[codigo]), com os dados de agora.
 * Remédios: as doses de hoje no fuso do tutor, com quem marcou.
 */
create or replace function public.cuidador_visao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a cuidador_acessos := public.cuidador_acesso_valido(p_codigo);
  v_fuso text;
  v_hoje date;
  v_tutor profiles;
begin
  if a.id is null then return jsonb_build_object('valido', false); end if;
  update cuidador_acessos set aberturas = aberturas + 1, ultima_abertura_em = now() where id = a.id;
  -- Uma linha de registro por hora basta (a página recarrega sozinha).
  if not exists (select 1 from cuidador_registros where acesso_id = a.id and acao = 'abriu' and criado_em > now() - interval '1 hour') then
    insert into cuidador_registros (acesso_id, acao) values (a.id, 'abriu');
  end if;

  v_fuso := coalesce((select fuso from notification_settings where tutor_id = a.tutor_id), 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  select * into v_tutor from profiles where id = a.tutor_id;

  return jsonb_build_object(
    'valido', true,
    'cuidador', a.cuidador,
    'tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', case when a.ver_contatos then v_tutor.telefone end),
    'fim', a.fim,
    'ver', jsonb_build_object('vacinas', a.ver_vacinas, 'remedios', a.ver_remedios, 'contatos', a.ver_contatos),
    'pets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'especie', p.especie, 'sexo', p.sexo, 'foto_url', p.foto_url,
        'alergias', case when a.ver_contatos then p.alergias end,
        'veterinario', case when a.ver_contatos then p.veterinario end,
        'vacinas', case when a.ver_vacinas then coalesce((
          select jsonb_agg(jsonb_build_object('nome', v.nome, 'proxima_dose', v.proxima_dose) order by v.aplicada_em desc)
          from (select distinct on (nome) * from vaccinations where pet_id = p.id order by nome, aplicada_em desc) v
        ), '[]'::jsonb) end,
        'vermifugo', case when a.ver_vacinas then (select max(aplicado_em) from dewormings where pet_id = p.id) end,
        'doses', case when a.ver_remedios then coalesce((
          select jsonb_agg(jsonb_build_object(
            'medication_id', m.id, 'nome', m.nome, 'dose', m.dose, 'prevista_para', prev.instante,
            'confirmada_em', d.confirmada_em, 'confirmada_por', case when d.origem = 'cuidador' then d.confirmada_por else 'o tutor' end
          ) order by prev.instante)
          from medications m
          cross join lateral unnest(m.horarios) as h(hora)
          cross join lateral (select ((v_hoje + h.hora) at time zone v_fuso) as instante) prev
          left join medication_doses d on d.medication_id = m.id and d.prevista_para = prev.instante
          where m.pet_id = p.id and m.ativo and m.inicio <= v_hoje and (m.fim is null or m.fim >= v_hoje)
        ), '[]'::jsonb) end
      ) order by p.nome)
      from pets p where p.id = any (a.pet_ids) and p.ativo
    ), '[]'::jsonb)
  );
end;
$$;

/** O cuidador marca a dose como dada; o tutor é avisado. */
create or replace function public.cuidador_marcar_dose(p_codigo text, p_medication uuid, p_prevista_para timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a cuidador_acessos := public.cuidador_acesso_valido(p_codigo);
  m medications;
  v_pet pets;
begin
  if a.id is null then raise exception 'Este acesso terminou.' using errcode = '42501'; end if;
  if not a.ver_remedios then raise exception 'O tutor não liberou os remédios.' using errcode = '42501'; end if;
  select * into m from medications where id = p_medication;
  if m.id is null or not (m.pet_id = any (a.pet_ids)) then raise exception 'Remédio não encontrado.' using errcode = '42501'; end if;
  if abs(extract(epoch from (p_prevista_para - now()))) > 86400 then raise exception 'Só dá para marcar as doses de hoje.'; end if;

  insert into medication_doses (medication_id, prevista_para, confirmada_em, origem, confirmada_por)
  values (m.id, p_prevista_para, now(), 'cuidador', a.cuidador)
  on conflict (medication_id, prevista_para) do update
    set confirmada_em = coalesce(medication_doses.confirmada_em, now()),
        origem = coalesce(medication_doses.origem, 'cuidador'),
        confirmada_por = coalesce(medication_doses.confirmada_por, a.cuidador);

  insert into cuidador_registros (acesso_id, acao, detalhe) values (a.id, 'dose', m.nome);
  select * into v_pet from pets where id = m.pet_id;
  perform public.avisar_tutor(a.tutor_id, v_pet.id, 'dose',
    a.cuidador || ' deu o ' || m.nome || ' ' || case when v_pet.sexo = 'femea' then 'da ' else 'do ' end || v_pet.nome,
    'Marcado pelo acesso de cuidador às ' || to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') || '.',
    '/pet/' || v_pet.id || '/medicamentos');
end;
$$;

/** Aviso 1 dia antes de o acesso terminar (pg_cron, de hora em hora). */
create or replace function public.avisar_acessos_expirando()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a cuidador_acessos;
begin
  for a in
    select * from cuidador_acessos
    where revogado_em is null and aviso_expira_em is null and fim between now() and now() + interval '1 day'
      and fim - inicio > interval '1 day'
  loop
    update cuidador_acessos set aviso_expira_em = now() where id = a.id;
    perform public.avisar_tutor(a.tutor_id, a.pet_ids[1], 'sistema',
      'O acesso de ' || a.cuidador || ' termina amanhã',
      'Se precisar de mais tempo, crie um novo acesso no app.', '/pet/' || a.pet_ids[1] || '/cuidador');
  end loop;
end;
$$;
revoke all on function public.avisar_acessos_expirando() from public, anon, authenticated;
select cron.schedule('petlive-cuidador-expirando', '7 * * * *', $$select public.avisar_acessos_expirando();$$);

revoke all on function public.criar_acesso_cuidador(uuid[], text, timestamptz, boolean, boolean, boolean) from public, anon;
revoke all on function public.revogar_acesso_cuidador(uuid) from public, anon;
revoke all on function public.cuidador_visao(text) from public;
revoke all on function public.cuidador_marcar_dose(text, uuid, timestamptz) from public;
grant execute on function public.criar_acesso_cuidador(uuid[], text, timestamptz, boolean, boolean, boolean) to authenticated;
grant execute on function public.revogar_acesso_cuidador(uuid) to authenticated;
grant execute on function public.cuidador_visao(text) to anon, authenticated;
grant execute on function public.cuidador_marcar_dose(text, uuid, timestamptz) to anon, authenticated;

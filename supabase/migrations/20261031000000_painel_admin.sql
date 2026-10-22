-- PetLive: painel admin (BUSINESS.md 4.4 e 17.3), base e primeiras áreas.
--
-- Quem entra: membro ativo de admin_members, com o segundo fator (app
-- autenticador) verificado na sessão — o token precisa ter aal = 'aal2'.
-- O painel não lê tabelas direto: tudo passa pelas funções abaixo, que
-- conferem o papel e gravam em audit_log o que altera dados.
--
-- Primeiro super admin (uma vez por ambiente, no SQL Editor):
--   insert into admin_members (user_id, papel)
--   select id, 'super' from auth.users where email = '<e-mail>';

create table public.admin_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  papel text not null check (papel in ('super', 'financeiro', 'suporte', 'moderacao', 'marketing', 'leitura')),
  ativo boolean not null default true,
  convidado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  ultimo_acesso_em timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  acao text not null,
  alvo_tipo text,
  alvo_id text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index audit_log_quando on public.audit_log (criado_em desc);

-- Ninguém lê ou grava direto pela API: só pelas funções.
alter table public.admin_members enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.admin_members, public.audit_log from anon, authenticated;

-- ============================================================
-- Quem é o admin da sessão
-- ============================================================

/** Papel do admin da sessão, só com 2FA verificado. Null para os demais. */
create or replace function public.admin_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.papel
  from admin_members m
  where m.user_id = auth.uid()
    and m.ativo
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

/** Barra quem não tem um dos papéis pedidos (super sempre passa). */
create or replace function public.admin_exigir(p_papeis text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_papel text := public.admin_papel();
begin
  if v_papel is null then
    raise exception 'Acesso só para a equipe, com a verificação em duas etapas.' using errcode = '42501';
  end if;
  if v_papel <> 'super' and not (v_papel = any (p_papeis)) then
    raise exception 'Sua função não permite esta ação.' using errcode = '42501';
  end if;
  return v_papel;
end;
$$;

create or replace function public.admin_registrar(p_acao text, p_alvo_tipo text, p_alvo_id text, p_detalhes jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_log (admin_id, acao, alvo_tipo, alvo_id, detalhes)
  values (auth.uid(), p_acao, p_alvo_tipo, p_alvo_id, coalesce(p_detalhes, '{}'::jsonb));
$$;

/**
 * Estado da sessão para a tela de entrar: é da equipe? já verificou o 2FA?
 * Funciona sem o 2FA (é o que diz à tela que falta o código).
 */
create or replace function public.admin_eu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m admin_members;
  v_aal text := coalesce(auth.jwt() ->> 'aal', 'aal1');
begin
  select * into m from admin_members where user_id = auth.uid() and ativo;
  if not found then
    return jsonb_build_object('admin', false);
  end if;
  if v_aal = 'aal2' then
    update admin_members set ultimo_acesso_em = now() where user_id = m.user_id;
  end if;
  return jsonb_build_object(
    'admin', true,
    'papel', m.papel,
    'verificado', v_aal = 'aal2',
    'nome', (select coalesce(p.nome, u.email) from auth.users u left join profiles p on p.id = u.id where u.id = m.user_id),
    'email', (select email from auth.users where id = m.user_id)
  );
end;
$$;

-- ============================================================
-- Visão geral (todos os papéis)
-- ============================================================
create or replace function public.admin_visao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'tutores', (select count(*) from profiles),
    'tutores_novos_30d', (select count(*) from profiles where criado_em > now() - interval '30 days'),
    'ativos_7d', (select count(distinct user_id) from eventos_uso where evento = 'app_aberto' and ocorreu_em > now() - interval '7 days'),
    'ativos_30d', (select count(distinct user_id) from eventos_uso where evento = 'app_aberto' and ocorreu_em > now() - interval '30 days'),
    'pets', (select count(*) from pets where ativo),
    'pets_caes', (select count(*) from pets where ativo and especie = 'cao'),
    'pets_gatos', (select count(*) from pets where ativo and especie = 'gato'),
    'lembretes_concluidos_30d', (select count(*) from eventos_uso where evento = 'lembrete_concluido' and ocorreu_em > now() - interval '30 days'),
    'doses_confirmadas_30d', (select count(*) from medication_doses where confirmada_em > now() - interval '30 days'),
    'doses_pela_notificacao_30d', (select count(*) from medication_doses where confirmada_em > now() - interval '30 days' and origem = 'notificacao'),
    'sos_30d', (select count(*) from eventos_uso where evento = 'sos_aberto' and ocorreu_em > now() - interval '30 days'),
    'sos_ligacoes_30d', (select count(*) from eventos_uso where evento = 'sos_ligou' and ocorreu_em > now() - interval '30 days'),
    'com_lembrete_ativo', (select count(distinct tutor_id) from reminders where ativo),
    'atencao', jsonb_build_object(
      'indicacoes_em_analise', (select count(*) from sugestoes_lugar where status = 'em_analise'),
      'lgpd_pendentes', (select count(*) from lgpd_requests where status not in ('concluido', 'cancelado')),
      'contatos_7d', (select count(*) from site_contacts where criado_em > now() - interval '7 days'),
      'lojistas_interessados', (select count(*) from site_contacts where tipo = 'lojista')
    ),
    -- Tutores ativos por semana, nas últimas 12 semanas (para o gráfico).
    'ativos_por_semana', (
      select coalesce(jsonb_agg(jsonb_build_object('semana', s.semana, 'tutores', coalesce(a.tutores, 0)) order by s.semana), '[]'::jsonb)
      from (
        select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week')::date as semana
      ) s
      left join (
        select date_trunc('week', ocorreu_em)::date as semana, count(distinct user_id) as tutores
        from eventos_uso where evento = 'app_aberto' group by 1
      ) a using (semana)
    )
  );
end;
$$;

-- ============================================================
-- Usuários e pets (super, suporte, moderação e leitura)
-- ============================================================
create or replace function public.admin_usuarios(p_busca text default null, p_limite int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(trim(coalesce(p_busca, '')), '');
begin
  perform public.admin_exigir(array['suporte', 'moderacao', 'leitura']);
  return coalesce((
    select jsonb_agg(linha order by (linha ->> 'criado_em') desc)
    from (
      select jsonb_build_object(
        'id', u.id,
        'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
        'email', u.email,
        'plano', coalesce(p.plano, 'free'),
        'pets', coalesce((select string_agg(pt.nome, ', ' order by pt.criado_em) from pets pt where pt.tutor_id = u.id and pt.ativo), ''),
        'criado_em', u.created_at,
        'ultimo_acesso', u.last_sign_in_at,
        'suspenso', coalesce(u.banned_until > now(), false)
      ) as linha
      from auth.users u
      left join profiles p on p.id = u.id
      where v_busca is null
         or u.email ilike '%' || v_busca || '%'
         or p.nome ilike '%' || v_busca || '%'
         or exists (select 1 from pets pt where pt.tutor_id = u.id and pt.nome ilike '%' || v_busca || '%')
      order by u.created_at desc
      limit least(greatest(coalesce(p_limite, 50), 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

/** Ficha do tutor: cadastro, pets e contagens. Sem dados de saúde (17.3). */
create or replace function public.admin_usuario(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'moderacao', 'leitura']);
  return (
    select jsonb_build_object(
      'id', u.id,
      'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
      'email', u.email,
      'plano', coalesce(p.plano, 'free'),
      'criado_em', u.created_at,
      'ultimo_acesso', u.last_sign_in_at,
      'suspenso', coalesce(u.banned_until > now(), false),
      'pets', coalesce((
        select jsonb_agg(jsonb_build_object('nome', pt.nome, 'especie', pt.especie, 'raca', pt.raca) order by pt.criado_em)
        from pets pt where pt.tutor_id = u.id and pt.ativo
      ), '[]'::jsonb),
      'vacinas', (select count(*) from vaccinations v join pets pt on pt.id = v.pet_id where pt.tutor_id = u.id),
      'lembretes_ativos', (select count(*) from reminders r where r.tutor_id = u.id and r.ativo),
      'remedios', (select count(*) from medications m join pets pt on pt.id = m.pet_id where pt.tutor_id = u.id),
      'lugares_salvos', (select count(*) from saved_places s where s.user_id = u.id),
      'indicacoes', (select count(*) from sugestoes_lugar s where s.user_id = u.id),
      'pedidos_lgpd', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', l.tipo, 'status', l.status, 'criado_em', l.criado_em) order by l.criado_em desc)
        from lgpd_requests l where l.user_id = u.id
      ), '[]'::jsonb)
    )
    from auth.users u
    left join profiles p on p.id = u.id
    where u.id = p_id
  );
end;
$$;

/** Suspender ou reativar a conta (super e moderação). Bloqueia o login. */
create or replace function public.admin_suspender(p_id uuid, p_suspender boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.admin_exigir(array['moderacao']);
  if p_id = auth.uid() then
    raise exception 'Você não pode suspender a própria conta.';
  end if;
  if exists (select 1 from admin_members where user_id = p_id and ativo and papel = 'super')
     and public.admin_papel() <> 'super' then
    raise exception 'Só um super admin suspende outro super admin.';
  end if;
  update auth.users
     -- Data longe no futuro: o Auth (GoTrue) não entende 'infinity' e quebra o login.
     set banned_until = case when p_suspender then now() + interval '100 years' else null end
   where id = p_id;
  if not found then raise exception 'Conta não encontrada.'; end if;
  perform public.admin_registrar(
    case when p_suspender then 'suspendeu a conta' else 'reativou a conta' end,
    'usuario', p_id::text, jsonb_build_object('motivo', left(coalesce(p_motivo, ''), 300))
  );
end;
$$;

-- ============================================================
-- Equipe e auditoria (só super)
-- ============================================================
create or replace function public.admin_equipe()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array[]::text[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
      'email', u.email,
      'papel', m.papel,
      'ativo', m.ativo,
      'ultimo_acesso', m.ultimo_acesso_em,
      'tem_2fa', exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
    ) order by m.ativo desc, m.criado_em)
    from admin_members m
    join auth.users u on u.id = m.user_id
    left join profiles p on p.id = m.user_id
  ), '[]'::jsonb);
end;
$$;

/** Põe uma pessoa na equipe (precisa ter conta no PetLive) ou muda a função. */
create or replace function public.admin_definir_membro(p_email text, p_papel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform public.admin_exigir(array[]::text[]);
  if p_papel not in ('super', 'financeiro', 'suporte', 'moderacao', 'marketing', 'leitura') then
    raise exception 'Função inválida.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Não há conta com esse e-mail. A pessoa precisa criar a conta no app ou no painel antes.';
  end if;
  insert into admin_members (user_id, papel, ativo, convidado_por)
  values (v_user, p_papel, true, auth.uid())
  on conflict (user_id) do update set papel = excluded.papel, ativo = true;
  perform public.admin_registrar('definiu a função ' || p_papel, 'admin', v_user::text, jsonb_build_object('email', p_email));
end;
$$;

create or replace function public.admin_remover_membro(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array[]::text[]);
  if p_user = auth.uid() then
    raise exception 'Você não pode tirar a si mesmo da equipe.';
  end if;
  update admin_members set ativo = false where user_id = p_user;
  perform public.admin_registrar('tirou da equipe', 'admin', p_user::text);
end;
$$;

create or replace function public.admin_auditoria(p_limite int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array[]::text[]);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'quando', a.criado_em,
      'quem', coalesce(p.nome, u.email, 'equipe'),
      'acao', a.acao,
      'alvo_tipo', a.alvo_tipo,
      'alvo', case a.alvo_tipo
        when 'usuario' then (select coalesce(pp.nome, uu.email) from auth.users uu left join profiles pp on pp.id = uu.id where uu.id::text = a.alvo_id)
        when 'admin' then (select uu.email from auth.users uu where uu.id::text = a.alvo_id)
        else a.alvo_id
      end
    ) order by a.criado_em desc)
    from (select * from audit_log order by criado_em desc limit least(greatest(coalesce(p_limite, 50), 1), 200)) a
    left join auth.users u on u.id = a.admin_id
    left join profiles p on p.id = a.admin_id
  ), '[]'::jsonb);
end;
$$;

-- ============================================================
-- Permissões das funções
-- ============================================================
revoke all on function public.admin_papel() from public, anon;
revoke all on function public.admin_exigir(text[]) from public, anon, authenticated;
revoke all on function public.admin_registrar(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_eu() from public, anon;
revoke all on function public.admin_visao() from public, anon;
revoke all on function public.admin_usuarios(text, int) from public, anon;
revoke all on function public.admin_usuario(uuid) from public, anon;
revoke all on function public.admin_suspender(uuid, boolean, text) from public, anon;
revoke all on function public.admin_equipe() from public, anon;
revoke all on function public.admin_definir_membro(text, text) from public, anon;
revoke all on function public.admin_remover_membro(uuid) from public, anon;
revoke all on function public.admin_auditoria(int) from public, anon;

grant execute on function public.admin_papel() to authenticated;
grant execute on function public.admin_eu() to authenticated;
grant execute on function public.admin_visao() to authenticated;
grant execute on function public.admin_usuarios(text, int) to authenticated;
grant execute on function public.admin_usuario(uuid) to authenticated;
grant execute on function public.admin_suspender(uuid, boolean, text) to authenticated;
grant execute on function public.admin_equipe() to authenticated;
grant execute on function public.admin_definir_membro(text, text) to authenticated;
grant execute on function public.admin_remover_membro(uuid) to authenticated;
grant execute on function public.admin_auditoria(int) to authenticated;

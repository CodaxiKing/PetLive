-- PetLive: painel admin, área Sistema. Versões do app em uso, versão mínima
-- (o app abaixo dela pede para atualizar) e recursos que a equipe liga e
-- desliga sem publicar app novo (botão de emergência).

-- ============================================================
-- Configuração que o app lê ao abrir
-- ============================================================
create table public.app_config (
  chave text primary key check (chave in ('versao_minima')),
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (chave, valor) values ('versao_minima', '{"android": "0.0.0", "ios": "0.0.0"}');

create table public.recursos (
  chave text primary key,
  nome text not null,
  descricao text not null,
  ligado boolean not null default true,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
alter table public.recursos enable row level security;
revoke all on public.recursos from anon, authenticated;

insert into public.recursos (chave, nome, descricao, ordem) values
  ('carteirinha_link', 'Carteirinha por link', 'O tutor gera o link da carteirinha para a clínica ou o hotel.', 10),
  ('indicar_lugar', 'Indicar lugar pet friendly', 'O tutor sugere um lugar novo para o mapa (vai para a moderação).', 20);

/** O que o app precisa saber ao abrir. Sem login: vale antes de entrar. */
create or replace function public.config_app()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'versao_minima', (select valor from app_config where chave = 'versao_minima'),
    'recursos', coalesce((select jsonb_object_agg(chave, ligado) from recursos), '{}'::jsonb)
  )
$$;
grant execute on function public.config_app() to anon, authenticated;

-- "1.4.10" -> {1,4,10}, para comparar versões como números.
create or replace function public.versao_partes(p_versao text)
returns int[]
language sql
immutable
as $$
  select array_agg(coalesce(nullif(regexp_replace(parte, '\D', '', 'g'), ''), '0')::int order by n)
  from unnest(string_to_array(coalesce(p_versao, '0'), '.')) with ordinality as t(parte, n)
$$;

-- ============================================================
-- Sistema (todos os papéis veem; só o super muda)
-- ============================================================
create or replace function public.admin_sistema()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_minima jsonb := (select valor from app_config where chave = 'versao_minima');
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'versao_minima', v_minima,
    -- Versão mais recente de cada tutor nos últimos 30 dias, por plataforma.
    -- Aberturas sem versão vêm de builds anteriores a esta medição.
    'versoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'versao', v.versao, 'android', v.android, 'ios', v.ios, 'total', v.android + v.ios,
        'abaixo_da_minima', v.versao <> 'anterior' and (
          (v.android > 0 and versao_partes(v.versao) < versao_partes(v_minima ->> 'android'))
          or (v.ios > 0 and versao_partes(v.versao) < versao_partes(v_minima ->> 'ios'))
        )
      ) order by (v.versao = 'anterior'), versao_partes(v.versao) desc)
      from (
        select coalesce(u.versao, 'anterior') as versao,
          count(*) filter (where u.plataforma = 'android') as android,
          count(*) filter (where u.plataforma <> 'android') as ios
        from (
          select distinct on (user_id) user_id, props ->> 'versao' as versao, coalesce(props ->> 'plataforma', 'android') as plataforma
          from eventos_uso
          where evento = 'app_aberto' and ocorreu_em > now() - interval '30 days'
          order by user_id, ocorreu_em desc
        ) u
        group by 1
      ) v
    ), '[]'::jsonb),
    'ativos_30d', (select count(distinct user_id) from eventos_uso where evento = 'app_aberto' and ocorreu_em > now() - interval '30 days'),
    'avisos_7d', (select count(*) from notification_log where sent_at > now() - interval '7 days'),
    'avisos_lidos_7d', (select count(*) from notification_log where sent_at > now() - interval '7 days' and read_at is not null),
    'celulares_com_push', (select count(*) from push_tokens where ativo),
    'push_android', (select count(*) from push_tokens where ativo and plataforma = 'android'),
    'push_ios', (select count(*) from push_tokens where ativo and plataforma = 'ios'),
    'recursos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chave', r.chave, 'nome', r.nome, 'descricao', r.descricao, 'ligado', r.ligado,
        'atualizado_em', r.atualizado_em, 'por', coalesce(p.nome, u.email)
      ) order by r.ordem)
      from recursos r
      left join auth.users u on u.id = r.atualizado_por
      left join profiles p on p.id = r.atualizado_por
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_definir_recurso(p_chave text, p_ligado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  perform public.admin_exigir(array[]::text[]);
  update recursos set ligado = p_ligado, atualizado_em = now(), atualizado_por = auth.uid()
  where chave = p_chave returning nome into v_nome;
  if v_nome is null then raise exception 'Recurso não encontrado.'; end if;
  perform public.admin_registrar(case when p_ligado then 'ligou o recurso' else 'desligou o recurso' end, 'recurso', v_nome, '{}'::jsonb);
end;
$$;

create or replace function public.admin_definir_versao_minima(p_plataforma text, p_versao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_versao text := trim(coalesce(p_versao, ''));
begin
  perform public.admin_exigir(array[]::text[]);
  if p_plataforma not in ('android', 'ios') then raise exception 'Plataforma inválida.'; end if;
  if v_versao !~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$' then raise exception 'Use o formato 1.4.0.'; end if;
  update app_config set valor = jsonb_set(valor, array[p_plataforma], to_jsonb(v_versao)),
    atualizado_em = now(), atualizado_por = auth.uid()
  where chave = 'versao_minima';
  perform public.admin_registrar('mudou a versão mínima', 'sistema',
    case p_plataforma when 'android' then 'Android' else 'iOS' end || ' ' || v_versao, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_sistema() from public, anon;
revoke all on function public.admin_definir_recurso(text, boolean) from public, anon;
revoke all on function public.admin_definir_versao_minima(text, text) from public, anon;
grant execute on function public.admin_sistema() to authenticated;
grant execute on function public.admin_definir_recurso(text, boolean) to authenticated;
grant execute on function public.admin_definir_versao_minima(text, text) to authenticated;

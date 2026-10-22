-- PetLive: painel admin, áreas Relatórios e Conteúdo mestre.
-- Mesmas regras do painel (20261031000000): só membro ativo com 2FA, e o que
-- altera dados vai para audit_log.

-- ============================================================
-- Relatórios (super, financeiro, marketing e leitura)
-- ============================================================
-- Tudo agregado: nenhum tutor aparece por nome.
create or replace function public.admin_relatorios(p_dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 730));
begin
  perform public.admin_exigir(array['financeiro', 'marketing', 'leitura']);
  return jsonb_build_object(
    -- Funil de quem criou a conta no período.
    'funil', (
      select jsonb_build_object(
        'contas', count(*),
        'com_pet', count(*) filter (where exists (select 1 from pets p where p.tutor_id = c.id)),
        'com_vacina', count(*) filter (where exists (
          select 1 from vaccinations v join pets p on p.id = v.pet_id where p.tutor_id = c.id
        )),
        'com_lembrete', count(*) filter (where exists (select 1 from reminders r where r.tutor_id = c.id)),
        'voltou_7d', count(*) filter (where exists (
          select 1 from eventos_uso e
          where e.user_id = c.id and e.evento = 'app_aberto' and e.ocorreu_em >= c.criado_em + interval '7 days'
        ))
      )
      from profiles c where c.criado_em >= v_desde
    ),
    -- Retenção por mês de entrada, nos últimos 6 meses: % da turma que abriu
    -- o app em cada mês seguinte. O mês 0 é a própria entrada (100%).
    'retencao', coalesce((
      select jsonb_agg(jsonb_build_object('mes', t.mes, 'tutores', t.tutores, 'meses', t.meses) order by t.mes)
      from (
        select m.mes, count(c.id) as tutores, (
          select jsonb_agg(
            case when k = 0 then 100
            else round(100.0 * (
              select count(distinct e.user_id) from eventos_uso e
              join profiles c2 on c2.id = e.user_id
              where e.evento = 'app_aberto'
                and date_trunc('month', c2.criado_em) = m.mes
                and date_trunc('month', e.ocorreu_em) = m.mes + make_interval(months => k)
            ) / nullif(count(c.id), 0)) end
            order by k
          )
          from generate_series(0, (extract(year from age(date_trunc('month', now()), m.mes)) * 12
            + extract(month from age(date_trunc('month', now()), m.mes)))::int) k
        ) as meses
        from (
          select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as mes
        ) m
        left join profiles c on date_trunc('month', c.criado_em) = m.mes
        group by m.mes
      ) t
    ), '[]'::jsonb),
    -- Dias entre cadastrar o pet e registrar a 1ª vacina (mediana).
    'dias_ate_vacina', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (v.primeira - p.criado_em)) / 86400))::numeric, 1)
      from pets p
      join (select pet_id, min(criado_em) as primeira from vaccinations group by pet_id) v on v.pet_id = p.id
      where p.criado_em >= v_desde
    ),
    'pets_com_vacina_pct', (
      select round(100.0 * count(*) filter (where exists (select 1 from vaccinations v where v.pet_id = p.id)) / nullif(count(*), 0))
      from pets p where p.ativo
    ),
    'especies', jsonb_build_object(
      'cao', (select count(*) from pets where ativo and especie = 'cao'),
      'gato', (select count(*) from pets where ativo and especie = 'gato')
    ),
    -- No lugar de "tutores por bairro" (o app não pede endereço): raças mais comuns.
    'racas', coalesce((
      select jsonb_agg(jsonb_build_object('raca', r.raca, 'pets', r.pets, 'pct', r.pct) order by r.pets desc)
      from (
        select coalesce(nullif(trim(raca), ''), 'Sem raça definida') as raca, count(*) as pets,
          round(100.0 * count(*) / sum(count(*)) over ()) as pct
        from pets where ativo group by 1 order by 2 desc limit 5
      ) r
    ), '[]'::jsonb),
    -- Novas contas por dia no período (para o CSV e o gráfico).
    'contas_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'contas', coalesce(n.contas, 0)) order by d.dia)
      from (select generate_series(v_desde::date, current_date, interval '1 day')::date as dia) d
      left join (select criado_em::date as dia, count(*) as contas from profiles group by 1) n using (dia)
    ), '[]'::jsonb)
  );
end;
$$;

-- ============================================================
-- Conteúdo mestre: calendário de vacinas versionado
-- ============================================================
-- As colunas *_meses guardam DIAS (o app sempre leu assim; o nome ficou da
-- primeira versão do schema).
comment on column public.vaccine_schedule.primeira_dose_meses is 'Idade mínima da primeira dose, em dias.';
comment on column public.vaccine_schedule.reforco_meses is 'Intervalo entre as doses seguintes, em dias. Null = dose única.';

alter table public.vaccine_schedule add column obrigatoria boolean not null default false;
update public.vaccine_schedule set obrigatoria = true
where nome in ('V10', 'Antirrábica', 'V4 Felina', 'V5 Felina', 'Vermífugo (rotina)');

-- Cada publicação guarda a foto do calendário inteiro: dá para ver o que
-- mudou e voltar atrás.
create table public.conteudo_versoes (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('calendario_vacinas')),
  versao int not null,
  resumo text not null,
  conteudo jsonb not null,
  publicado_por uuid references auth.users (id) on delete set null,
  publicado_em timestamptz not null default now(),
  unique (tipo, versao)
);
alter table public.conteudo_versoes enable row level security;
revoke all on public.conteudo_versoes from anon, authenticated;

create or replace function public.calendario_foto()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'especie', especie, 'nome', nome, 'primeira_dose_dias', primeira_dose_meses,
    'reforco_dias', reforco_meses, 'descricao', descricao, 'obrigatoria', obrigatoria, 'ordem', ordem
  ) order by especie, ordem), '[]'::jsonb)
  from vaccine_schedule
$$;
revoke all on function public.calendario_foto() from public, anon, authenticated;

insert into public.conteudo_versoes (tipo, versao, resumo, conteudo)
select 'calendario_vacinas', 1, 'Calendário inicial', public.calendario_foto();

create or replace function public.admin_conteudo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'vacinas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'especie', especie, 'nome', nome, 'primeira_dose_dias', primeira_dose_meses,
        'reforco_dias', reforco_meses, 'descricao', descricao, 'obrigatoria', obrigatoria, 'ordem', ordem
      ) order by especie, ordem)
      from vaccine_schedule
    ), '[]'::jsonb),
    'versoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'versao', v.versao, 'resumo', v.resumo, 'publicado_em', v.publicado_em,
        'por', coalesce(p.nome, u.email, 'sistema')
      ) order by v.versao desc)
      from (select * from conteudo_versoes where tipo = 'calendario_vacinas' order by versao desc limit 20) v
      left join auth.users u on u.id = v.publicado_por
      left join profiles p on p.id = v.publicado_por
    ), '[]'::jsonb),
    'pacotes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tipo', tipo, 'versao', versao, 'publicado', publicado, 'revisado_por', revisado_por,
        'crmv', crmv, 'revisado_em', revisado_em, 'criado_em', criado_em, 'tamanho', length(conteudo::text)
      ) order by tipo, versao desc)
      from content_packs
    ), '[]'::jsonb)
  );
end;
$$;

-- Salva uma vacina (nova quando p_id é null) e publica a nova versão do
-- calendário. Conteúdo de saúde: só o super admin.
create or replace function public.admin_vacina_salvar(
  p_id uuid, p_especie text, p_nome text, p_primeira_dias int, p_reforco_dias int,
  p_descricao text, p_obrigatoria boolean, p_ordem int default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes jsonb;
  v_id uuid;
  v_versao int;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  perform public.admin_exigir(array[]::text[]);
  if char_length(v_nome) < 2 then raise exception 'Dê um nome para a vacina.'; end if;
  if p_especie not in ('cao', 'gato') then raise exception 'Escolha cão ou gato.'; end if;
  if p_primeira_dias is null or p_primeira_dias < 0 or p_primeira_dias > 3650 then
    raise exception 'A 1ª dose precisa ser entre 0 e 3650 dias de vida.';
  end if;
  if p_reforco_dias is not null and (p_reforco_dias < 1 or p_reforco_dias > 3650) then
    raise exception 'O reforço precisa ser entre 1 e 3650 dias (ou vazio para dose única).';
  end if;

  if p_id is null then
    insert into vaccine_schedule (especie, nome, primeira_dose_meses, reforco_meses, descricao, obrigatoria, ordem)
    values (p_especie, v_nome, p_primeira_dias, p_reforco_dias, nullif(trim(coalesce(p_descricao, '')), ''),
      coalesce(p_obrigatoria, false),
      coalesce(p_ordem, (select coalesce(max(ordem), 0) + 10 from vaccine_schedule where especie = p_especie)))
    returning id into v_id;
  else
    select to_jsonb(s) into v_antes from vaccine_schedule s where id = p_id;
    if v_antes is null then raise exception 'Vacina não encontrada.'; end if;
    update vaccine_schedule set
      especie = p_especie, nome = v_nome, primeira_dose_meses = p_primeira_dias, reforco_meses = p_reforco_dias,
      descricao = nullif(trim(coalesce(p_descricao, '')), ''), obrigatoria = coalesce(p_obrigatoria, false),
      ordem = coalesce(p_ordem, ordem)
    where id = p_id;
    v_id := p_id;
  end if;

  select coalesce(max(versao), 0) + 1 into v_versao from conteudo_versoes where tipo = 'calendario_vacinas';
  insert into conteudo_versoes (tipo, versao, resumo, conteudo, publicado_por)
  values ('calendario_vacinas', v_versao,
    case when p_id is null then 'Nova vacina: ' else 'Editou: ' end || v_nome,
    public.calendario_foto(), auth.uid());
  perform public.admin_registrar(
    case when p_id is null then 'cadastrou a vacina' else 'editou a vacina' end,
    'vacina', v_nome, jsonb_build_object('id', v_id, 'versao', v_versao, 'antes', v_antes)
  );
  return v_versao;
end;
$$;

create or replace function public.admin_vacina_remover(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes jsonb;
  v_versao int;
begin
  perform public.admin_exigir(array[]::text[]);
  delete from vaccine_schedule where id = p_id returning to_jsonb(vaccine_schedule.*) into v_antes;
  if v_antes is null then raise exception 'Vacina não encontrada.'; end if;
  select coalesce(max(versao), 0) + 1 into v_versao from conteudo_versoes where tipo = 'calendario_vacinas';
  insert into conteudo_versoes (tipo, versao, resumo, conteudo, publicado_por)
  values ('calendario_vacinas', v_versao, 'Removeu: ' || (v_antes ->> 'nome'), public.calendario_foto(), auth.uid());
  perform public.admin_registrar('removeu a vacina', 'vacina', v_antes ->> 'nome',
    jsonb_build_object('versao', v_versao, 'antes', v_antes));
  return v_versao;
end;
$$;

-- ============================================================
-- Conteúdo mestre: pacotes offline (emergência e calculadoras)
-- ============================================================
-- Cria o rascunho da próxima versão; publicar é outro passo.
create or replace function public.admin_pacote_rascunho(p_tipo text, p_conteudo jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_versao int;
begin
  perform public.admin_exigir(array[]::text[]);
  if p_tipo not in ('emergencia', 'calculadoras') then raise exception 'Tipo de pacote inválido.'; end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' then
    raise exception 'O conteúdo precisa ser um objeto JSON.';
  end if;
  -- O app já vem com a versão 1 embutida: a primeira do servidor é a 2.
  select greatest(coalesce(max(versao), 1), 1) + 1 into v_versao from content_packs where tipo = p_tipo;
  insert into content_packs (tipo, versao, conteudo) values (p_tipo, v_versao, p_conteudo);
  perform public.admin_registrar('criou o rascunho do pacote', 'pacote', p_tipo || ' v' || v_versao, '{}'::jsonb);
  return v_versao;
end;
$$;

-- Emergência só publica com a revisão de um veterinário (nome e CRMV).
create or replace function public.admin_pacote_publicar(p_id uuid, p_revisado_por text default null, p_crmv text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pacote content_packs;
begin
  perform public.admin_exigir(array[]::text[]);
  select * into v_pacote from content_packs where id = p_id;
  if v_pacote.id is null then raise exception 'Pacote não encontrado.'; end if;
  if v_pacote.publicado then raise exception 'Este pacote já está publicado.'; end if;
  if v_pacote.tipo = 'emergencia'
    and (char_length(trim(coalesce(p_revisado_por, ''))) < 3 or char_length(trim(coalesce(p_crmv, ''))) < 3) then
    raise exception 'O conteúdo de emergência só publica com o nome e o CRMV do veterinário que revisou.';
  end if;
  update content_packs set
    publicado = true,
    revisado_por = coalesce(nullif(trim(coalesce(p_revisado_por, '')), ''), revisado_por),
    crmv = coalesce(nullif(trim(coalesce(p_crmv, '')), ''), crmv),
    revisado_em = case when nullif(trim(coalesce(p_revisado_por, '')), '') is null then revisado_em else now() end
  where id = p_id;
  perform public.admin_registrar('publicou o pacote', 'pacote', v_pacote.tipo || ' v' || v_pacote.versao,
    jsonb_build_object('revisado_por', p_revisado_por, 'crmv', p_crmv));
end;
$$;

-- ============================================================
-- Permissões
-- ============================================================
revoke all on function public.admin_relatorios(int) from public, anon;
revoke all on function public.admin_conteudo() from public, anon;
revoke all on function public.admin_vacina_salvar(uuid, text, text, int, int, text, boolean, int) from public, anon;
revoke all on function public.admin_vacina_remover(uuid) from public, anon;
revoke all on function public.admin_pacote_rascunho(text, jsonb) from public, anon;
revoke all on function public.admin_pacote_publicar(uuid, text, text) from public, anon;
grant execute on function public.admin_relatorios(int) to authenticated;
grant execute on function public.admin_conteudo() to authenticated;
grant execute on function public.admin_vacina_salvar(uuid, text, text, int, int, text, boolean, int) to authenticated;
grant execute on function public.admin_vacina_remover(uuid) to authenticated;
grant execute on function public.admin_pacote_rascunho(text, jsonb) to authenticated;
grant execute on function public.admin_pacote_publicar(uuid, text, text) to authenticated;

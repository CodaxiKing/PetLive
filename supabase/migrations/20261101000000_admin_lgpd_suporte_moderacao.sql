-- PetLive: painel admin, áreas Privacidade e LGPD, Suporte e Moderação.
-- Mesmas regras do painel (20261031000000): só membro ativo com 2FA, e o que
-- altera dados vai para audit_log.

-- ============================================================
-- Suporte: as mensagens do site viram chamados
-- ============================================================
alter table public.site_contacts
  add column status text not null default 'aberto' check (status in ('aberto', 'respondido', 'fechado')),
  add column prioridade text not null default 'normal' check (prioridade in ('normal', 'alta')),
  add column atribuido_a uuid references auth.users (id) on delete set null,
  add column respondido_em timestamptz,
  add column fechado_em timestamptz;

-- Notas e respostas do chamado (a resposta ao cliente sai por e-mail).
create table public.site_contact_notas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.site_contacts (id) on delete cascade,
  autor_id uuid references auth.users (id) on delete set null,
  tipo text not null check (tipo in ('nota', 'resposta')),
  texto text not null check (char_length(texto) between 1 and 4000),
  criado_em timestamptz not null default now()
);
create index site_contact_notas_contato on public.site_contact_notas (contato_id, criado_em);
alter table public.site_contact_notas enable row level security;
revoke all on public.site_contact_notas from anon, authenticated;

create or replace function public.admin_suporte()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'leitura']);
  return jsonb_build_object(
    'abertos', (select count(*) from site_contacts where status = 'aberto'),
    'abertos_lojistas', (select count(*) from site_contacts where status = 'aberto' and tipo = 'lojista'),
    'sem_resposta_2h', (select count(*) from site_contacts where status = 'aberto' and criado_em < now() - interval '2 hours'),
    'tempo_medio_min', (
      select round(extract(epoch from avg(respondido_em - criado_em)) / 60)
      from site_contacts where respondido_em > now() - interval '30 days'
    ),
    'resolvidos_30d', (select count(*) from site_contacts where fechado_em > now() - interval '30 days'),
    'chamados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'tipo', c.tipo, 'nome', c.nome, 'email', c.email, 'telefone', c.telefone,
        'mensagem', c.mensagem, 'loja_nome', c.loja_nome, 'loja_tipo', c.loja_tipo, 'cidade', c.cidade,
        'status', c.status, 'prioridade', c.prioridade, 'criado_em', c.criado_em,
        'atribuido_a', c.atribuido_a, 'meu', c.atribuido_a = auth.uid(),
        'tem_conta', exists (select 1 from auth.users u where lower(u.email) = lower(c.email))
      ) order by (c.status = 'aberto') desc, (c.prioridade = 'alta') desc, c.criado_em desc)
      from (select * from site_contacts order by criado_em desc limit 200) c
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_suporte_notas(p_contato uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'leitura']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'tipo', n.tipo, 'texto', n.texto, 'criado_em', n.criado_em,
      'autor', coalesce(p.nome, u.email, 'equipe')
    ) order by n.criado_em)
    from site_contact_notas n
    left join auth.users u on u.id = n.autor_id
    left join profiles p on p.id = n.autor_id
    where n.contato_id = p_contato
  ), '[]'::jsonb);
end;
$$;

/**
 * Ação no chamado: 'responder' (registra a resposta enviada por e-mail),
 * 'nota' (interna), 'assumir', 'fechar', 'reabrir' ou 'prioridade' (alta/normal).
 */
create or replace function public.admin_suporte_acao(p_contato uuid, p_acao text, p_texto text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte']);
  if not exists (select 1 from site_contacts where id = p_contato) then
    raise exception 'Chamado não encontrado.';
  end if;

  if p_acao in ('responder', 'nota') then
    if char_length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva o texto.'; end if;
    insert into site_contact_notas (contato_id, autor_id, tipo, texto)
    values (p_contato, auth.uid(), case when p_acao = 'responder' then 'resposta' else 'nota' end, left(trim(p_texto), 4000));
    if p_acao = 'responder' then
      update site_contacts
         set status = 'respondido', respondido_em = coalesce(respondido_em, now()),
             atribuido_a = coalesce(atribuido_a, auth.uid())
       where id = p_contato;
    end if;
  elsif p_acao = 'assumir' then
    update site_contacts set atribuido_a = auth.uid() where id = p_contato;
  elsif p_acao = 'fechar' then
    update site_contacts set status = 'fechado', fechado_em = now() where id = p_contato;
  elsif p_acao = 'reabrir' then
    update site_contacts set status = 'aberto', fechado_em = null where id = p_contato;
  elsif p_acao = 'prioridade' then
    if p_texto not in ('alta', 'normal') then raise exception 'Prioridade inválida.'; end if;
    update site_contacts set prioridade = p_texto where id = p_contato;
  else
    raise exception 'Ação inválida.';
  end if;

  if p_acao <> 'nota' then
    perform public.admin_registrar(
      case p_acao when 'responder' then 'respondeu o chamado' when 'assumir' then 'assumiu o chamado'
        when 'fechar' then 'fechou o chamado' when 'reabrir' then 'reabriu o chamado'
        else 'mudou a prioridade do chamado' end,
      'chamado', p_contato::text
    );
  end if;
end;
$$;

-- ============================================================
-- Privacidade e LGPD
-- ============================================================
create or replace function public.admin_lgpd()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'leitura']);
  return jsonb_build_object(
    'abertos', (select count(*) from lgpd_requests where status not in ('concluido', 'cancelado')),
    'concluidos_30d', (select count(*) from lgpd_requests where status = 'concluido' and done_at > now() - interval '30 days'),
    'dias_medio', (
      select round(extract(epoch from avg(done_at - criado_em)) / 86400, 1)
      from lgpd_requests where status = 'concluido' and done_at > now() - interval '90 days'
    ),
    'atrasados', (select count(*) from lgpd_requests where status not in ('concluido', 'cancelado') and due_at < now()),
    'termos_aceitos_pct', (
      select round(100.0 * count(*) filter (where aceite_termos) / nullif(count(*), 0), 1) from profiles
    ),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'tipo', r.tipo, 'status', r.status, 'criado_em', r.criado_em,
        'due_at', r.due_at, 'executar_em', r.executar_em, 'done_at', r.done_at,
        'email', coalesce(u.email, r.email),
        'nome', coalesce(p.nome, split_part(coalesce(u.email, r.email), '@', 1), 'conta apagada')
      ) order by (r.status in ('concluido', 'cancelado')), r.due_at nulls last, r.criado_em desc)
      from (select * from lgpd_requests order by criado_em desc limit 200) r
      left join auth.users u on u.id = r.user_id
      left join profiles p on p.id = r.user_id
    ), '[]'::jsonb)
  );
end;
$$;

/**
 * Concluir um pedido de 'corrigir' ou 'exportar' (a exclusão roda sozinha no
 * prazo de 30 dias, pela função lgpd-delete). Fica no registro de ações.
 */
create or replace function public.admin_lgpd_concluir(p_pedido uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r lgpd_requests;
begin
  perform public.admin_exigir(array['suporte']);
  select * into r from lgpd_requests where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if r.tipo = 'apagar' then
    raise exception 'A exclusão da conta é feita automaticamente no prazo; o tutor pode cancelar até lá.';
  end if;
  if r.status in ('concluido', 'cancelado') then raise exception 'Pedido já encerrado.'; end if;
  update lgpd_requests set status = 'concluido', done_at = now() where id = p_pedido;
  perform public.admin_registrar('concluiu o pedido LGPD (' || r.tipo || ')', 'usuario', r.user_id::text,
    jsonb_build_object('pedido', p_pedido, 'nota', left(coalesce(p_nota, ''), 300)));
end;
$$;

-- ============================================================
-- Moderação: indicações de lugares pet friendly
-- ============================================================
create or replace function public.admin_moderacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['moderacao', 'leitura']);
  return jsonb_build_object(
    'em_analise', (select count(*) from sugestoes_lugar where status = 'em_analise'),
    'atrasadas', (select count(*) from sugestoes_lugar where status = 'em_analise' and criado_em < now() - interval '1 day'),
    'aprovadas_30d', (select count(*) from sugestoes_lugar where status = 'aprovada' and revisado_em > now() - interval '30 days'),
    'recusadas_30d', (select count(*) from sugestoes_lugar where status = 'recusada' and revisado_em > now() - interval '30 days'),
    'horas_media', (
      select round(extract(epoch from avg(revisado_em - criado_em)) / 3600, 1)
      from sugestoes_lugar where revisado_em > now() - interval '30 days'
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.nome, 'categoria', s.categoria, 'aceita', s.aceita, 'endereco', s.endereco,
        'lat', s.lat, 'lng', s.lng, 'observacao', s.observacao, 'status', s.status,
        'motivo_recusa', s.motivo_recusa, 'criado_em', s.criado_em, 'revisado_em', s.revisado_em,
        'tutor', coalesce(p.nome, split_part(u.email, '@', 1)),
        'indicacoes_do_tutor', (select count(*) from sugestoes_lugar x where x.user_id = s.user_id),
        -- Lugar já no mapa a menos de 150 m com nome parecido: talvez seja repetido.
        'parecido', (
          select pl.nome from places pl
          where abs(pl.lat - s.lat) < 0.0015 and abs(pl.lng - s.lng) < 0.0015
            and (pl.nome ilike '%' || split_part(s.nome, ' ', 1) || '%' or s.nome ilike '%' || split_part(pl.nome, ' ', 1) || '%')
          limit 1
        )
      ) order by (s.status = 'em_analise') desc, s.criado_em)
      from (select * from sugestoes_lugar order by criado_em desc limit 200) s
      left join auth.users u on u.id = s.user_id
      left join profiles p on p.id = s.user_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_moderar_indicacao(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  perform public.admin_exigir(array['moderacao']);
  select nome into v_nome from sugestoes_lugar where id = p_id;
  if p_aprovar then
    perform public.aprovar_sugestao_lugar(p_id);
  else
    if char_length(trim(coalesce(p_motivo, ''))) < 3 then
      raise exception 'Diga o motivo: o tutor vê no app.';
    end if;
    perform public.recusar_sugestao_lugar(p_id, trim(p_motivo));
  end if;
  perform public.admin_registrar(
    case when p_aprovar then 'aprovou a indicação' else 'recusou a indicação' end,
    'indicacao', v_nome, jsonb_build_object('id', p_id, 'motivo', left(coalesce(p_motivo, ''), 200))
  );
end;
$$;

-- Registro de ações: chamado aparece com o nome de quem escreveu.
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
        when 'chamado' then (select 'chamado de ' || c.nome from site_contacts c where c.id::text = a.alvo_id)
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
-- Permissões
-- ============================================================
revoke all on function public.admin_suporte() from public, anon;
revoke all on function public.admin_suporte_notas(uuid) from public, anon;
revoke all on function public.admin_suporte_acao(uuid, text, text) from public, anon;
revoke all on function public.admin_lgpd() from public, anon;
revoke all on function public.admin_lgpd_concluir(uuid, text) from public, anon;
revoke all on function public.admin_moderacao() from public, anon;
revoke all on function public.admin_moderar_indicacao(uuid, boolean, text) from public, anon;
grant execute on function public.admin_suporte() to authenticated;
grant execute on function public.admin_suporte_notas(uuid) to authenticated;
grant execute on function public.admin_suporte_acao(uuid, text, text) to authenticated;
grant execute on function public.admin_lgpd() to authenticated;
grant execute on function public.admin_lgpd_concluir(uuid, text) to authenticated;
grant execute on function public.admin_moderacao() to authenticated;
grant execute on function public.admin_moderar_indicacao(uuid, boolean, text) to authenticated;

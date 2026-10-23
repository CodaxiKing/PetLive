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
    and not exists (
      select 1 from notification_log n
      where n.user_id = p.id and n.type = 'campanha' and n.sent_at > now() - interval '20 hours'
    )
    and case p_publico
      when 'todos' then true
      when 'caes' then exists (select 1 from pets where tutor_id = p.id and ativo and especie = 'cao')
      when 'gatos' then exists (select 1 from pets where tutor_id = p.id and ativo and especie = 'gato')
      when 'sem_pet' then not exists (select 1 from pets where tutor_id = p.id and ativo)
      when 'vacina_vencendo' then exists (
        select 1 from vaccinations v join pets pe on pe.id = v.pet_id
        where pe.tutor_id = p.id and pe.ativo and v.proxima_dose between current_date and current_date + 14
      )
      when 'inativos' then not exists (
        select 1 from eventos_uso e where e.user_id = p.id and e.evento = 'app_aberto' and e.ocorreu_em > now() - interval '30 days'
      )
      else false
    end
$$;
revoke all on function public.campanha_destinatarios(text) from public, anon, authenticated;


create or replace function public.admin_campanhas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing', 'leitura']);
  return jsonb_build_object(
    'enviadas_30d', (select count(*) from notification_log where type = 'campanha' and campanha_id is not null and sent_at > now() - interval '30 days'),
    'abertas_30d', (select count(*) from notification_log where type = 'campanha' and campanha_id is not null and sent_at > now() - interval '30 days' and read_at is not null),
    'agendadas', (select count(*) from campanhas where status = 'agendada'),
    'proxima', (select min(agendada_para) from campanhas where status = 'agendada'),
    'com_aceite', (select count(*) from public.campanha_destinatarios('todos')),
    'campanhas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'titulo', c.titulo, 'mensagem', c.mensagem, 'publico', c.publico, 'link', c.link,
        'status', c.status, 'agendada_para', c.agendada_para, 'enviada_em', c.enviada_em,
        'destinatarios', c.destinatarios, 'criada_em', c.criada_em, 'por', coalesce(p.nome, u.email),
        'abertas', (select count(*) from notification_log n where n.campanha_id = c.id and n.read_at is not null)
      ) order by (c.status = 'agendada') desc, coalesce(c.enviada_em, c.agendada_para, c.criada_em) desc)
      from (select * from campanhas order by criada_em desc limit 100) c
      left join auth.users u on u.id = c.criada_por
      left join profiles p on p.id = c.criada_por
    ), '[]'::jsonb)
  );
end;
$$;

/** Quantos tutores receberiam agora (prévia no formulário). */
create or replace function public.admin_campanha_publico(p_publico text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing', 'leitura']);
  return (select count(*) from public.campanha_destinatarios(p_publico));
end;
$$;

/** Cria ou edita (rascunho ou agendada). p_agendar_para null = rascunho. */
create or replace function public.admin_campanha_salvar(
  p_id uuid, p_titulo text, p_mensagem text, p_publico text, p_link text, p_agendar_para timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_status text := case when p_agendar_para is null then 'rascunho' else 'agendada' end;
begin
  perform public.admin_exigir(array['marketing']);
  if p_agendar_para is not null and p_agendar_para < now() - interval '5 minutes' then
    raise exception 'Escolha um horário no futuro.';
  end if;
  if v_id is null then
    insert into campanhas (titulo, mensagem, publico, link, status, agendada_para, criada_por)
    values (trim(p_titulo), trim(p_mensagem), p_publico, p_link, v_status, p_agendar_para, auth.uid())
    returning id into v_id;
  else
    update campanhas set titulo = trim(p_titulo), mensagem = trim(p_mensagem), publico = p_publico, link = p_link,
      status = v_status, agendada_para = p_agendar_para
    where id = v_id and status in ('rascunho', 'agendada');
    if not found then raise exception 'Campanha já enviada ou cancelada: crie outra.'; end if;
  end if;
  perform public.admin_registrar(
    case when v_status = 'agendada' then 'agendou a campanha' else 'salvou o rascunho da campanha' end,
    'campanha', trim(p_titulo), jsonb_build_object('id', v_id, 'publico', p_publico, 'para', p_agendar_para)
  );
  return v_id;
end;
$$;

create or replace function public.admin_campanha_cancelar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
begin
  perform public.admin_exigir(array['marketing']);
  update campanhas set status = 'cancelada' where id = p_id and status in ('rascunho', 'agendada')
  returning titulo into v_titulo;
  if v_titulo is null then raise exception 'Só dá para cancelar rascunho ou campanha agendada.'; end if;
  perform public.admin_registrar('cancelou a campanha', 'campanha', v_titulo, jsonb_build_object('id', p_id));
end;
$$;

create or replace function public.admin_campanha_testar(p_titulo text, p_mensagem text, p_link text)
returns int language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['marketing']);
  raise exception 'O envio de push ainda não está configurado neste ambiente.';
end;
$$;
revoke all on function public.admin_campanhas() from public, anon;
revoke all on function public.admin_campanha_publico(text) from public, anon;
revoke all on function public.admin_campanha_salvar(uuid, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.admin_campanha_cancelar(uuid) from public, anon;
revoke all on function public.admin_campanha_testar(text, text, text) from public, anon;
grant execute on function public.admin_campanhas() to authenticated;
grant execute on function public.admin_campanha_publico(text) to authenticated;
grant execute on function public.admin_campanha_salvar(uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_campanha_cancelar(uuid) to authenticated;
grant execute on function public.admin_campanha_testar(text, text, text) to authenticated;
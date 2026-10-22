-- PetLive: painel admin, área Campanhas (BUSINESS.md: "Push e e-mail por
-- público, com agendamento"; e-mail entra quando houver o provedor).
-- Regras: só vai para quem aceitou "Dicas e novidades" (LGPD), com os
-- avisos ligados, conta ativa e no máximo uma campanha por dia por tutor.

alter table public.notification_log drop constraint notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha'));

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 65),
  mensagem text not null check (char_length(mensagem) between 3 and 180),
  publico text not null check (publico in ('todos', 'caes', 'gatos', 'sem_pet', 'vacina_vencendo', 'inativos')),
  -- Tela do app aberta ao tocar.
  link text check (link in ('/inicio', '/mapa', '/lembretes', '/ferramentas/calculadoras', '/sos')),
  status text not null default 'rascunho' check (status in ('rascunho', 'agendada', 'enviada', 'cancelada')),
  agendada_para timestamptz,
  enviada_em timestamptz,
  destinatarios int,
  criada_por uuid references auth.users (id) on delete set null,
  criada_em timestamptz not null default now(),
  constraint campanhas_agendada_tem_data check (status <> 'agendada' or agendada_para is not null)
);
alter table public.campanhas enable row level security;
revoke all on public.campanhas from anon, authenticated;

alter table public.notification_log add column campanha_id uuid references public.campanhas (id) on delete set null;
create index notification_log_campanha on public.notification_log (campanha_id) where campanha_id is not null;

/** Quem recebe a campanha agora (consentimento, avisos ligados e limite diário). */
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

/** Push pelo Expo para os celulares do tutor, com a linha na caixa de avisos. */
create or replace function public.campanha_entregar(p_tutor uuid, p_campanha uuid, p_titulo text, p_mensagem text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aviso uuid;
  v_token text;
begin
  insert into notification_log (user_id, type, title, body, deep_link, campanha_id)
  values (p_tutor, 'campanha', p_titulo, p_mensagem, p_link, p_campanha)
  returning id into v_aviso;
  for v_token in select token from push_tokens where tutor_id = p_tutor and ativo loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', v_token, 'title', p_titulo, 'body', p_mensagem, 'sound', 'default',
        'data', jsonb_build_object('tipo', 'campanha', 'url', coalesce(p_link, '/inicio'), 'aviso_id', v_aviso)
      ),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  end loop;
end;
$$;
revoke all on function public.campanha_entregar(uuid, uuid, text, text, text) from public, anon, authenticated;

/** Envia as campanhas agendadas que já passaram da hora (pg_cron). */
create or replace function public.processar_campanhas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c campanhas;
  v_total int;
begin
  for c in
    select * from campanhas where status = 'agendada' and agendada_para <= now()
    order by agendada_para for update skip locked
  loop
    -- Marca antes de enviar: se outra execução pegar, não manda em dobro.
    update campanhas set status = 'enviada', enviada_em = now() where id = c.id;
    select count(*) into v_total from (
      select public.campanha_entregar(d.tutor_id, c.id, c.titulo, c.mensagem, c.link)
      from public.campanha_destinatarios(c.publico) d
    ) x;
    update campanhas set destinatarios = v_total where id = c.id;
  end loop;
end;
$$;
revoke all on function public.processar_campanhas() from public, anon, authenticated;

select cron.schedule('petlive-campanhas', '* * * * *', $$select public.processar_campanhas();$$);

-- ============================================================
-- Painel (marketing; leitura só vê)
-- ============================================================
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

/** "Testar no meu celular": só para quem está no painel, sem contar nas métricas. */
create or replace function public.admin_campanha_testar(p_titulo text, p_mensagem text, p_link text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_celulares int := (select count(*) from push_tokens where tutor_id = auth.uid() and ativo);
begin
  perform public.admin_exigir(array['marketing']);
  if v_celulares = 0 then
    raise exception 'Seu usuário não tem celular com avisos ligados. Entre no app com o mesmo e-mail e permita as notificações.';
  end if;
  perform public.campanha_entregar(auth.uid(), null, '[Teste] ' || trim(p_titulo), trim(p_mensagem), p_link);
  return v_celulares;
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

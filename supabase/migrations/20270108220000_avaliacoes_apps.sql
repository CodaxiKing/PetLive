-- Avaliações dos apps (BUSINESS.md 21, AdminAvaliacoes): Google Play e App
-- Store num só lugar. A função sync-app-reviews importa a cada hora e envia as
-- respostas escritas no painel. Sem as credenciais das lojas, nada é importado
-- e o painel mostra como conectar.

create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('play', 'app_store')),
  external_id text not null check (char_length(external_id) between 1 and 200),
  rating int not null check (rating between 1 and 5),
  author text check (char_length(author) <= 120),
  title text check (char_length(title) <= 300),
  text text check (char_length(text) <= 5000),
  app_version text check (char_length(app_version) <= 40),
  at timestamptz not null,
  reply_text text check (char_length(reply_text) <= 350),
  replied_at timestamptz,
  reply_status text check (reply_status in ('pendente', 'enviada', 'falhou')),
  reply_erro text,
  respondida_por uuid references auth.users (id) on delete set null,
  importada_em timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists app_reviews_recentes on public.app_reviews (at desc);
alter table public.app_reviews enable row level security;
revoke all on public.app_reviews from public, anon, authenticated;
grant all on public.app_reviews to service_role;

create table if not exists public.app_reviews_sync (
  platform text primary key check (platform in ('play', 'app_store')),
  ultima_execucao timestamptz,
  ok boolean,
  mensagem text
);
alter table public.app_reviews_sync enable row level security;
revoke all on public.app_reviews_sync from public, anon, authenticated;
grant all on public.app_reviews_sync to service_role;

-- Usado só pela função (service_role): grava o que veio das lojas sem apagar a resposta do painel.
create or replace function public.app_reviews_importar(p_platform text, p_itens jsonb, p_ok boolean, p_mensagem text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v int := 0; i jsonb;
begin
  for i in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    insert into app_reviews (platform, external_id, rating, author, title, text, app_version, at, reply_text, replied_at, reply_status)
    values (p_platform, i->>'external_id', (i->>'rating')::int, left(i->>'author', 120), left(i->>'title', 300), left(i->>'text', 5000),
            left(i->>'app_version', 40), (i->>'at')::timestamptz, left(i->>'reply_text', 350), (i->>'replied_at')::timestamptz,
            case when i->>'reply_text' is not null then 'enviada' end)
    on conflict (platform, external_id) do update set
      rating = excluded.rating, author = excluded.author, title = excluded.title, text = excluded.text,
      app_version = excluded.app_version, at = excluded.at,
      reply_text = case when app_reviews.reply_status in ('pendente', 'falhou') then app_reviews.reply_text else coalesce(excluded.reply_text, app_reviews.reply_text) end,
      replied_at = case when app_reviews.reply_status in ('pendente', 'falhou') then app_reviews.replied_at else coalesce(excluded.replied_at, app_reviews.replied_at) end,
      reply_status = case when app_reviews.reply_status in ('pendente', 'falhou') then app_reviews.reply_status
                          when excluded.reply_text is not null then 'enviada' else app_reviews.reply_status end;
    v := v + 1;
  end loop;
  insert into app_reviews_sync (platform, ultima_execucao, ok, mensagem) values (p_platform, now(), p_ok, left(p_mensagem, 300))
  on conflict (platform) do update set ultima_execucao = now(), ok = excluded.ok, mensagem = excluded.mensagem;
  return v;
end;
$$;

create or replace function public.app_reviews_respostas_pendentes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'platform', platform, 'external_id', external_id, 'reply_text', reply_text)), '[]'::jsonb)
  from (select * from app_reviews where reply_status = 'pendente' order by replied_at limit 50) r;
$$;

create or replace function public.app_reviews_resposta_resultado(p_id uuid, p_ok boolean, p_erro text default null)
returns void language sql security definer set search_path = public as $$
  update app_reviews set reply_status = case when p_ok then 'enviada' else 'falhou' end, reply_erro = case when p_ok then null else left(p_erro, 300) end
  where id = p_id;
$$;

revoke all on function public.app_reviews_importar(text, jsonb, boolean, text), public.app_reviews_respostas_pendentes(),
  public.app_reviews_resposta_resultado(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.app_reviews_importar(text, jsonb, boolean, text), public.app_reviews_respostas_pendentes(),
  public.app_reviews_resposta_resultado(uuid, boolean, text) to service_role;

-- Painel: resumo e lista com filtro.
create or replace function public.admin_avaliacoes(p_filtro text default 'todas')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['suporte', 'marketing', 'leitura']);
  return jsonb_build_object(
    'lojas', coalesce((select jsonb_object_agg(platform, jsonb_build_object('media', media, 'total', total)) from (
      select platform, round(avg(rating)::numeric, 1) as media, count(*) as total from app_reviews group by platform) x), '{}'::jsonb),
    'sem_resposta', (select count(*) from app_reviews where reply_text is null),
    'uma_estrela_sem_resposta', (select count(*) from app_reviews where reply_text is null and rating = 1),
    'horas_resposta', (select round((avg(extract(epoch from (replied_at - at)) / 3600))::numeric, 1)
                       from app_reviews where replied_at is not null and replied_at > now() - interval '90 days'),
    'distribuicao', (select coalesce(jsonb_object_agg(n, coalesce(c, 0)), '{}'::jsonb) from generate_series(1, 5) n
                     left join (select rating, count(*) c from app_reviews group by rating) d on d.rating = n),
    'por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', m.mes, 'media', r.media) order by m.mes) from (
        select generate_series(date_trunc('month', now()) - interval '8 months', date_trunc('month', now()), interval '1 month')::date as mes) m
      left join (select date_trunc('month', at)::date as mes, round(avg(rating)::numeric, 1) as media from app_reviews group by 1) r using (mes)), '[]'::jsonb),
    'sync', coalesce((select jsonb_object_agg(platform, jsonb_build_object('ultima_execucao', ultima_execucao, 'ok', ok, 'mensagem', mensagem)) from app_reviews_sync), '{}'::jsonb),
    'itens', coalesce((select jsonb_agg(to_jsonb(r) - 'respondida_por' order by r.at desc) from (
      select * from app_reviews
      where case p_filtro
        when 'play' then platform = 'play'
        when 'app_store' then platform = 'app_store'
        when 'baixas' then rating <= 2
        when 'sem_resposta' then reply_text is null
        else true end
      order by at desc limit 200) r), '[]'::jsonb)
  );
end;
$$;

-- Resposta escrita no painel: fica pendente até a função enviar para a loja.
create or replace function public.admin_avaliacao_responder(p_id uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['suporte', 'marketing']);
  if char_length(btrim(coalesce(p_texto, ''))) < 2 then raise exception 'Escreva a resposta.'; end if;
  if char_length(btrim(p_texto)) > 350 then raise exception 'As lojas aceitam até 350 caracteres.'; end if;
  update app_reviews set reply_text = btrim(p_texto), replied_at = now(), reply_status = 'pendente', reply_erro = null, respondida_por = auth.uid()
  where id = p_id;
  if not found then raise exception 'Avaliação não encontrada.'; end if;
  perform public.admin_registrar('respondeu avaliação do app', 'app_reviews', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_avaliacoes(text), public.admin_avaliacao_responder(uuid, text) from public, anon;
grant execute on function public.admin_avaliacoes(text), public.admin_avaliacao_responder(uuid, text) to authenticated;

-- A cada hora: importa e envia as respostas (URL e chave no Vault, como o lgpd-delete).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and to_regclass('vault.decrypted_secrets') is not null then
    perform cron.unschedule('petlive-sync-app-reviews') where exists (select 1 from cron.job where jobname = 'petlive-sync-app-reviews');
    perform cron.schedule('petlive-sync-app-reviews', '23 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-app-reviews',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
        body := '{}'::jsonb)
      where exists (select 1 from vault.decrypted_secrets where name = 'project_url');
    $job$);
  end if;
end $$;

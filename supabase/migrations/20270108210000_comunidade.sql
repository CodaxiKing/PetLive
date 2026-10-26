-- Comunidade e perfil público do pet (BUSINESS.md 5.28, Fase 4). Tudo é
-- privado por padrão: só o titular liga o perfil público de um pet. Posts com
-- foto, curtir, comentar, seguir e feed, só para quem tem conta. Denúncia
-- esconde o post ou o comentário a partir de 3 pessoas, até a equipe decidir.

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda', 'perdido', 'comunidade'));

create table if not exists public.pet_public_profiles (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  ativo boolean not null default false,
  bio text check (char_length(bio) <= 160),
  mostrar_cidade boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.pet_public_profiles enable row level security;
revoke all on public.pet_public_profiles from public, anon, authenticated;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  foto_path text not null,
  legenda text check (char_length(legenda) <= 500),
  status text not null default 'publicado' check (status in ('publicado', 'oculto', 'removido')),
  criado_em timestamptz not null default now()
);
create index if not exists posts_pet on public.posts (pet_id, criado_em desc);
create index if not exists posts_recentes on public.posts (criado_em desc) where status = 'publicado';
alter table public.posts enable row level security;
revoke all on public.posts from public, anon, authenticated;

create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
revoke all on public.likes from public, anon, authenticated;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 300),
  status text not null default 'publicado' check (status in ('publicado', 'oculto', 'removido')),
  criado_em timestamptz not null default now()
);
create index if not exists comments_post on public.comments (post_id, criado_em);
alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;

create table if not exists public.follows (
  seguidor_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (seguidor_id, pet_id)
);
create index if not exists follows_pet on public.follows (pet_id);
alter table public.follows enable row level security;
revoke all on public.follows from public, anon, authenticated;

create table if not exists public.comunidade_denuncias (
  id uuid primary key default gen_random_uuid(),
  alvo_tipo text not null check (alvo_tipo in ('post', 'comentario')),
  alvo_id uuid not null,
  autor_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 2 and 200),
  status text not null default 'aberta' check (status in ('aberta', 'mantido', 'removido')),
  criado_em timestamptz not null default now(),
  unique (alvo_tipo, alvo_id, autor_id)
);
alter table public.comunidade_denuncias enable row level security;
revoke all on public.comunidade_denuncias from public, anon, authenticated;

-- Fotos dos posts: cada conta envia na própria pasta; quem tem conta lê só foto de post publicado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunidade', 'comunidade', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "comunidade: enviar própria foto" on storage.objects;
create policy "comunidade: enviar própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'comunidade' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "comunidade: ler foto publicada" on storage.objects;
create policy "comunidade: ler foto publicada" on storage.objects for select to authenticated
  using (bucket_id = 'comunidade' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.posts p where p.foto_path = name and p.status = 'publicado')
    or public.admin_papel() is not null));

-- Pet com perfil público ligado (e ativo, fora do memorial).
create or replace function public.comunidade_pet_publico(p_pet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pet_public_profiles pp join pets p on p.id = pp.pet_id
                 where pp.pet_id = p_pet and pp.ativo and p.ativo and not p.em_memoria);
$$;

-- Primeiro nome de quem publicou ou comentou (nunca e-mail ou telefone).
create or replace function public.comunidade_nome(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(btrim(nome), ' ', 1), ''), 'Tutor') from profiles where id = p_user;
$$;

create or replace function public.comunidade_post_json(p posts)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'pet_id', p.pet_id, 'pet', pe.nome, 'especie', pe.especie, 'pet_foto', pe.foto_url,
    'autor', public.comunidade_nome(p.autor_id), 'meu', p.autor_id = auth.uid(),
    'foto_path', p.foto_path, 'legenda', p.legenda, 'criado_em', p.criado_em,
    'curtidas', (select count(*) from likes l where l.post_id = p.id),
    'curti', exists (select 1 from likes l where l.post_id = p.id and l.user_id = auth.uid()),
    'comentarios', (select count(*) from comments c where c.post_id = p.id and c.status = 'publicado'))
  from pets pe where pe.id = p.pet_id;
$$;

-- Liga, desliga e edita o perfil público. Só o titular do pet.
create or replace function public.comunidade_perfil_configurar(p_pet uuid, p_ativo boolean, p_bio text default null, p_mostrar_cidade boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pets where id = p_pet and tutor_id = auth.uid()) then
    raise exception 'Só o tutor titular muda o perfil público do pet.' using errcode = '42501';
  end if;
  insert into pet_public_profiles (pet_id, ativo, bio, mostrar_cidade)
  values (p_pet, coalesce(p_ativo, false), nullif(left(btrim(coalesce(p_bio, '')), 160), ''), coalesce(p_mostrar_cidade, true))
  on conflict (pet_id) do update set ativo = excluded.ativo, bio = excluded.bio, mostrar_cidade = excluded.mostrar_cidade, atualizado_em = now();
end;
$$;

-- Perfil público: dados do pet, números e posts. Perfil desligado aparece só para quem cuida do pet.
create or replace function public.comunidade_perfil(p_pet uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p pets;
  pp pet_public_profiles;
  v_dono boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into p from pets where id = p_pet;
  select * into pp from pet_public_profiles where pet_id = p_pet;
  v_dono := p.id is not null and p.tutor_id = auth.uid();
  if p.id is null or (not v_dono and not public.comunidade_pet_publico(p_pet)) then
    return jsonb_build_object('disponivel', false);
  end if;
  return jsonb_build_object(
    'disponivel', true, 'dono', v_dono, 'ativo', coalesce(pp.ativo, false),
    'pet', jsonb_build_object('id', p.id, 'nome', p.nome, 'especie', p.especie, 'raca', p.raca, 'foto_url', p.foto_url, 'nascimento', p.nascimento),
    'bio', pp.bio, 'mostrar_cidade', coalesce(pp.mostrar_cidade, true),
    'cidade', case when coalesce(pp.mostrar_cidade, true) then (select nullif(btrim(cidade), '') from profiles where id = p.tutor_id) end,
    'seguidores', (select count(*) from follows where pet_id = p.id),
    'seguindo', exists (select 1 from follows where pet_id = p.id and seguidor_id = auth.uid()),
    'total_posts', (select count(*) from posts where pet_id = p.id and status = 'publicado'),
    'posts', coalesce((select jsonb_agg(public.comunidade_post_json(x) order by x.criado_em desc)
                       from (select * from posts where pet_id = p.id and status = 'publicado' order by criado_em desc limit 60) x), '[]'::jsonb)
  );
end;
$$;

-- Feed: posts de pets que você segue e dos seus; sem nenhum, os mais recentes da comunidade.
create or replace function public.comunidade_feed(p_antes timestamptz default null, p_limite int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_segue boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  v_segue := exists (select 1 from follows where seguidor_id = auth.uid());
  return jsonb_build_object(
    'seguindo', coalesce((
      select jsonb_agg(jsonb_build_object('id', pe.id, 'nome', pe.nome, 'especie', pe.especie, 'foto_url', pe.foto_url) order by f.criado_em desc)
      from (select * from follows where seguidor_id = auth.uid() order by criado_em desc limit 20) f
      join pets pe on pe.id = f.pet_id where public.comunidade_pet_publico(pe.id)), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(public.comunidade_post_json(x) order by x.criado_em desc)
      from (
        select po.* from posts po
        where po.status = 'publicado' and public.comunidade_pet_publico(po.pet_id)
          and (p_antes is null or po.criado_em < p_antes)
          and (not v_segue or po.autor_id = auth.uid()
               or exists (select 1 from follows f where f.seguidor_id = auth.uid() and f.pet_id = po.pet_id))
        order by po.criado_em desc
        limit least(greatest(coalesce(p_limite, 20), 1), 50)
      ) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.comunidade_publicar(p_pet uuid, p_foto_path text, p_legenda text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not public.is_pet_owner(p_pet) then raise exception 'Este pet não está disponível nesta conta.' using errcode = '42501'; end if;
  if not public.comunidade_pet_publico(p_pet) then
    raise exception 'Ligue o perfil público do pet para publicar.' using errcode = '22023', hint = 'perfil_desligado';
  end if;
  if p_foto_path is null or split_part(p_foto_path, '/', 1) <> auth.uid()::text then raise exception 'Foto inválida.' using errcode = '22023'; end if;
  if (select count(*) from posts where autor_id = auth.uid() and criado_em > now() - interval '1 day') >= 10 then
    raise exception 'Você já publicou bastante hoje. Tente amanhã.' using errcode = '23514';
  end if;
  insert into posts (pet_id, autor_id, foto_path, legenda) values (p_pet, auth.uid(), p_foto_path, nullif(left(btrim(coalesce(p_legenda, '')), 500), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.comunidade_apagar_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update posts set status = 'removido' where id = p_post and autor_id = auth.uid() and status <> 'removido';
  if not found then raise exception 'Só quem publicou apaga o post.' using errcode = '42501'; end if;
end;
$$;

create or replace function public.comunidade_curtir(p_post uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not exists (select 1 from posts where id = p_post and status = 'publicado') then raise exception 'Este post não está mais disponível.' using errcode = '22023'; end if;
  delete from likes where post_id = p_post and user_id = auth.uid();
  if found then return false; end if;
  insert into likes (post_id, user_id) values (p_post, auth.uid());
  return true;
end;
$$;

create or replace function public.comunidade_comentarios(p_post uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare po posts;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into po from posts where id = p_post and status = 'publicado';
  if po.id is null or not public.comunidade_pet_publico(po.pet_id) then return jsonb_build_object('disponivel', false); end if;
  return jsonb_build_object('disponivel', true, 'post', public.comunidade_post_json(po), 'comentarios', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'autor', public.comunidade_nome(c.autor_id), 'meu', c.autor_id = auth.uid(), 'texto', c.texto, 'criado_em', c.criado_em) order by c.criado_em)
    from comments c where c.post_id = p_post and c.status = 'publicado'), '[]'::jsonb));
end;
$$;

create or replace function public.comunidade_comentar(p_post uuid, p_texto text)
returns uuid language plpgsql security definer set search_path = public as $$
declare po posts; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into po from posts where id = p_post and status = 'publicado';
  if po.id is null then raise exception 'Este post não está mais disponível.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva o comentário.' using errcode = '22023'; end if;
  if (select count(*) from comments where autor_id = auth.uid() and criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitos comentários seguidos. Aguarde um pouco.' using errcode = '23514';
  end if;
  insert into comments (post_id, autor_id, texto) values (p_post, auth.uid(), left(btrim(p_texto), 300)) returning id into v_id;
  if po.autor_id <> auth.uid() then
    insert into notification_log (user_id, pet_id, type, title, body, deep_link)
    values (po.autor_id, po.pet_id, 'comunidade', 'Novo comentário',
            public.comunidade_nome(auth.uid()) || ' comentou no post de ' || (select nome from pets where id = po.pet_id) || '.', '/comunidade/post/' || po.id);
  end if;
  return v_id;
end;
$$;

create or replace function public.comunidade_apagar_comentario(p_comentario uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Quem comentou ou quem publicou o post pode apagar.
  update comments c set status = 'removido' where c.id = p_comentario and c.status <> 'removido'
    and (c.autor_id = auth.uid() or exists (select 1 from posts p where p.id = c.post_id and p.autor_id = auth.uid()));
  if not found then raise exception 'Você não pode apagar este comentário.' using errcode = '42501'; end if;
end;
$$;

create or replace function public.comunidade_seguir(p_pet uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tutor uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  delete from follows where seguidor_id = auth.uid() and pet_id = p_pet;
  if found then return false; end if;
  if not public.comunidade_pet_publico(p_pet) then raise exception 'Este perfil não está disponível.' using errcode = '22023'; end if;
  select tutor_id into v_tutor from pets where id = p_pet;
  if v_tutor = auth.uid() then raise exception 'Este pet já é seu.' using errcode = '22023'; end if;
  insert into follows (seguidor_id, pet_id) values (auth.uid(), p_pet);
  insert into notification_log (user_id, pet_id, type, title, body, deep_link)
  values (v_tutor, p_pet, 'comunidade', 'Novo seguidor',
          public.comunidade_nome(auth.uid()) || ' começou a seguir ' || (select nome from pets where id = p_pet) || '.', '/comunidade/pet/' || p_pet);
  return true;
end;
$$;

-- Denúncia: 3 pessoas diferentes escondem o conteúdo até a equipe decidir.
create or replace function public.comunidade_denunciar(p_tipo text, p_alvo uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if p_tipo not in ('post', 'comentario') then raise exception 'Denúncia inválida.' using errcode = '22023'; end if;
  if (p_tipo = 'post' and not exists (select 1 from posts where id = p_alvo))
     or (p_tipo = 'comentario' and not exists (select 1 from comments where id = p_alvo)) then
    raise exception 'Conteúdo não encontrado.' using errcode = '22023';
  end if;
  insert into comunidade_denuncias (alvo_tipo, alvo_id, autor_id, motivo)
  values (p_tipo, p_alvo, auth.uid(), left(btrim(coalesce(nullif(btrim(p_motivo), ''), 'Sem motivo')), 200))
  on conflict (alvo_tipo, alvo_id, autor_id) do nothing;
  if (select count(*) from comunidade_denuncias where alvo_tipo = p_tipo and alvo_id = p_alvo and status = 'aberta') >= 3 then
    if p_tipo = 'post' then update posts set status = 'oculto' where id = p_alvo and status = 'publicado';
    else update comments set status = 'oculto' where id = p_alvo and status = 'publicado'; end if;
  end if;
end;
$$;

-- Moderação no admin.
create or replace function public.admin_comunidade()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['moderacao', 'suporte', 'leitura']);
  return jsonb_build_object(
    'posts_7d', (select count(*) from posts where criado_em > now() - interval '7 days'),
    'perfis_publicos', (select count(*) from pet_public_profiles where ativo),
    'denuncias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alvo_tipo', d.alvo_tipo, 'alvo_id', d.alvo_id, 'denuncias', d.total, 'motivos', d.motivos, 'ultima', d.ultima,
        'texto', case when d.alvo_tipo = 'post' then (select legenda from posts where id = d.alvo_id) else (select texto from comments where id = d.alvo_id) end,
        'foto_path', case when d.alvo_tipo = 'post' then (select foto_path from posts where id = d.alvo_id) end,
        'status', case when d.alvo_tipo = 'post' then (select status from posts where id = d.alvo_id) else (select status from comments where id = d.alvo_id) end,
        'autor', public.comunidade_nome(case when d.alvo_tipo = 'post' then (select autor_id from posts where id = d.alvo_id) else (select autor_id from comments where id = d.alvo_id) end)
      ) order by d.total desc, d.ultima desc)
      from (
        select alvo_tipo, alvo_id, count(*) as total, jsonb_agg(distinct motivo) as motivos, max(criado_em) as ultima
        from comunidade_denuncias where status = 'aberta' group by alvo_tipo, alvo_id
      ) d), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_comunidade_decidir(p_tipo text, p_alvo uuid, p_remover boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['moderacao']);
  if p_tipo = 'post' then
    update posts set status = case when p_remover then 'removido' else 'publicado' end where id = p_alvo and status <> 'removido';
  elsif p_tipo = 'comentario' then
    update comments set status = case when p_remover then 'removido' else 'publicado' end where id = p_alvo and status <> 'removido';
  else
    raise exception 'Tipo inválido.';
  end if;
  update comunidade_denuncias set status = case when p_remover then 'removido' else 'mantido' end
  where alvo_tipo = p_tipo and alvo_id = p_alvo and status = 'aberta';
  perform public.admin_registrar(case when p_remover then 'removeu ' else 'manteve ' end || p_tipo || ' da comunidade', 'comunidade', p_alvo::text, '{}'::jsonb);
end;
$$;

revoke all on function public.comunidade_pet_publico(uuid), public.comunidade_nome(uuid), public.comunidade_post_json(posts) from public, anon, authenticated;
revoke all on function public.comunidade_perfil_configurar(uuid, boolean, text, boolean), public.comunidade_perfil(uuid),
  public.comunidade_feed(timestamptz, int), public.comunidade_publicar(uuid, text, text), public.comunidade_apagar_post(uuid),
  public.comunidade_curtir(uuid), public.comunidade_comentarios(uuid), public.comunidade_comentar(uuid, text),
  public.comunidade_apagar_comentario(uuid), public.comunidade_seguir(uuid), public.comunidade_denunciar(text, uuid, text),
  public.admin_comunidade(), public.admin_comunidade_decidir(text, uuid, boolean) from public, anon;
grant execute on function public.comunidade_perfil_configurar(uuid, boolean, text, boolean), public.comunidade_perfil(uuid),
  public.comunidade_feed(timestamptz, int), public.comunidade_publicar(uuid, text, text), public.comunidade_apagar_post(uuid),
  public.comunidade_curtir(uuid), public.comunidade_comentarios(uuid), public.comunidade_comentar(uuid, text),
  public.comunidade_apagar_comentario(uuid), public.comunidade_seguir(uuid), public.comunidade_denunciar(text, uuid, text),
  public.admin_comunidade(), public.admin_comunidade_decidir(text, uuid, boolean) to authenticated;

-- Só abre depois do gate de retenção da Fase 1: o admin liga em Sistema.
insert into public.recursos (chave, nome, descricao, ligado, ordem) values
  ('comunidade', 'Comunidade', 'Feed, posts e perfil público dos pets. Ligar depois do gate de retenção da Fase 1.', false, 50)
on conflict (chave) do nothing;

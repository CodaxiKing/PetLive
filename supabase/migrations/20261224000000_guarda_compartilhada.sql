-- Guarda compartilhada (BUSINESS.md 5.45): o titular divide os cuidados de um
-- ou mais pets com outras contas. O acesso começa no aceite do convite, cada
-- alteração guarda o autor e as outras pessoas são avisadas.

-- ============================================================
-- Papel guardian (antes "family", começava sem aceite)
-- ============================================================
alter table public.pet_members drop constraint if exists pet_members_role_check;
update public.pet_members set role = 'guardian' where role = 'family';
alter table public.pet_members alter column role set default 'guardian';
alter table public.pet_members add constraint pet_members_role_check check (role = 'guardian');
alter table public.pet_members add column if not exists aceito_em timestamptz not null default now();

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda'));

-- Limite de pessoas por pet, além do titular (BUSINESS.md 5.45).
create or replace function public.guarda_limite_por_pet() returns int language sql immutable as $$ select 4 $$;

-- ============================================================
-- Convites
-- ============================================================
create table if not exists public.pet_invites (
  id uuid primary key default gen_random_uuid(),
  titular_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  pet_ids uuid[] not null check (cardinality(pet_ids) between 1 and 20),
  -- O link do convite leva o token; o banco guarda só o hash.
  token_hash text not null unique,
  status text not null default 'enviado' check (status in ('enviado', 'aceito', 'recusado', 'cancelado')),
  convidado_id uuid references public.profiles (id) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  respondido_em timestamptz
);
create index if not exists pet_invites_titular on public.pet_invites (titular_id, criado_em desc);
create index if not exists pet_invites_email_pendente on public.pet_invites (email) where status = 'enviado';
alter table public.pet_invites enable row level security;
revoke all on public.pet_invites from public, anon, authenticated;

-- Convite pendente e dentro do prazo.
create or replace function public.guarda_convite_aberto(c public.pet_invites) returns boolean
language sql stable as $$ select c.status = 'enviado' and c.expira_em > now() $$;

create or replace function public.guarda_meu_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(coalesce((select email from public.profiles where id = auth.uid()),
                        (select email from auth.users where id = auth.uid())))
$$;

create or replace function public.guarda_nome(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim((select nome from public.profiles where id = p_user)), ''), 'Alguém')
$$;

-- "Rex", "Rex e Mia", "Rex, Mia e Thor".
create or replace function public.guarda_nomes_pets(p_pet_ids uuid[]) returns text
language sql stable security definer set search_path = public as $$
  with n as (select p.nome, row_number() over (order by p.nome) i, count(*) over () t
             from public.pets p where p.id = any(p_pet_ids))
  select coalesce(string_agg(nome, case when i = t then '' when i = t - 1 then ' e ' else ', ' end order by i), 'o pet')
  from (select nome, i, t from n) x
$$;

create or replace function public.guarda_pets_json(p_pet_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'especie', p.especie, 'foto_url', p.foto_url) order by p.nome), '[]'::jsonb)
  from public.pets p where p.id = any(p_pet_ids)
$$;

-- Quantas pessoas o pet já tem (aceitas e convites em aberto), sem o titular.
create or replace function public.guarda_ocupacao(p_pet uuid, p_ignorar_convite uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.pet_members m where m.pet_id = p_pet)::int
       + (select count(*) from public.pet_invites c
          where p_pet = any(c.pet_ids) and public.guarda_convite_aberto(c)
            and c.id is distinct from p_ignorar_convite)::int
$$;

create or replace function public.guarda_convidar(p_pet_ids uuid[], p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_pets uuid[];
  v_pet record;
  v_convidado uuid;
  v_token text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para convidar.' using errcode = '42501'; end if;
  if (select plano from public.profiles where id = auth.uid()) is distinct from 'premium' then
    raise exception 'A guarda compartilhada faz parte do Premium.' using errcode = '42501';
  end if;
  if position('@' in v_email) < 2 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Digite um e-mail válido.' using errcode = '22023';
  end if;
  if v_email = public.guarda_meu_email() then
    raise exception 'Esse e-mail é o da sua conta.' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_pets from unnest(coalesce(p_pet_ids, '{}')) x;
  if v_pets is null or cardinality(v_pets) = 0 then
    raise exception 'Escolha pelo menos um pet.' using errcode = '22023';
  end if;
  if (select count(*) from public.pets p where p.id = any(v_pets) and p.tutor_id = auth.uid()) <> cardinality(v_pets) then
    raise exception 'Só o titular pode dividir a guarda destes pets.' using errcode = '42501';
  end if;

  select u.id into v_convidado from auth.users u
  left join public.profiles pr on pr.id = u.id
  where lower(coalesce(pr.email, u.email)) = v_email limit 1;

  if exists (select 1 from public.pet_invites c
             where c.titular_id = auth.uid() and c.email = v_email and public.guarda_convite_aberto(c)
               and c.pet_ids && v_pets) then
    raise exception 'Já existe um convite em aberto para esse e-mail.' using errcode = '23505';
  end if;
  if v_convidado is not null and (select count(*) from public.pet_members m
      where m.user_id = v_convidado and m.pet_id = any(v_pets)) = cardinality(v_pets) then
    raise exception 'Essa pessoa já divide a guarda desses pets.' using errcode = '23505';
  end if;

  for v_pet in select p.id, p.nome from public.pets p where p.id = any(v_pets) loop
    if public.guarda_ocupacao(v_pet.id) >= public.guarda_limite_por_pet() then
      raise exception '% já tem % pessoas na guarda.', v_pet.nome, public.guarda_limite_por_pet() using errcode = '23514';
    end if;
  end loop;

  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.pet_invites (titular_id, email, pet_ids, token_hash, convidado_id)
  values (auth.uid(), v_email, v_pets, encode(digest(v_token, 'sha256'), 'hex'), v_convidado)
  returning id into v_id;

  if v_convidado is not null then
    insert into public.notification_log (user_id, type, title, body, deep_link)
    values (v_convidado, 'guarda', 'Convite de guarda compartilhada',
            public.guarda_nome(auth.uid()) || ' quer dividir os cuidados de ' || public.guarda_nomes_pets(v_pets) || ' com você.',
            '/guarda/convite/' || v_id);
  end if;

  return jsonb_build_object('id', v_id, 'token', v_token, 'tem_conta', v_convidado is not null,
                            'expira_em', (select expira_em from public.pet_invites where id = v_id));
end;
$$;

-- Convite para quem abre: pelo id (convidado logado) ou pelo token do link.
create or replace function public.guarda_achar_convite(p_id uuid, p_token text)
returns public.pet_invites
language sql stable security definer set search_path = public, extensions as $$
  select c.* from public.pet_invites c
  where (p_token is not null and c.token_hash = encode(digest(p_token, 'sha256'), 'hex'))
     or (p_token is null and c.id = p_id
         and (c.convidado_id = auth.uid() or c.email = public.guarda_meu_email()))
  limit 1
$$;

create or replace function public.guarda_convite(p_id uuid default null, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.pet_invites;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para ver o convite.' using errcode = '42501'; end if;
  c := public.guarda_achar_convite(p_id, p_token);
  if c.id is null then return jsonb_build_object('encontrado', false); end if;
  return jsonb_build_object(
    'encontrado', true,
    'id', c.id,
    'situacao', case when c.status = 'enviado' and c.expira_em <= now() then 'expirado' else c.status end,
    'titular', public.guarda_nome(c.titular_id),
    'proprio', c.titular_id = auth.uid(),
    'pets', public.guarda_pets_json(c.pet_ids),
    'expira_em', c.expira_em
  );
end;
$$;

create or replace function public.guarda_responder(p_id uuid, p_aceitar boolean, p_pet_ids uuid[] default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.pet_invites;
  v_aceitos uuid[];
  v_pet record;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para responder.' using errcode = '42501'; end if;
  c := public.guarda_achar_convite(p_id, p_token);
  if c.id is null then raise exception 'Convite não encontrado.' using errcode = 'P0002'; end if;
  if c.titular_id = auth.uid() then raise exception 'Este convite é seu.' using errcode = '22023'; end if;
  if not public.guarda_convite_aberto(c) then
    raise exception 'Este convite não está mais aberto.' using errcode = '22023';
  end if;

  if not p_aceitar then
    update public.pet_invites set status = 'recusado', convidado_id = auth.uid(), respondido_em = now() where id = c.id;
    insert into public.notification_log (user_id, type, title, body, deep_link)
    values (c.titular_id, 'guarda', 'Convite recusado',
            public.guarda_nome(auth.uid()) || ' recusou dividir os cuidados de ' || public.guarda_nomes_pets(c.pet_ids) || '.', '/guarda');
    return jsonb_build_object('situacao', 'recusado', 'pets', '[]'::jsonb);
  end if;

  if (select plano from public.profiles where id = c.titular_id) is distinct from 'premium' then
    raise exception 'O Premium de quem convidou não está ativo agora.' using errcode = '42501';
  end if;

  select array_agg(x) into v_aceitos from unnest(c.pet_ids) x
  where p_pet_ids is null or x = any(p_pet_ids);
  -- Só pets que ainda são do titular.
  select array_agg(p.id) into v_aceitos from public.pets p where p.id = any(v_aceitos) and p.tutor_id = c.titular_id;
  if v_aceitos is null then raise exception 'Escolha pelo menos um pet.' using errcode = '22023'; end if;

  for v_pet in select p.id, p.nome from public.pets p where p.id = any(v_aceitos) loop
    if public.guarda_ocupacao(v_pet.id, c.id) >= public.guarda_limite_por_pet()
       and not exists (select 1 from public.pet_members m where m.pet_id = v_pet.id and m.user_id = auth.uid()) then
      raise exception '% já tem % pessoas na guarda.', v_pet.nome, public.guarda_limite_por_pet() using errcode = '23514';
    end if;
  end loop;

  insert into public.pet_members (pet_id, user_id, role, criado_por, aceito_em)
  select x, auth.uid(), 'guardian', c.titular_id, now() from unnest(v_aceitos) x
  on conflict (pet_id, user_id) do nothing;

  update public.pet_invites set status = 'aceito', convidado_id = auth.uid(), respondido_em = now() where id = c.id;
  insert into public.notification_log (user_id, type, title, body, deep_link)
  values (c.titular_id, 'guarda', 'Convite aceito',
          public.guarda_nome(auth.uid()) || ' agora divide os cuidados de ' || public.guarda_nomes_pets(v_aceitos) || ' com você.', '/guarda');
  return jsonb_build_object('situacao', 'aceito', 'pets', public.guarda_pets_json(v_aceitos));
end;
$$;

create or replace function public.guarda_cancelar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pet_invites set status = 'cancelado', respondido_em = now()
  where id = p_id and titular_id = auth.uid() and status = 'enviado';
  if not found then raise exception 'Convite não encontrado ou já respondido.' using errcode = 'P0002'; end if;
end;
$$;

-- Tudo da guarda para a tela: quem divide os meus pets, convites e os pets
-- que outras pessoas dividem comigo.
create or replace function public.guarda_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'premium', (select plano from public.profiles where id = auth.uid()) = 'premium',
    'limite', public.guarda_limite_por_pet(),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nome', public.guarda_nome(x.user_id),
                                          'desde', x.desde, 'pets', public.guarda_pets_json(x.pets)) order by x.desde)
      from (select m.user_id, min(m.aceito_em) desde, array_agg(m.pet_id) pets
            from public.pet_members m join public.pets p on p.id = m.pet_id
            where p.tutor_id = auth.uid() group by m.user_id) x), '[]'::jsonb),
    'convites', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'email', c.email, 'pets', public.guarda_pets_json(c.pet_ids),
                                          'expira_em', c.expira_em) order by c.criado_em desc)
      from public.pet_invites c where c.titular_id = auth.uid() and public.guarda_convite_aberto(c)), '[]'::jsonb),
    'comigo', coalesce((
      select jsonb_agg(jsonb_build_object('titular_id', x.tutor_id, 'titular', public.guarda_nome(x.tutor_id),
                                          'suspensa', x.plano is distinct from 'premium', 'pets', public.guarda_pets_json(x.pets)))
      from (select p.tutor_id, pr.plano, array_agg(p.id) pets
            from public.pet_members m join public.pets p on p.id = m.pet_id
            join public.profiles pr on pr.id = p.tutor_id
            where m.user_id = auth.uid() group by p.tutor_id, pr.plano) x), '[]'::jsonb),
    'recebidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'titular', public.guarda_nome(c.titular_id),
                                          'pets', public.guarda_pets_json(c.pet_ids), 'expira_em', c.expira_em))
      from public.pet_invites c
      where (c.convidado_id = auth.uid() or c.email = public.guarda_meu_email()) and public.guarda_convite_aberto(c)), '[]'::jsonb)
  );
end;
$$;

-- Titular tira a pessoa de alguns pets ou de todos.
create or replace function public.guarda_remover(p_user_id uuid, p_pet_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pet_members m using public.pets p
  where p.id = m.pet_id and p.tutor_id = auth.uid() and m.user_id = p_user_id
    and (p_pet_ids is null or m.pet_id = any(p_pet_ids));
end;
$$;

-- Quem foi convidado sai de alguns pets ou de todos; o titular é avisado.
create or replace function public.guarda_sair(p_pet_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  for v in
    with saiu as (
      delete from public.pet_members m
      where m.user_id = auth.uid() and (p_pet_ids is null or m.pet_id = any(p_pet_ids))
      returning m.pet_id
    )
    select p.tutor_id, array_agg(p.id) pets from saiu join public.pets p on p.id = saiu.pet_id group by p.tutor_id
  loop
    insert into public.notification_log (user_id, type, title, body, deep_link)
    values (v.tutor_id, 'guarda', 'Saída da guarda compartilhada',
            public.guarda_nome(auth.uid()) || ' saiu da guarda de ' || public.guarda_nomes_pets(v.pets) || '.', '/guarda');
  end loop;
end;
$$;

-- Quem cuida do pet: o titular e quem divide a guarda (só os nomes).
create or replace function public.guarda_cuidadores(p_pet_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pet_owner(p_pet_id) then raise exception 'Sem acesso a este pet.' using errcode = '42501'; end if;
  return (
    select jsonb_build_object('titular', jsonb_build_object('user_id', p.tutor_id, 'nome', public.guarda_nome(p.tutor_id), 'voce', p.tutor_id = auth.uid()),
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nome', public.guarda_nome(m.user_id),
                                                              'voce', m.user_id = auth.uid(), 'desde', m.aceito_em) order by m.aceito_em)
                          from public.pet_members m where m.pet_id = p.id), '[]'::jsonb))
    from public.pets p where p.id = p_pet_id
  );
end;
$$;

revoke all on function public.guarda_convidar(uuid[], text) from public, anon;
revoke all on function public.guarda_convite(uuid, text) from public, anon;
revoke all on function public.guarda_responder(uuid, boolean, uuid[], text) from public, anon;
revoke all on function public.guarda_cancelar(uuid) from public, anon;
revoke all on function public.guarda_painel() from public, anon;
revoke all on function public.guarda_remover(uuid, uuid[]) from public, anon;
revoke all on function public.guarda_sair(uuid[]) from public, anon;
revoke all on function public.guarda_cuidadores(uuid) from public, anon;
revoke all on function public.guarda_achar_convite(uuid, text) from public, anon, authenticated;
grant execute on function public.guarda_convidar(uuid[], text) to authenticated;
grant execute on function public.guarda_convite(uuid, text) to authenticated;
grant execute on function public.guarda_responder(uuid, boolean, uuid[], text) to authenticated;
grant execute on function public.guarda_cancelar(uuid) to authenticated;
grant execute on function public.guarda_painel() to authenticated;
grant execute on function public.guarda_remover(uuid, uuid[]) to authenticated;
grant execute on function public.guarda_sair(uuid[]) to authenticated;
grant execute on function public.guarda_cuidadores(uuid) to authenticated;

-- ============================================================
-- Linha do tempo e passeios também para quem divide a guarda
-- ============================================================
drop policy if exists "marcos: tutor lê os seus" on public.marcos;
drop policy if exists "marcos: quem cuida do pet lê" on public.marcos;
create policy "marcos: quem cuida do pet lê" on public.marcos
  for select to authenticated using (tutor_id = auth.uid() or public.is_pet_owner(pet_id));
drop policy if exists "marcos: tutor cria nos seus pets" on public.marcos;
drop policy if exists "marcos: quem cuida do pet cria" on public.marcos;
create policy "marcos: quem cuida do pet cria" on public.marcos
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and public.is_pet_owner(pet_id)
    and (foto_path is null or foto_path like auth.uid()::text || '/%')
  );
drop policy if exists "storage: fotos da linha do tempo para quem cuida" on storage.objects;
create policy "storage: fotos da linha do tempo para quem cuida" on storage.objects
  for select to authenticated
  using (bucket_id = 'anexos' and exists (
    select 1 from public.marcos m where m.foto_path = name and public.is_pet_owner(m.pet_id)));

drop policy if exists passeios_tutor_ler on public.passeios_tutor;
create policy passeios_tutor_ler on public.passeios_tutor for select to authenticated
  using (tutor_id = auth.uid() or (pet_id is not null and public.is_pet_owner(pet_id)));

-- ============================================================
-- Autor de cada registro e atualizações do pet
-- ============================================================
alter table public.vaccinations add column if not exists criado_por uuid default auth.uid() references public.profiles (id) on delete set null;
alter table public.dewormings add column if not exists criado_por uuid default auth.uid() references public.profiles (id) on delete set null;
alter table public.weights add column if not exists criado_por uuid default auth.uid() references public.profiles (id) on delete set null;
alter table public.visits add column if not exists criado_por uuid default auth.uid() references public.profiles (id) on delete set null;
alter table public.medications add column if not exists criado_por uuid default auth.uid() references public.profiles (id) on delete set null;
-- confirmada_por (texto) já guarda o nome do cuidador temporário; esta é a conta.
alter table public.medication_doses add column if not exists confirmada_por_id uuid references public.profiles (id) on delete set null;

create table if not exists public.pet_activity (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  tipo text not null check (tipo in ('vacina', 'vermifugo', 'peso', 'consulta', 'remedio', 'dose')),
  ref_id uuid,
  resumo text not null,
  criado_em timestamptz not null default now()
);
create index if not exists pet_activity_pet on public.pet_activity (pet_id, criado_em desc);
alter table public.pet_activity enable row level security;
revoke all on public.pet_activity from public, anon, authenticated;
grant select on public.pet_activity to authenticated;
drop policy if exists "pet_activity: quem cuida do pet lê" on public.pet_activity;
create policy "pet_activity: quem cuida do pet lê" on public.pet_activity
  for select to authenticated using (public.is_pet_owner(pet_id));

-- As outras pessoas recebem as atualizações na hora (Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pet_activity') then
    alter publication supabase_realtime add table public.pet_activity;
  end if;
end $$;

-- Registra a atividade e avisa quem divide a guarda. Só registra o que veio
-- de uma pessoa (jobs do servidor não têm auth.uid()).
create or replace function public.guarda_registrar_atividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet uuid;
  v_tipo text;
  v_resumo text;
  v_nome_pet text;
  v_autor text;
  v_dest uuid;
begin
  if auth.uid() is null then return new; end if;
  case tg_table_name
    when 'vaccinations' then v_pet := new.pet_id; v_tipo := 'vacina'; v_resumo := 'registrou a vacina ' || new.nome;
    when 'dewormings' then v_pet := new.pet_id; v_tipo := 'vermifugo'; v_resumo := 'registrou o vermífugo' || coalesce(' ' || new.produto, '');
    when 'weights' then v_pet := new.pet_id; v_tipo := 'peso'; v_resumo := 'registrou o peso: ' || trim(to_char(new.peso, 'FM990D0')) || ' kg';
    when 'visits' then v_pet := new.pet_id; v_tipo := 'consulta'; v_resumo := 'registrou a consulta: ' || new.motivo;
    when 'medications' then v_pet := new.pet_id; v_tipo := 'remedio'; v_resumo := 'começou o remédio ' || new.nome;
    when 'medication_doses' then
      if new.confirmada_em is null or (tg_op = 'UPDATE' and old.confirmada_em is not null) then return new; end if;
      select m.pet_id, 'marcou Feito no ' || m.nome into v_pet, v_resumo from public.medications m where m.id = new.medication_id;
      v_tipo := 'dose';
    else return new;
  end case;
  if v_pet is null then return new; end if;

  insert into public.pet_activity (pet_id, autor_id, tipo, ref_id, resumo)
  values (v_pet, auth.uid(), v_tipo, new.id, v_resumo);

  -- Aviso só quando o pet é dividido com alguém.
  select p.nome into v_nome_pet from public.pets p where p.id = v_pet;
  v_autor := public.guarda_nome(auth.uid());
  for v_dest in
    select p.tutor_id from public.pets p
    join public.profiles pr on pr.id = p.tutor_id
    where p.id = v_pet and pr.plano = 'premium' and exists (select 1 from public.pet_members m where m.pet_id = v_pet)
    union
    select m.user_id from public.pet_members m
    join public.pets p on p.id = m.pet_id join public.profiles pr on pr.id = p.tutor_id
    where m.pet_id = v_pet and pr.plano = 'premium'
  loop
    if v_dest <> auth.uid() then
      insert into public.notification_log (user_id, pet_id, type, title, body, deep_link)
      values (v_dest, v_pet, 'guarda', v_nome_pet || ': nova atualização', v_autor || ' ' || v_resumo || '.',
              '/pet/' || v_pet || '/atualizacoes');
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists guarda_atividade on public.vaccinations;
create trigger guarda_atividade after insert on public.vaccinations for each row execute function public.guarda_registrar_atividade();
drop trigger if exists guarda_atividade on public.dewormings;
create trigger guarda_atividade after insert on public.dewormings for each row execute function public.guarda_registrar_atividade();
drop trigger if exists guarda_atividade on public.weights;
create trigger guarda_atividade after insert on public.weights for each row execute function public.guarda_registrar_atividade();
drop trigger if exists guarda_atividade on public.visits;
create trigger guarda_atividade after insert on public.visits for each row execute function public.guarda_registrar_atividade();
drop trigger if exists guarda_atividade on public.medications;
create trigger guarda_atividade after insert on public.medications for each row execute function public.guarda_registrar_atividade();
drop trigger if exists guarda_atividade on public.medication_doses;
create trigger guarda_atividade after insert or update of confirmada_em on public.medication_doses
  for each row execute function public.guarda_registrar_atividade();

-- ============================================================
-- Dose marcada uma vez só, para todos
-- ============================================================
create or replace function public.guarda_dose_uma_vez()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fuso text;
begin
  if old.confirmada_em is not null and new.confirmada_em is not null and new.confirmada_em <> old.confirmada_em then
    select coalesce((select ns.fuso from public.notification_settings ns where ns.tutor_id = auth.uid()), 'America/Sao_Paulo') into v_fuso;
    raise exception '% já marcou às %.',
      case when old.origem = 'cuidador' and old.confirmada_por is not null then old.confirmada_por
           when old.confirmada_por_id is not null and old.confirmada_por_id = auth.uid() then 'Você'
           when old.confirmada_por_id is not null then public.guarda_nome(old.confirmada_por_id)
           when auth.uid() is null then 'O tutor'
           else 'Você' end,
      to_char(old.confirmada_em at time zone v_fuso, 'HH24:MI')
      using errcode = 'P0001', hint = 'dose_ja_marcada';
  end if;
  if old.confirmada_em is null and new.confirmada_em is not null then
    new.confirmada_por_id := coalesce(new.confirmada_por_id, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.guarda_dose_autor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmada_em is not null then new.confirmada_por_id := coalesce(new.confirmada_por_id, auth.uid()); end if;
  return new;
end;
$$;

drop trigger if exists guarda_dose_uma_vez on public.medication_doses;
create trigger guarda_dose_uma_vez before update of confirmada_em on public.medication_doses
  for each row execute function public.guarda_dose_uma_vez();
drop trigger if exists guarda_dose_autor on public.medication_doses;
create trigger guarda_dose_autor before insert on public.medication_doses
  for each row execute function public.guarda_dose_autor_insert();

-- ============================================================
-- Guarda suspensa quando o Premium do titular acaba
-- ============================================================
create or replace function public.guarda_aviso_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_saiu boolean := old.plano = 'premium' and new.plano is distinct from 'premium';
  v_voltou boolean := old.plano is distinct from 'premium' and new.plano = 'premium';
begin
  if not (v_saiu or v_voltou) then return new; end if;
  for v in
    select m.user_id, array_agg(p.id) pets from public.pet_members m
    join public.pets p on p.id = m.pet_id where p.tutor_id = new.id group by m.user_id
  loop
    insert into public.notification_log (user_id, type, title, body, deep_link)
    values (v.user_id, 'guarda',
            case when v_saiu then 'Guarda compartilhada pausada' else 'Guarda compartilhada de volta' end,
            case when v_saiu then 'O Premium de ' || public.guarda_nome(new.id) || ' acabou. Você volta a ver ' || public.guarda_nomes_pets(v.pets) || ' quando o plano for reativado.'
                 else 'Você voltou a cuidar de ' || public.guarda_nomes_pets(v.pets) || ' com ' || public.guarda_nome(new.id) || '.' end,
            '/guarda');
  end loop;
  if v_saiu and exists (select 1 from public.pet_members m join public.pets p on p.id = m.pet_id where p.tutor_id = new.id) then
    insert into public.notification_log (user_id, type, title, body, deep_link)
    values (new.id, 'guarda', 'Guarda compartilhada pausada',
            'Sem o Premium, quem divide a guarda dos seus pets fica sem acesso até você reativar o plano.', '/premium');
  end if;
  return new;
end;
$$;

drop trigger if exists guarda_aviso_plano on public.profiles;
create trigger guarda_aviso_plano after update of plano on public.profiles
  for each row execute function public.guarda_aviso_plano();

notify pgrst, 'reload schema';

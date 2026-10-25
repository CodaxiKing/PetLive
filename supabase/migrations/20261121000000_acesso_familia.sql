-- Compartilhamento de pets com contas PetLive da família (Premium).
create table public.pet_members (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'family' check (role = 'family'),
  criado_por uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pet_id, user_id),
  constraint pet_members_not_self check (user_id <> criado_por)
);

create index pet_members_user_id_idx on public.pet_members (user_id, pet_id);
alter table public.pet_members enable row level security;
revoke all on public.pet_members from anon, authenticated;
grant select on public.pet_members to authenticated;

-- A função já é usada pelas políticas das tabelas de saúde. Ela passa a
-- incluir membros ativos da família, sem alterar a propriedade do pet.
create or replace function public.is_pet_owner(pet_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pets p
    where p.id = pet_uuid and p.tutor_id = auth.uid()
  ) or exists (
    select 1
    from public.pet_members m
    join public.pets p on p.id = m.pet_id
    join public.profiles owner_profile on owner_profile.id = p.tutor_id
    where m.pet_id = pet_uuid
      and m.user_id = auth.uid()
      and owner_profile.plano = 'premium'
  );
$$;

drop policy if exists "pets: o tutor vê os seus" on public.pets;
create policy "pets: dono e família veem os pets autorizados"
  on public.pets for select to authenticated
  using (public.is_pet_owner(id));

drop policy if exists "pets: o tutor edita os seus" on public.pets;
create policy "pets: dono e família editam os pets autorizados"
  on public.pets for update to authenticated
  using (public.is_pet_owner(id))
  with check (public.is_pet_owner(id));

-- O membro não pode transferir o pet nem apagá-lo. Os demais dados de saúde
-- continuam editáveis pelas políticas existentes via is_pet_owner().
create or replace function public.impedir_transferencia_pet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tutor_id <> old.tutor_id then
    raise exception 'A propriedade do pet não pode ser alterada por aqui.';
  end if;
  return new;
end;
$$;

create trigger pets_impedir_transferencia
  before update of tutor_id on public.pets
  for each row execute function public.impedir_transferencia_pet();

create policy "pet_members: titular e familiar veem o próprio vínculo"
  on public.pet_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid())
  );

-- Inscrição imediata somente para uma conta já cadastrada. O titular precisa
-- estar no Premium; cada vínculo pode ser removido pelo titular a qualquer hora.
create or replace function public.pet_familia_listar(p_pet_id uuid)
returns table(user_id uuid, nome text, email text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.tutor_id = auth.uid()) then
    raise exception 'Só o tutor responsável pode gerenciar o acesso da família.' using errcode = '42501';
  end if;

  return query
    select m.user_id, coalesce(pr.nome, 'Familiar'), coalesce(pr.email, u.email), m.criado_em
    from public.pet_members m
    join public.profiles pr on pr.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.pet_id = p_pet_id
    order by m.criado_em;
end;
$$;

create or replace function public.pet_familia_adicionar(p_pet_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_nome text;
  v_email text;
  v_plano text;
begin
  select pr.plano into v_plano
  from public.profiles pr
  where pr.id = auth.uid();

  if v_plano is distinct from 'premium' then
    raise exception 'O compartilhamento com a família está disponível no Premium.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.tutor_id = auth.uid()) then
    raise exception 'Só o tutor responsável pode compartilhar este pet.' using errcode = '42501';
  end if;
  if p_email is null or position('@' in trim(p_email)) < 2 then
    raise exception 'Digite um e-mail válido.' using errcode = '22023';
  end if;

  select u.id, coalesce(pr.nome, 'Familiar'), coalesce(pr.email, u.email)
    into v_user_id, v_nome, v_email
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where lower(coalesce(pr.email, u.email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'Essa pessoa precisa criar uma conta PetLive com esse e-mail antes de receber acesso.' using errcode = 'P0002';
  end if;
  if v_user_id = auth.uid() then
    raise exception 'Esse e-mail já é o da sua conta.' using errcode = '22023';
  end if;

  insert into public.pet_members (pet_id, user_id, criado_por)
  values (p_pet_id, v_user_id, auth.uid())
  on conflict (pet_id, user_id) do nothing;

  return jsonb_build_object('user_id', v_user_id, 'nome', v_nome, 'email', v_email);
end;
$$;

create or replace function public.pet_familia_remover(p_pet_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.pets p where p.id = p_pet_id and p.tutor_id = auth.uid()) then
    raise exception 'Só o tutor responsável pode remover o acesso da família.' using errcode = '42501';
  end if;
  delete from public.pet_members where pet_id = p_pet_id and user_id = p_user_id;
end;
$$;

revoke all on function public.pet_familia_listar(uuid) from public, anon;
revoke all on function public.pet_familia_adicionar(uuid, text) from public, anon;
revoke all on function public.pet_familia_remover(uuid, uuid) from public, anon;
grant execute on function public.pet_familia_listar(uuid) to authenticated;
grant execute on function public.pet_familia_adicionar(uuid, text) to authenticated;
grant execute on function public.pet_familia_remover(uuid, uuid) to authenticated;

-- Lembretes vinculados a um pet acompanham o compartilhamento. Os lembretes
-- gerais, sem pet_id, continuam privados do tutor que os criou.
drop policy if exists "reminders: dono do lembrete" on public.reminders;
create policy "reminders: tutor ou família do pet"
  on public.reminders for all to authenticated
  using (
    (tutor_id = auth.uid() and (pet_id is null or public.is_pet_owner(pet_id)))
    or (pet_id is not null and public.is_pet_owner(pet_id))
  )
  with check (
    (tutor_id = auth.uid() and (pet_id is null or public.is_pet_owner(pet_id)))
    or (pet_id is not null and public.is_pet_owner(pet_id))
  );

-- Membros podem ler metadados e arquivos de saúde do pet; gravar ou excluir
-- documentos permanece exclusivo do tutor que pagou o upload.
drop policy if exists "documentos_saude: tutor le os seus" on public.documentos_saude;
create policy "documentos_saude: tutor e família leem documentos autorizados"
  on public.documentos_saude for select to authenticated
  using (public.is_pet_owner(pet_id));

drop policy if exists "storage: anexo lido pelo dono" on storage.objects;
create policy "storage: tutor e família leem anexos autorizados"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'anexos'
    and exists (
      select 1 from public.documentos_saude d
      where d.arquivo_path = name and public.is_pet_owner(d.pet_id)
    )
  );

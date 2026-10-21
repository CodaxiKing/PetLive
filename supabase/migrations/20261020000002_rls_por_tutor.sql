-- PetLive: regras de acesso por linha (RLS).
-- Tarefas: [BACKEND] Base: "Regras de acesso (RLS) por tutor"
--          [BACKEND] Base: "Storage para fotos de pets e anexos"
-- Regra central do BUSINESS.md §7: cada tutor só vê os dados dos seus pets.

-- ============================================================
-- Perfis
-- ============================================================
alter table public.profiles enable row level security;

create policy "profiles: ve o proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: edita o proprio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: exclui o proprio perfil"
  on public.profiles for delete
  using (auth.uid() = id);

-- ============================================================
-- Pets
-- ============================================================
-- O tutor é dono do pet; quem tem acesso compartilhado (família, fase 2)
-- entra por uma tabela própria sem alterar estas regras.
alter table public.pets enable row level security;

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
  );
$$;

create policy "pets: o tutor vê os seus"
  on public.pets for select
  using (tutor_id = auth.uid());

create policy "pets: o tutor cria os seus"
  on public.pets for insert
  with check (tutor_id = auth.uid());

create policy "pets: o tutor edita os seus"
  on public.pets for update
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "pets: o tutor exclui os seus"
  on public.pets for delete
  using (tutor_id = auth.uid());

-- ============================================================
-- Tabelas ligadas ao pet (vacinas, vermífugo, peso, consultas,
-- remédios, doses e lembretes com pet definido)
-- ============================================================
-- A verificação é sempre "sou dono do pet da linha".
-- security definer evita dependência de ordem de avaliação das policies.

create policy "vaccinations: dono do pet"
  on public.vaccinations for all
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));

create policy "dewormings: dono do pet"
  on public.dewormings for all
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));

create policy "weights: dono do pet"
  on public.weights for all
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));

create policy "visits: dono do pet"
  on public.visits for all
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));

create policy "medications: dono do pet"
  on public.medications for all
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));

-- doses dependem do remédio, que depende do pet.
create policy "medication_doses: dono do remédio"
  on public.medication_doses for all
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and public.is_pet_owner(m.pet_id)
    )
  )
  with check (
    exists (
      select 1 from public.medications m
      where m.id = medication_id and public.is_pet_owner(m.pet_id)
    )
  );

-- ============================================================
-- Lembretes e notificações (pertencem ao tutor)
-- ============================================================
create policy "reminders: dono do lembrete"
  on public.reminders for all
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "push_tokens: dono do token"
  on public.push_tokens for all
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "notification_prefs: dono das preferências"
  on public.notification_prefs for all
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

-- ============================================================
-- Calendário de vacinas: leitura pública, escrita só pelo servidor
-- ============================================================
alter table public.vaccine_schedule enable row level security;

create policy "vaccine_schedule: leitura publica"
  on public.vaccine_schedule for select
  using (true);

-- ============================================================
-- Storage: fotos de pets e anexos
-- ============================================================
-- Buckets separados para aplicar regras diferentes.
insert into storage.buckets (id, name, public)
values ('pets', 'pets', true), ('anexos', 'anexos', false)
on conflict (id) do nothing;

-- Fotos de pet: o tutor dono escreve; leitura pública (avatares, QR).
create policy "storage: foto de pet do dono"
  on storage.objects for insert
  with check (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: foto de pet editavel pelo dono"
  on storage.objects for update
  using (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: foto de pet excluivel pelo dono"
  on storage.objects for delete
  using (
    bucket_id = 'pets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: fotos de pet sao publicas"
  on storage.objects for select
  using (bucket_id = 'pets');

-- Anexos (exames, cartão de vacina): privados, só o tutor dono.
create policy "storage: anexo do dono"
  on storage.objects for insert
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: anexo lido pelo dono"
  on storage.objects for select
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: anexo atualizado pelo dono"
  on storage.objects for update
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: anexo excluido pelo dono"
  on storage.objects for delete
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

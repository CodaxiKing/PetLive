-- Documentos de saúde privados do pet: cartão de vacina e exames.
create table public.documentos_saude (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('cartao_vacina', 'exame')),
  titulo text not null check (char_length(titulo) between 2 and 80),
  realizado_em date not null default current_date,
  arquivo_path text not null,
  criado_em timestamptz not null default now(),
  constraint documentos_saude_path_tutor check (arquivo_path like tutor_id::text || '/%')
);

create index documentos_saude_pet_data_idx on public.documentos_saude (pet_id, realizado_em desc);
alter table public.documentos_saude enable row level security;
revoke all on public.documentos_saude from anon;
grant select, insert, update, delete on public.documentos_saude to authenticated;

create policy "documentos_saude: tutor le os seus" on public.documentos_saude
  for select to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  );
create policy "documentos_saude: tutor cria nos seus pets" on public.documentos_saude
  for insert to authenticated with check (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
    and arquivo_path like auth.uid()::text || '/%'
  );
create policy "documentos_saude: tutor edita os seus" on public.documentos_saude
  for update to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  ) with check (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
    and arquivo_path like auth.uid()::text || '/%'
  );
create policy "documentos_saude: tutor apaga os seus" on public.documentos_saude
  for delete to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  );

comment on table public.documentos_saude is 'Fotos privadas do cartão de vacina e exames do pet.';

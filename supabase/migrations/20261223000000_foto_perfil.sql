-- Foto do tutor: bucket privado, um arquivo por vez na pasta do próprio tutor.
-- profiles.avatar_url guarda o caminho no bucket (ex.: <uid>/<uuid>.jpg); o app
-- mostra a foto com URL assinada, então ela não fica pública.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('perfis', 'perfis', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "perfis: ler própria foto" on storage.objects;
create policy "perfis: ler própria foto" on storage.objects for select to authenticated
  using (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "perfis: enviar própria foto" on storage.objects;
create policy "perfis: enviar própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "perfis: remover própria foto" on storage.objects;
create policy "perfis: remover própria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text);

-- O caminho precisa estar na pasta do próprio tutor (ou vazio, sem foto).
-- A coluna não era usada; valores fora do formato novo são descartados.
update public.profiles set avatar_url = null
  where avatar_url is not null and avatar_url !~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$');
alter table public.profiles drop constraint if exists profiles_avatar_url_caminho;
alter table public.profiles add constraint profiles_avatar_url_caminho
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));

-- Repara instalações em que a migration de foto do tutor não foi aplicada.
-- Preserva caminhos de avatar existentes; não executa a limpeza da migration antiga.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('perfis','perfis',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "perfis: ler própria foto" on storage.objects;
create policy "perfis: ler própria foto" on storage.objects for select to authenticated
using(bucket_id='perfis' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "perfis: enviar própria foto" on storage.objects;
create policy "perfis: enviar própria foto" on storage.objects for insert to authenticated
with check(bucket_id='perfis' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "perfis: remover própria foto" on storage.objects;
create policy "perfis: remover própria foto" on storage.objects for delete to authenticated
using(bucket_id='perfis' and (storage.foldername(name))[1]=auth.uid()::text);
commit;

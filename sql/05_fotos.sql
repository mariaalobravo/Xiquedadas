-- 05_fotos.sql — fotos de perfil en un bucket privado

alter table perfiles add column avatar_path text;

-- Cada una solo puede cambiar SU foto, no su nombre (el nombre es el que usa el login)
revoke update on perfiles from authenticated;
grant update (avatar_path) on perfiles to authenticated;
create policy "mi foto" on perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Bucket privado
insert into storage.buckets (id, name, public) values ('avatares', 'avatares', false);

create policy "ver avatares" on storage.objects for select to authenticated
  using (bucket_id = 'avatares');

create policy "subir mi avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "borrar mi avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- Si subes tú las fotos desde el dashboard (Storage → avatares → carpeta <id>/foto.jpg):
-- update perfiles set avatar_path = '<id>/foto.jpg' where nombre = 'Irene';

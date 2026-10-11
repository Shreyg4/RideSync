insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-images',
  'trip-images',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "upload trip image" 
on storage.objects for insert in authenticated
with check (
  bucket_id = 'trip-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "delete trip image" 
on storage.objects for delete to authenticated
  using ( bucket_id = 'trip-images' 
  and (storage.foldername(name))[1] = (select auth.uid())::text );
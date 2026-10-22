-- Feature 4 add-on: a photo of each HDB block so volunteers recognise it.
-- Run once in the Supabase SQL editor after 0003_live_eta.sql.
-- Photos are of the building outside only: no people, no unit numbers or doors (PDPA).

alter table public.blocks add column if not exists photo_path text;

-- Public bucket: building photos are not personal data, and volunteers' phones load them
-- straight from the URL. Only organisers can add, replace or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('block-photos', 'block-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "organisers read block photos" on storage.objects for select to authenticated
  using (bucket_id = 'block-photos' and public.is_organiser());
create policy "organisers add block photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'block-photos' and public.is_organiser());
create policy "organisers replace block photos" on storage.objects for update to authenticated
  using (bucket_id = 'block-photos' and public.is_organiser());
create policy "organisers remove block photos" on storage.objects for delete to authenticated
  using (bucket_id = 'block-photos' and public.is_organiser());

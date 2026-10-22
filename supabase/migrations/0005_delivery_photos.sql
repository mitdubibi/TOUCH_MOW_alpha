-- Feature 4 add-on: an organiser can ask for a photo of one delivery (e.g. the meal left at the door).
-- Volunteers only take photos when asked. Run once in the Supabase SQL editor after 0004_block_photos.sql.
-- Photos may show a doorway, so the bucket is private: organisers and the volunteer on that delivery only.

alter table public.deliveries
  add column if not exists photo_requested_at timestamptz,
  add column if not exists photo_request_note text check (char_length(photo_request_note) <= 200),
  add column if not exists photo_path text,
  add column if not exists photo_taken_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-photos', 'delivery-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored as <session_id>/<delivery_id>/<time>.jpg.
-- True for organisers, and for a volunteer who can see this delivery.
create function public.can_access_delivery_photo(p_delivery_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deliveries d
    where d.id::text = p_delivery_id
      and (
        public.is_organiser()
        or (public.is_on_session(d.session_id) and (d.assigned_to is null or d.assigned_to = auth.uid()))
      )
  )
$$;

create policy "read delivery photos" on storage.objects for select to authenticated
  using (bucket_id = 'delivery-photos' and public.can_access_delivery_photo((storage.foldername(name))[2]));

-- Volunteers can only upload while a photo is requested for that delivery.
create policy "upload requested delivery photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-photos'
    and public.can_access_delivery_photo((storage.foldername(name))[2])
    and exists (
      select 1 from public.deliveries d
      where d.id::text = (storage.foldername(name))[2]
        and d.session_id::text = (storage.foldername(name))[1]
        and d.photo_requested_at is not null
    )
  );

create policy "organisers remove delivery photos" on storage.objects for delete to authenticated
  using (bucket_id = 'delivery-photos' and public.is_organiser());

-- Volunteer links the uploaded file to the delivery (volunteers cannot update deliveries directly).
create function public.attach_delivery_photo(p_delivery_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.deliveries;
begin
  select * into d from public.deliveries where id = p_delivery_id for update;
  if not found or not public.can_access_delivery_photo(p_delivery_id::text) then
    raise exception 'You are not on this delivery' using errcode = '42501';
  end if;
  if d.photo_requested_at is null then
    raise exception 'No photo was requested for this unit' using errcode = '22023';
  end if;
  if p_path not like d.session_id::text || '/' || d.id::text || '/%' then
    raise exception 'Wrong photo path' using errcode = '22023';
  end if;

  update public.deliveries
  set photo_path = p_path, photo_taken_at = now(), updated_at = now()
  where id = p_delivery_id;
end $$;

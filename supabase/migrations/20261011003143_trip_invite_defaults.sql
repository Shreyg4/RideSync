alter table public.trips
  alter column invite_link
  set default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');

revoke insert on table public.trips from authenticated;
grant insert (name, starts_at, trip_type, image_url) on table public.trips to authenticated;
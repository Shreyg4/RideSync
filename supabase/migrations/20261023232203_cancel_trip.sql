create extension if not exists pg_cron;

-- Saves a copy for every member, then deletes the trip. No role check, so it is server-only
create or replace function public.archive_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_trips (user_id, name, trip_type, image_url, stops)
  select m.user_id, t.name, t.trip_type, t.image_url, '[]'::jsonb
  from public.trips t
  join public.trip_members m on m.trip_id = t.id
  where t.id = target_trip_id;

  delete from public.trips where id = target_trip_id;
end;
$$;

revoke execute on function public.archive_trip(bigint) from public, anon, authenticated;

-- Archives trips still in planning a day after their start time
create or replace function public.archive_stale_trips()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
begin
  for stale in
    select id from public.trips
    where trip_status = 'planning' and starts_at < now() - interval '24 hours'
    for update skip locked
  loop
    perform public.archive_trip(stale.id);
  end loop;
end;
$$;

revoke execute on function public.archive_stale_trips() from public, anon, authenticated;

select cron.schedule('archive-stale-trips', '0 * * * *', 'select public.archive_stale_trips()');

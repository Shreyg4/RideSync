-- Removes the 5-trip and 5-saved-trip limits added in 20261125000000_trip_limits

drop trigger if exists trips_enforce_limit on public.trips;
drop function if exists public.enforce_trip_limit();

-- Back to saving a copy for every member, however many saved trips they have
create or replace function public.archive_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_trips (user_id, name, trip_type, image_url, starts_at, stops)
  select m.user_id, t.name, t.trip_type, t.image_url, t.starts_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
        'mapbox_id', s.mapbox_id, 'stop_type', s.stop_type,
        'category', s.category, 'notes', s.notes, 'is_turnaround', s.is_turnaround,
        'departs_at', s.departs_at
      ) order by s.position)
      from public.trip_stops s
      where s.trip_id = t.id
    ), '[]'::jsonb)
  from public.trips t
  join public.trip_members m on m.trip_id = t.id
  where t.id = target_trip_id;

  delete from public.trips where id = target_trip_id;
end;
$$;

-- Back to cancelling without checking the owner's saved-trip count
create or replace function public.cancel_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.trip_role(target_trip_id) is distinct from 'owner' then
    raise exception 'only owner can cancel a trip' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.trips where id = target_trip_id and trip_status <> 'completed'
  ) then
    raise exception 'trip is already completed' using errcode = '22023';
  end if;

  -- Saves a copy for every member, then deletes the trip
  perform public.archive_trip(target_trip_id);
end;
$$;

-- A saved trip keeps its itinerary as it was last planned, and re-creating it brings the stops back.
-- The original start is kept so overnight departures can move with the new start date
alter table public.saved_trips
  add column starts_at timestamptz null;

-- Same as before, with the trip's start and each overnight stop's departure saved too
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

-- Never called by the app. recreate_saved_trip replaces it
drop function public.start_saved_trip(bigint, timestamptz);

-- Puts a saved trip's stops into a new, empty trip of the caller's. The trip type may have changed
-- on the way, so the stops follow the same rule as changing it on a trip: a one-way end becomes a
-- round trip's destination, and a one-way trip has no destination. Departures move by
-- departure_day_shift days, which the phone works out in its own time zone.
-- Security definer because clients can only add stops one at a time through add_trip_stop
create function public.copy_saved_trip_stops(
  target_trip_id bigint,
  source_saved_trip_id bigint,
  departure_day_shift int default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_trip_type text;
begin
  if public.trip_role(target_trip_id) is distinct from 'owner' then
    raise exception 'only the owner can fill a trip from a saved trip' using errcode = '42501';
  end if;

  select trip_type into new_trip_type from public.trips where id = target_trip_id for update;

  if exists (select 1 from public.trip_stops where trip_id = target_trip_id) then
    raise exception 'trip already has stops' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.saved_trips
    where id = source_saved_trip_id and user_id = (select auth.uid())
  ) then
    raise exception 'saved trip not found' using errcode = 'P0002';
  end if;

  insert into public.trip_stops
    (trip_id, position, name, address, lat, lng, mapbox_id, stop_type, category, notes,
     is_turnaround, departs_at)
  select
    target_trip_id,
    e.ord - 1,
    e.stop->>'name',
    e.stop->>'address',
    (e.stop->>'lat')::double precision,
    (e.stop->>'lng')::double precision,
    e.stop->>'mapbox_id',
    case when new_trip_type = 'round-trip' and e.stop->>'stop_type' = 'end'
      then 'stop' else e.stop->>'stop_type' end,
    coalesce(e.stop->>'category', 'other'),
    e.stop->>'notes',
    new_trip_type = 'round-trip'
      and (coalesce((e.stop->>'is_turnaround')::boolean, false) or e.stop->>'stop_type' = 'end'),
    case when e.stop->>'stop_type' = 'overnight'
      then (e.stop->>'departs_at')::timestamptz + make_interval(days => departure_day_shift) end
  from public.saved_trips st
  cross join lateral jsonb_array_elements(st.stops) with ordinality as e(stop, ord)
  where st.id = source_saved_trip_id;
end;
$$;

revoke execute on function public.copy_saved_trip_stops(bigint, bigint, int) from public, anon;
grant execute on function public.copy_saved_trip_stops(bigint, bigint, int) to authenticated;

-- Creates the trip and its stops together, so a failed copy leaves no half-made trip behind.
-- Security invoker so the trip is inserted under the same rules as any other new trip
create function public.recreate_saved_trip(
  source_saved_trip_id bigint,
  trip_name text,
  new_trip_type text,
  new_starts_at timestamptz,
  new_image_url text default null,
  departure_day_shift int default 0
)
returns public.trips
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_trip public.trips;
begin
  insert into public.trips (name, trip_type, starts_at, image_url)
  values (trip_name, new_trip_type, new_starts_at, new_image_url)
  returning * into new_trip;

  perform public.copy_saved_trip_stops(new_trip.id, source_saved_trip_id, departure_day_shift);

  return new_trip;
end;
$$;

revoke execute on function public.recreate_saved_trip(bigint, text, text, timestamptz, text, int) from public, anon;
grant execute on function public.recreate_saved_trip(bigint, text, text, timestamptz, text, int) to authenticated;

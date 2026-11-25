-- Each user owns at most 5 trips and keeps at most 5 saved trips.
-- RS001 and RS002 are this app's own error codes, so the app can say which limit was hit

-- A sixth trip is refused, whether it's made from scratch or from a saved trip. Trips that become
-- someone's through a handover don't count against them here
create or replace function public.enforce_trip_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Two trips made at the same moment can't both slip under the limit
  perform pg_advisory_xact_lock(hashtext('trip_limit:' || new.owner_id::text));

  if (select count(*) from public.trips where owner_id = new.owner_id) >= 5 then
    raise exception 'you can own up to 5 trips' using errcode = 'RS001';
  end if;
  return new;
end;
$$;
create trigger trips_enforce_limit
  before insert on public.trips
  for each row execute function public.enforce_trip_limit();
-- Same as before, but a member who already has 5 saved trips doesn't get another copy
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
  where t.id = target_trip_id
    and (select count(*) from public.saved_trips st where st.user_id = m.user_id) < 5;

  delete from public.trips where id = target_trip_id;
end;
$$;
-- Cancelling saves the trip, so the owner needs room for it. Deleting instead needs no room, and
-- goes through a plain delete
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

  if (select count(*) from public.saved_trips where user_id = (select auth.uid())) >= 5 then
    raise exception 'you can keep up to 5 saved trips' using errcode = 'RS002';
  end if;

  -- Saves a copy for every member with room, then deletes the trip
  perform public.archive_trip(target_trip_id);
end;
$$;

-- A round trip's destination: where the group turns around.
alter table public.trip_stops
  add column is_turnaround boolean not null default false;

alter table public.trip_stops
  add constraint turnaround_only_normal_stop
    check (not is_turnaround or stop_type in ('stop', 'overnight'));

create unique index trip_stop_single_turnaround_idx
  on public.trip_stops (trip_id) where is_turnaround;

-- Round trips that already have stops turn around at their last one, the point before the drive home
update public.trip_stops as s
set is_turnaround = true
from (
  select distinct on (stop.trip_id) stop.id
  from public.trip_stops as stop
  join public.trips as trip on trip.id = stop.trip_id
  where trip.trip_type = 'round-trip' and stop.stop_type in ('stop', 'overnight')
  order by stop.trip_id, stop.position desc
) as last_stop
where s.id = last_stop.id;

-- The new argument changes the function's signature, so the old one has to go or both would exist
drop function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int);

create function public.add_trip_stop(
  target_trip_id bigint,
  stop_name text,
  stop_lat double precision,
  stop_lng double precision,
  stop_address text default null,
  stop_mapbox_id text default null,
  new_stop_type text default 'stop',
  stop_category text default 'other',
  stop_notes text default null,
  at_position int default null,
  stop_is_turnaround boolean default false
)
returns public.trip_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  stop_count int;
  has_start boolean;
  has_end boolean;
  turnaround_pos int;
  current_trip_type text;
  new_pos int;
  new_stop public.trip_stops;
begin
  if coalesce(public.trip_role(target_trip_id), '') not in ('owner', 'editor') then
    raise exception 'only owner and editors can add stops' using errcode = '42501';
  end if;

  -- One writer at a time per trip so positions stay synced
  select trip_type into current_trip_type from public.trips where id = target_trip_id for update;

  if new_stop_type = 'end' and current_trip_type = 'round-trip' then
    raise exception 'round trips end at the start' using errcode = '22023';
  end if;

  if stop_is_turnaround and current_trip_type is distinct from 'round-trip' then
    raise exception 'only round trips have a destination' using errcode = '22023';
  end if;

  select count(*),
    coalesce(bool_or(stop_type = 'start'), false),
    coalesce(bool_or(stop_type = 'end'), false),
    min(position) filter (where is_turnaround)
  into stop_count, has_start, has_end, turnaround_pos
  from public.trip_stops where trip_id = target_trip_id;

  -- Start and end go in first so search can look between them
  if new_stop_type in ('stop', 'overnight')
    and (not has_start or (current_trip_type = 'one-way' and not has_end)) then
      raise exception 'add the start and end before other stops' using errcode = '22023';
  end if;

  -- A round trip's destination takes the place of the end
  if new_stop_type in ('stop', 'overnight')
    and current_trip_type = 'round-trip' and turnaround_pos is null and not stop_is_turnaround then
      raise exception 'add the destination before other stops' using errcode = '22023';
  end if;

  -- Start is always first, end always last, other stops land between them. Without a position they
  -- go on the way out, ahead of the destination. A stop on the way home asks for its position
  new_pos := case
    when new_stop_type = 'start' then 0
    when new_stop_type = 'end' then stop_count
    else least(
      greatest(coalesce(at_position, turnaround_pos, stop_count), has_start::int),
      stop_count - has_end::int
    )
  end;

  -- Deferred unique constraint lets this overlap until commit
  update public.trip_stops
  set position = position + 1
  where trip_id = target_trip_id and position >= new_pos;

  insert into public.trip_stops
    (trip_id, position, name, address, lat, lng, mapbox_id, stop_type, category, notes, is_turnaround)
  values
    (target_trip_id, new_pos, trim(stop_name), stop_address, stop_lat, stop_lng,
     stop_mapbox_id, new_stop_type, stop_category, stop_notes, stop_is_turnaround)
  returning * into new_stop;

  return new_stop;
end;
$$;

revoke execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int, boolean) from public, anon;
grant execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int, boolean) to authenticated;

-- The one change allowed to an end stop is becoming a destination, when its trip becomes a round
-- trip. Clients can't set is_turnaround, so only the trigger below can do this
create or replace function public.lock_start_end_stop_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.stop_type = 'end' and new.stop_type = 'stop' and new.is_turnaround then
    return new;
  end if;

  if new.stop_type is distinct from old.stop_type
    and (old.stop_type in ('start', 'end') or new.stop_type in ('start', 'end')) then
      raise exception 'start and end can only be set when adding a stop' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger trips_drop_end_on_round_trip on public.trips;
drop function public.drop_end_on_round_trip();

-- Changing the trip type keeps the place the group is heading for
create function public.keep_destination_on_trip_type_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trip_type = 'round-trip' then
    update public.trip_stops
    set stop_type = 'stop', is_turnaround = true
    where trip_id = new.id and stop_type = 'end';
  else
    update public.trip_stops
    set is_turnaround = false
    where trip_id = new.id and is_turnaround;
  end if;
  return null;
end;
$$;

create trigger trips_keep_destination_on_type_change
  after update of trip_type on public.trips
  for each row
  when (old.trip_type is distinct from new.trip_type)
  execute function public.keep_destination_on_trip_type_change();

-- Same as before, with the marker added to each saved stop
create or replace function public.archive_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saved_trips (user_id, name, trip_type, image_url, stops)
  select m.user_id, t.name, t.trip_type, t.image_url,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
        'mapbox_id', s.mapbox_id, 'stop_type', s.stop_type,
        'category', s.category, 'notes', s.notes, 'is_turnaround', s.is_turnaround
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

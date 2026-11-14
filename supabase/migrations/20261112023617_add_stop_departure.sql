-- An overnight stop can be added with the time the group leaves it, in the same step, instead of
-- being added and then edited. The new argument changes the function's signature, so the old one has
-- to go or both would exist
drop function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int, boolean);

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
  stop_is_turnaround boolean default false,
  stop_departs_at timestamptz default null
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

  -- A departure on anything but an overnight stop breaks departs_at_only_overnight, so it's refused
  insert into public.trip_stops
    (trip_id, position, name, address, lat, lng, mapbox_id, stop_type, category, notes,
     is_turnaround, departs_at)
  values
    (target_trip_id, new_pos, trim(stop_name), stop_address, stop_lat, stop_lng,
     stop_mapbox_id, new_stop_type, stop_category, stop_notes, stop_is_turnaround, stop_departs_at)
  returning * into new_stop;

  return new_stop;
end;
$$;

revoke execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int, boolean, timestamptz) from public, anon;
grant execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int, boolean, timestamptz) to authenticated;

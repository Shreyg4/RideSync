create table public.trip_stops (
  id         bigint                    generated always as identity primary key,
  trip_id    bigint                    not null references public.trips(id) on delete cascade,
  position   int                       not null check (position >= 0),
  name       character varying(100)    not null check(name::text = trim(name) and length(name) > 0),
  address    text                      null,
  lat        double precision          not null check(lat between -90 and 90),
  lng        double precision          not null check(lng between -180 and 180),
  mapbox_id  text                      null,
  stop_type  text                      not null default 'stop' 
             check(stop_type in ('start', 'stop', 'overnight', 'end')),
  category   text                      not null default 'other' 
             check(category in ('gas', 'food','coffee', 'rest', 'lodging', 'attraction', 'other')),
  notes      text                      null check (length(notes) <= 500),
  departs_at timestamp with time zone  null,
  created_at timestamp with time zone  default now() not null,
  updated_at timestamp with time zone  default now() not null,

  CONSTRAINT unique_trip_stop_position
    UNIQUE (trip_id, position)
    DEFERRABLE INITIALLY DEFERRED,

  -- When the group leaves an overnight stop the next day, so later ETAs don't run through the night
  CONSTRAINT departs_at_only_overnight
    CHECK (departs_at is null or stop_type = 'overnight')
);

create trigger trip_stops_set_updated_at
  before update on public.trip_stops
  for each row
  execute function public.set_updated_at();

-- Makes sure every trip only has one start and one end. Round trip means that end is just the start
create unique index trip_stop_single_start_idx on public.trip_stops (trip_id) where stop_type = 'start';
create unique index trip_stop_single_end_idx on public.trip_stops (trip_id) where stop_type = 'end';

grant select, update (name, address, lat, lng, mapbox_id, stop_type, category, notes, departs_at)
ON public.trip_stops to authenticated;

alter table public.trip_stops enable row level security;

create policy "members can see stops in their trip" on public.trip_stops
  for select
  to authenticated
  using ( public.trip_role(trip_id) is not null );

create policy "Owners and editors can update stops" on public.trip_stops
  for update
  to authenticated
  using ( public.trip_role(trip_id) in ('owner', 'editor') )
  with check ( public.trip_role(trip_id) in ('owner', 'editor') );

create or replace function public.add_trip_stop(
  target_trip_id bigint,
  stop_name text,
  stop_lat double precision,
  stop_lng double precision,
  stop_address text default null,
  stop_mapbox_id text default null,
  new_stop_type text default 'stop',
  stop_category text default 'other',
  stop_notes text default null,
  at_position int default null
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

  select count(*),
    coalesce(bool_or(stop_type = 'start'), false),
    coalesce(bool_or(stop_type = 'end'), false)
  into stop_count, has_start, has_end
  from public.trip_stops where trip_id = target_trip_id;

  -- Start and end go in first so search can look between them. Round trips only need a start
  if new_stop_type in ('stop', 'overnight')
    and (not has_start or (current_trip_type = 'one-way' and not has_end)) then
      raise exception 'add the start and end before other stops' using errcode = '22023';
  end if;

   -- Start is always first, end always last, other stops land between them
   new_pos := case 
    when new_stop_type = 'start' then 0
    when new_stop_type = 'end' then stop_count
    else least(
      greatest(coalesce(at_position, stop_count), has_start::int),
      stop_count - has_end::int
    )
  end;

  -- Deferred unique constraint lets this overlap until commit
  update public.trip_stops
  set position = position + 1
  where trip_id = target_trip_id and position >= new_pos;

  insert into public.trip_stops
    (trip_id, position, name, address, lat, lng, mapbox_id, stop_type, category, notes)
  values
    (target_trip_id, new_pos, trim(stop_name), stop_address, stop_lat, stop_lng,
     stop_mapbox_id, new_stop_type, stop_category, stop_notes)
  returning * into new_stop;

  return new_stop;
end;
$$;

revoke execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int) from public, anon;
grant execute on function public.add_trip_stop(bigint, text, double precision, double precision, text, text, text, text, text, int) to authenticated;

create or replace function public.remove_trip_stop(target_stop_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stop_trip_id bigint;
  removed_type text;
  removed_pos int;
begin
  select trip_id, stop_type
  into stop_trip_id, removed_type
  from public.trip_stops
  where id = target_stop_id;

  -- A missing stop has no trip, so trip_role is null and this raises too
  if coalesce(public.trip_role(stop_trip_id), '') not in ('owner', 'editor') then
    raise exception 'trip not found or access denied' using errcode = '42501';
  end if;

  -- Start and end are edited in place, never removed
  if removed_type in ('start', 'end') then
    raise exception 'start and end stops cannot be removed' using errcode = '22023';
  end if;

  perform 1 from public.trips where id = stop_trip_id for update;

  delete from public.trip_stops where id = target_stop_id
  returning position into removed_pos;

  if removed_pos is null then  -- deleted by someone else after our lookup
    raise exception 'stop not found' using errcode = 'P0002';
  end if;

  update public.trip_stops
  set position = position - 1
  where trip_id = stop_trip_id and position > removed_pos;

end;
$$;

revoke execute on function public.remove_trip_stop(bigint) from public, anon;
grant execute on function public.remove_trip_stop(bigint) to authenticated;

create or replace function public.reorder_trip_stops(target_trip_id bigint, ordered_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_id bigint;
  end_id bigint;
begin
  if coalesce(public.trip_role(target_trip_id), '') not in ('owner', 'editor') then
    raise exception 'only owner and editors can reorder stops' using errcode = '42501';
  end if;

  perform 1 from public.trips where id = target_trip_id for update;

  if array(select id from public.trip_stops where trip_id = target_trip_id order by id)
    is distinct from
    array(select x from unnest(ordered_ids) x order by x) then
      raise exception 'Stop IDs do not match trip stops, contain duplicates, or include invalid IDs' using errcode = '22023';
  end if;

  select max(id) filter (where stop_type = 'start'), max(id) filter (where stop_type = 'end')
  into start_id, end_id
  from public.trip_stops
  where trip_id = target_trip_id;

  if (start_id is not null and ordered_ids[1] != start_id)
    or (end_id is not null and ordered_ids[array_length(ordered_ids, 1)] != end_id) then
      raise exception 'Start or end stop constraint violated' using errcode = '22023';
  end if;

  update public.trip_stops as s
    set position = t.ord - 1
    from unnest(ordered_ids) with ordinality as t(id, ord)
    where s.id = t.id and s.trip_id = target_trip_id;
end;
$$;

revoke execute on function public.reorder_trip_stops(bigint, bigint[]) from public, anon;
grant execute on function public.reorder_trip_stops(bigint, bigint[]) to authenticated;

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
        'category', s.category, 'notes', s.notes
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

alter publication supabase_realtime add table public.trip_stops;

create or replace function public.lock_start_end_stop_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stop_type is distinct from old.stop_type
    and (old.stop_type in ('start', 'end') or new.stop_type in ('start', 'end')) then
      raise exception 'start and end can only be set when adding a stop' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger trip_stops_lock_start_end
  before update of stop_type on public.trip_stops
  for each row execute function public.lock_start_end_stop_type();

-- Round trips end at the start, so switching to one drops the old end stop.
-- Security definer because the owner editing the trip has no delete grant on trip_stops
create or replace function public.drop_end_on_round_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trip_stops where trip_id = new.id and stop_type = 'end';
  return null;
end;
$$;

create trigger trips_drop_end_on_round_trip
  after update of trip_type on public.trips
  for each row
  when (new.trip_type = 'round-trip' and old.trip_type is distinct from new.trip_type)
  execute function public.drop_end_on_round_trip();



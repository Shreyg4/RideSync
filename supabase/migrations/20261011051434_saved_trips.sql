-- Each user's own frozen copy of a trip plan, reusable as the starting point for a new trip
create table public.saved_trips (
  id        bigint      generated always as identity primary key,
  user_id   uuid        not null references public.users(id) on delete cascade,
  name      varchar(40) not null check (name::text = trim(name) and length(name) > 0),
  trip_type text        not null check (trip_type = any (array['one-way'::text, 'round-trip'::text])),
  image_url text,
  stops     jsonb       not null default '[]'::jsonb,
  saved_at  timestamptz not null default now()
);

create index saved_trips_user_id_idx on public.saved_trips (user_id);

alter table public.saved_trips enable row level security;

-- RLS Policies
create policy "users read their saved trips"
on public.saved_trips for select
to authenticated
using ( user_id = (select auth.uid()) );

create policy "users delete their saved trips"
on public.saved_trips for delete
to authenticated
using ( user_id = (select auth.uid()) );

grant select, delete on table public.saved_trips to authenticated;

-- Gives every member a saved copy of the trip, then deletes it
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

  insert into public.saved_trips (user_id, name, trip_type, image_url, stops)
  select m.user_id, t.name, t.trip_type, t.image_url, '[]'::jsonb
  from public.trips t
  join public.trip_members m on m.trip_id = t.id
  where t.id = target_trip_id and t.trip_status <> 'completed';

  if not found then
    raise exception 'trip is already completed' using errcode = '22023';
  end if;

  delete from public.trips where id = target_trip_id;
end;
$$;

revoke execute on function public.cancel_trip(bigint) from public, anon;
grant execute on function public.cancel_trip(bigint) to authenticated;

create or replace function public.start_saved_trip(saved_trip_id bigint, new_starts_at timestamptz)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_trip_id bigint;
begin
  insert into public.trips (name, starts_at, trip_type, image_url)
  select s.name, new_starts_at, s.trip_type, s.image_url
  from public.saved_trips s
  where s.id = saved_trip_id
  returning id into new_trip_id;

  if new_trip_id is null then
    raise exception 'saved trip not found' using errcode = 'P0002';
  end if;

  return new_trip_id;
end;
$$;

revoke execute on function public.start_saved_trip(bigint, timestamptz) from public, anon;
grant execute on function public.start_saved_trip(bigint, timestamptz) to authenticated;



-- A trip's driving route, saved so every phone doesn't ask Mapbox for it again. It lives in its own
-- table because the line is large (about 35 KB for a 500 km drive) and screens that list trips
-- select every trip column. route_key lists the points the route was made for, so a phone whose
-- stops don't match it fetches a new route and saves that one instead
create table public.trip_routes (
  trip_id    bigint                    primary key references public.trips(id) on delete cascade,
  route_key  text                      not null check (length(route_key) <= 20000),
  -- One { duration, distance } per drive between two points, in seconds and meters
  legs       jsonb                     not null check (jsonb_typeof(legs) = 'array'),
  -- The route line as polyline6, one per Directions request. Mapbox takes 25 points per request,
  -- so a longer trip is fetched in parts
  geometry   text[]                    not null
             check (cardinality(geometry) between 1 and 20
               and octet_length(array_to_string(geometry, '')) <= 4000000),
  updated_at timestamp with time zone  default now() not null
);

grant select on table public.trip_routes to authenticated;

alter table public.trip_routes enable row level security;

create policy "members can see their trip's route" on public.trip_routes
  for select
  to authenticated
  using ( public.trip_role(trip_id) is not null );

-- Any member can save it, viewers included: the route only follows the stops, which only owners and
-- editors can change, so saving it changes nothing a viewer couldn't already see
create or replace function public.save_trip_route(
  target_trip_id bigint,
  new_route_key text,
  new_legs jsonb,
  new_geometry text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.trip_role(target_trip_id) is null then
    raise exception 'only members can save the route' using errcode = '42501';
  end if;

  insert into public.trip_routes (trip_id, route_key, legs, geometry)
  values (target_trip_id, new_route_key, new_legs, new_geometry)
  on conflict (trip_id) do update
    set route_key = excluded.route_key,
        legs = excluded.legs,
        geometry = excluded.geometry,
        updated_at = now();
end;
$$;

revoke execute on function public.save_trip_route(bigint, text, jsonb, text[]) from public, anon;
grant execute on function public.save_trip_route(bigint, text, jsonb, text[]) to authenticated;

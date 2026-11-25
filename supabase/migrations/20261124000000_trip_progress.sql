-- A trip is started, paused, resumed and ended by hand. Ending it moves it to Saved Trips, so trips
-- are no longer archived on their own a day after their start time
select cron.unschedule(jobid) from cron.job where jobname = 'archive-stale-trips';

alter table public.trips drop constraint trip_status_valid;
alter table public.trips add constraint trip_status_valid
  check (trip_status = any (array['planning'::text, 'in-trip'::text, 'paused'::text, 'completed'::text]));

-- Status only changes through the functions below, which check the trip is ready and in the right state
revoke update (trip_status) on public.trips from authenticated;

-- Moves a trip from one status to another. The owner and editors run the trip
create or replace function public.change_trip_status(
  target_trip_id bigint,
  from_statuses text[],
  to_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if coalesce(public.trip_role(target_trip_id), '') not in ('owner', 'editor') then
    raise exception 'only the owner and editors can run the trip' using errcode = '42501';
  end if;

  select trip_status into current_status from public.trips where id = target_trip_id for update;

  if not (current_status = any (from_statuses)) then
    raise exception 'trip is %, not %', current_status, array_to_string(from_statuses, ' or ')
      using errcode = '22023';
  end if;

  update public.trips set trip_status = to_status where id = target_trip_id;
end;
$$;

revoke execute on function public.change_trip_status(bigint, text[], text) from public, anon, authenticated;

-- A trip can start once it has somewhere to start and somewhere to go: its end on a one-way trip,
-- its destination on a round trip
create or replace function public.start_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Checked here too, so a non-member learns nothing about the trip's stops
  if coalesce(public.trip_role(target_trip_id), '') not in ('owner', 'editor') then
    raise exception 'only the owner and editors can run the trip' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.trips t
    where t.id = target_trip_id
      and exists (select 1 from public.trip_stops s where s.trip_id = t.id and s.stop_type = 'start')
      and exists (
        select 1 from public.trip_stops s
        where s.trip_id = t.id
          and (case when t.trip_type = 'round-trip' then s.is_turnaround else s.stop_type = 'end' end)
      )
  ) then
    raise exception 'set the start and destination before starting the trip' using errcode = '22023';
  end if;

  perform public.change_trip_status(target_trip_id, array['planning'], 'in-trip');
end;
$$;

create or replace function public.pause_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.change_trip_status(target_trip_id, array['in-trip'], 'paused');
end;
$$;

create or replace function public.resume_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.change_trip_status(target_trip_id, array['paused'], 'in-trip');
end;
$$;

-- Ends a started trip for everyone, leaving each member a copy in Saved Trips
create or replace function public.end_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.change_trip_status(target_trip_id, array['in-trip', 'paused'], 'completed');
  perform public.archive_trip(target_trip_id);
end;
$$;

revoke execute on function public.start_trip(bigint) from public, anon;
revoke execute on function public.pause_trip(bigint) from public, anon;
revoke execute on function public.resume_trip(bigint) from public, anon;
revoke execute on function public.end_trip(bigint) from public, anon;
grant execute on function public.start_trip(bigint) to authenticated;
grant execute on function public.pause_trip(bigint) to authenticated;
grant execute on function public.resume_trip(bigint) to authenticated;
grant execute on function public.end_trip(bigint) to authenticated;

-- Lets any member leave a trip, owner included. An owner's trip passes on by the same succession rule
-- account deletion uses, or is deleted if nobody else is on it
create or replace function public.pass_trip_ownership(target_trip_id bigint, old_owner_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  successor uuid;
begin 
  select user_id into successor
  from public.trip_members
  where trip_id = target_trip_id and user_id <> old_owner_id
  order by (role = 'editor') desc, joined_at
  limit 1;

  if successor is null then
    return false;
  end if;

  -- Remove the old owner's row first so trip_members_one_owner_idx never sees two owners
  delete from public.trip_members where trip_id = target_trip_id and user_id = old_owner_id;
  update public.trip_members set role = 'owner' where trip_id = target_trip_id and user_id = successor;
  update public.trips set owner_id = successor where id = target_trip_id;
  return true;
end;
$$;

revoke execute on function public.pass_trip_ownership(bigint, uuid) from public, anon, authenticated;

create or replace function public.hand_off_owned_trips()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_trip_id bigint;
begin
  -- Trips nobody else is on are left for the trips_owner_id_fkey cascade to delete
  for owned_trip_id in select id from public.trips where owner_id = old.id loop
    perform public.pass_trip_ownership(owned_trip_id, old.id);
  end loop;

  return old;
end;
$$;

create or replace function public.leave_trip(target_trip_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_role text;
begin 
  perform 1 from public.trips where id = target_trip_id for update;

  caller_role := public.trip_role(target_trip_id);

  if caller_role is null then
    raise exception 'not a member of this trip' using errcode = 'P0002';
  end if;

  if caller_role <> 'owner' then
    delete from public.trip_members where trip_id = target_trip_id and user_id = caller;
  elsif not public.pass_trip_ownership(target_trip_id, caller) then
    delete from public.trips where id = target_trip_id;
  end if;
end;
$$;

revoke execute on function public.leave_trip(bigint) from public, anon;
grant execute on function public.leave_trip(bigint) to authenticated;

drop policy "members leave trips" on public.trip_members;
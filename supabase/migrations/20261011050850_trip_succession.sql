-- Before an account is deleted, hand each trip it owns to another member so the
-- trip_owner_id_fkey cascade only removes trips nobody else is on
create or replace function public.hand_off_owned_trips()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_trip_id bigint;
  successor uuid;
begin
  for owned_trip_id in select id from public.trips where owner_id = old.id loop
    -- Longest-standing editor first, then longest-standing viewer
    select user_id into successor
    from public.trip_members
    where trip_id = owned_trip_id and user_id <> old.id
    order by (role = 'editor') desc, joined_at
    limit 1;

    if successor is null then
      continue;
    end if;

    -- Remove the old owner's row first so trip_members_one_owner_idx never sees two owners
    delete from public.trip_members where trip_id = owned_trip_id and user_id = old.id;
    update public.trip_members set role = 'owner' where trip_id = owned_trip_id and user_id = successor;
    update public.trips set owner_id = successor where id = owned_trip_id;
  end loop;

  return old;
end;
$$;

create trigger users_hand_off_owned_trips
  before delete on public.users
  for each row execute function public.hand_off_owned_trips();
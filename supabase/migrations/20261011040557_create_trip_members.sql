-- One row per user on a trip. Owners assign roles; everyone else joins as a viewer
create table public.trip_members (
  trip_id   bigint      not null references public.trips(id) on delete cascade,
  user_id   uuid        not null references public.users(id) on delete cascade,
  role      text        not null default 'viewer'
            check (role = any (array['owner'::text, 'editor'::text, 'viewer'::text])),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_id_idx on public.trip_members (user_id);

-- Exactly one owner per trip
create unique index trip_members_one_owner_idx on public.trip_members (trip_id) where role = 'owner';

alter table public.trip_members enable row level security;

-- Existing trips need their owners added as members
insert into public.trip_members (trip_id, user_id, role)
select id, owner_id, 'owner' from public.trips
on conflict do nothing;

-- The caller's role on a trip, or null if they aren't a member.
-- Security definer so policies on trips and trip_members can call it without recursing into each other's RLS
create or replace function public.trip_role(target_trip_id bigint)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select role from public.trip_members
  where trip_id = target_trip_id and user_id = (select auth.uid());
$$;

revoke execute on function public.trip_role(bigint) from public, anon;
grant execute on function public.trip_role(bigint) to authenticated;

-- Adds the creator as the owner of every new trip
create or replace function public.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.handle_new_trip();

-- RLS policies
create policy "members read trip members"
on public.trip_members for select
to authenticated
using ( public.trip_role(trip_id) is not null );

-- Owners switch other members between viewer and editor. Ownership only moves via transfer_trip_ownership
create policy "owners change member roles"
on public.trip_members for update
to authenticated
using ( public.trip_role(trip_id) = 'owner' and role <> 'owner' )
with check ( role = any (array['editor'::text, 'viewer'::text]) );

-- Anyone but the owner can leave; the owner has to transfer ownership first
create policy "members leave trips"
on public.trip_members for delete
to authenticated
using ( user_id = (select auth.uid()) and role <> 'owner' );

create policy "owners remove members"
on public.trip_members for delete
to authenticated
using ( user_id <> (select auth.uid()) and public.trip_role(trip_id) = 'owner' );

-- No insert grant on purpose: rows only arrive via handle_new_trip and join_trip
grant select, delete on table public.trip_members to authenticated;
grant update (role) on table public.trip_members to authenticated;

-- "owners read their trips" stays: insert ... returning checks it before on_trip_created adds the member row
create policy "members read their trips"
on public.trips for select
to authenticated
using ( public.trip_role(id) is not null );

-- Editors can change trip details; deleting the trip and managing members stays with the owner
create policy "editors update their trips"
on public.trips for update
to authenticated
using ( public.trip_role(id) = 'editor' )
with check ( public.trip_role(id) = 'editor' );

-- Joins the caller to the trip with this invite code as a viewer.
-- Security definer because a non-member can't see the trip yet
create or replace function public.join_trip(code text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_trip_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into joined_trip_id
  from public.trips
  where invite_link = trim(code) and trip_status <> 'completed';

  if joined_trip_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (joined_trip_id, (select auth.uid()))
  on conflict do nothing;

  return joined_trip_id;
end;
$$;

revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated;

-- Hands the trip to another member. The previous owner stays on as an editor and can then leave normally
create or replace function public.transfer_trip_ownership(target_trip_id bigint, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if public.trip_role(target_trip_id) is distinct from 'owner' then
    raise exception 'only the owner can transfer ownership' using errcode = '42501';
  end if;

  if new_owner_id = caller then
    raise exception 'you already own this trip' using errcode = '22023';
  end if;

  -- Demote first so trip_members_one_owner_idx never sees two owners
  update public.trip_members set role = 'editor'
  where trip_id = target_trip_id and user_id = caller;

  update public.trip_members set role = 'owner'
  where trip_id = target_trip_id and user_id = new_owner_id;

  if not found then
    raise exception 'new owner must be a member of the trip' using errcode = 'P0002';
  end if;

  update public.trips set owner_id = new_owner_id where id = target_trip_id;
end;
$$;

revoke execute on function public.transfer_trip_ownership(bigint, uuid) from public, anon;
grant execute on function public.transfer_trip_ownership(bigint, uuid) to authenticated;
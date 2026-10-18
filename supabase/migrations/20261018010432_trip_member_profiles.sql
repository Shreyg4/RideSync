-- Everyone on a trip with just the public parts of their profile.
-- Security definer because users RLS only exposes your own row. Returns display_name (which already
-- respects show_full_name) and avatar_path, never first/last name, and only to fellow members
create or replace function public.list_trip_members(target_trip_id bigint)
returns table (user_id uuid, role text, joined_at timestamptz, display_name text, avatar_path text)
language sql
security definer
set search_path = ''
stable
as $$
  select m.user_id, m.role, m.joined_at, u.display_name, u.avatar_path
  from public.trip_members m
  join public.users u on u.id = m.user_id
  where m.trip_id = target_trip_id
    and public.trip_role(target_trip_id) is not null
  order by m.role = 'owner' desc, m.joined_at;
$$;

revoke execute on function public.list_trip_members(bigint) from public, anon;
grant execute on function public.list_trip_members(bigint) to authenticated;

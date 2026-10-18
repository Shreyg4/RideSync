-- Swaps deep invite_link for an 8-character code people can type in
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    candidate := '';
    -- 256 is a multiple of 32, so masking each byte keeps every character equally likely
    for i in 0..7 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
    end loop;
    -- Security definer so this sees every trip, not just the caller's. Retries the rare collision
    -- instead of letting trips_invite_link_key fail the insert
    exit when not exists (select 1 from public.trips where invite_link = candidate);
  end loop;
  return candidate;
end;
$$;

-- Runs as the inserting user through the column default, so authenticated needs execute
revoke execute on function public.generate_join_code() from public, anon;
grant execute on function public.generate_join_code() to authenticated;

alter table public.trips
  alter column invite_link set default public.generate_join_code();

-- Re-key existing trips so every code is in the new format
update public.trips set invite_link = public.generate_join_code();

alter table public.trips
  add constraint invite_link_format check (invite_link ~ '^[0-9A-HJKMNP-TV-Z]{8}$');

-- Forgiving about how the code was typed: any case, spaces or dashes
create or replace function public.join_trip(code text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := translate(upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'OIL', '011');
  joined_trip_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into joined_trip_id
  from public.trips
  where invite_link = normalized and trip_status <> 'completed';

  if joined_trip_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id)
  values (joined_trip_id, (select auth.uid()))
  on conflict do nothing;

  return joined_trip_id;
end;
$$;
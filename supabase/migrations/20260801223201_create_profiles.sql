-- Public-facing user data. auth.users holds credentials; this table holds everything the
-- app shows. One row per account, created automatically by the trigger at the bottom.

create table profiles (
  -- Shares its primary key with auth.users, so there's no separate join key and deleting
  id uuid primary key references auth.users(id) on delete cascade,
  username varchar(20) not null check (username = trim(username) and length(username) >= 5 and (username ~ '^[a-zA-Z0-9_]+$')),
  -- `= trim(...)` rejects padded values outright rather than just empty ones, so the generated display_name below can't end up with a doubled space.
  first_name text not null check (first_name = trim(first_name) and length(first_name) > 0),
  last_name text not null check (last_name = trim(last_name) and length(last_name) > 0),
  show_full_name boolean not null default false,
  avatar_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usernames are case-preserving but must be unique case-insensitively. 
-- Indexing lower(username) is also what lets username_available use an index rather than scanning.
create unique index profiles_username_lower_idx on profiles (lower(username));

-- What the UI renders for a user. Stored so it can be selected and sorted
-- like any other column; Postgres recomputes it whenever the inputs change.
alter table profiles add column display_name text generated always as (
  case when show_full_name
    then first_name || ' ' || last_name
    else username
  end
) stored;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Username availability check for the signup form.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(candidate))
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Creates the profile row as a side effect of signup. The client calls supabase.auth.signUp
-- with first_name/last_name/username in the metadata options, and this reads them back out.
create function handle_new_user()
returns trigger
language plpgsql
security  definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, first_name, last_name)
  values (new.id,
          trim(new.raw_user_meta_data ->> 'username'),
          trim(new.raw_user_meta_data ->> 'first_name'),
          trim(new.raw_user_meta_data ->> 'last_name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

-- No insert policy on purpose: rows only ever arrive via handle_new_user, which bypasses
-- RLS as a security definer function.
create policy "read own profile"
on profiles for select
to authenticated
using ( id = (select auth.uid()) );

-- `with check` covers the row after the update, so a user can't reassign their profile to
-- someone else's id.
create policy "update own profile"
on profiles for update
to authenticated
using ( id = (select auth.uid()) )
with check ( id = (select auth.uid()) );

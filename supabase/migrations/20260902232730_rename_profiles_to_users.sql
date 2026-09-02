alter table public.profiles rename to users;
alter table public.users rename column avatar_image to avatar_path;

alter table public.users rename constraint profiles_pkey to users_pkey;
alter table public.users rename constraint profiles_id_fkey to users_id_fkey;
alter table public.users rename constraint profiles_username_check to users_username_check;
alter table public.users rename constraint profiles_first_name_check to users_first_name_check;
alter table public.users rename constraint profiles_last_name_check to users_last_name_check;

alter index profiles_username_lower_idx rename to users_username_lower_idx;

alter trigger profiles_set_updated_at on public.users rename to users_set_updated_at;

alter policy "read own profile" on public.users rename to "read own user row";
alter policy "update own profile" on public.users rename to "update own user row";

create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.users where lower(username) = lower(trim(candidate))
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, username, first_name, last_name)
  values (new.id,
          trim(new.raw_user_meta_data ->> 'username'),
          trim(new.raw_user_meta_data ->> 'first_name'),
          trim(new.raw_user_meta_data ->> 'last_name'));
  return new;
end;
$$;

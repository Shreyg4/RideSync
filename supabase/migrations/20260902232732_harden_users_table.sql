revoke update on table public.users from authenticated;
grant update (first_name, last_name, show_full_name, avatar_path)
  on table public.users to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  meta_first    text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  meta_last     text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
begin
  insert into public.users (id, username, first_name, last_name)
  values (
    new.id,
    coalesce(meta_username, 'user_' || substr(replace(new.id::text, '-', ''), 1, 15)),
    coalesce(meta_first, 'New'),
    coalesce(meta_last, 'Member')
  );
  return new;
end;
$$;

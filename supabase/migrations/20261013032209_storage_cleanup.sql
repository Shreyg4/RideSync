-- Storage files that no row uses anymore.
create table public.storage_cleanup_queue (
  bucket_id text        not null,
  path      text        not null,
  queued_at timestamptz not null default now(),
  primary key (bucket_id, path)
);

alter table public.storage_cleanup_queue enable row level security;

grant select, delete on table public.storage_cleanup_queue to service_role;

insert into public.storage_cleanup_queue (bucket_id, path, queued_at)
select 'avatars', path, queued_at from public.deleted_avatars
on conflict do nothing;

drop trigger users_queue_avatar_deletion on public.users;
drop function public.queue_avatar_deletion();
drop table public.deleted_avatars;

-- An avatar belongs to exactly one user, so a deleted user row always leaves its file unused
create or replace function public.queue_avatar_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.avatar_path is not null then
    insert into public.storage_cleanup_queue (bucket_id, path)
    values ('avatars', old.avatar_path)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger users_queue_avatar_cleanup
  after delete on public.users
  for each row execute function public.queue_avatar_cleanup();

-- Trip images are shared: cancel_trip copies image_url into every member's saved trip and
-- start_saved_trip copies it into a new trip. Only queue the file once nothing uses it.
create or replace function public.queue_trip_image_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.image_url is null then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if new.image_url is not distinct from old.image_url then
      return null;
    end if;
  end if;

  if not exists (select 1 from public.trips where image_url = old.image_url)
     and not exists (select 1 from public.saved_trips where image_url = old.image_url) then
    insert into public.storage_cleanup_queue (bucket_id, path)
    values ('trip-images', old.image_url)
    on conflict do nothing;
  end if;

  return null;
end;
$$;

create constraint trigger trips_queue_image_cleanup
  after delete or update of image_url on public.trips
  deferrable initially deferred
  for each row execute function public.queue_trip_image_cleanup();

create constraint trigger saved_trips_queue_image_cleanup
  after delete on public.saved_trips
  deferrable initially deferred
  for each row execute function public.queue_trip_image_cleanup();

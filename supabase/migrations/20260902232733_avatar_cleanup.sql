create table public.deleted_avatars (
  path        text primary key,
  user_id     uuid not null,
  queued_at   timestamptz not null default now()
);

alter table public.deleted_avatars enable row level security;

create or replace function public.queue_avatar_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.avatar_path is not null then
    insert into public.deleted_avatars (path, user_id)
    values (old.avatar_path, old.id)
    on conflict (path) do nothing;
  end if;
  return old;
end;
$$;

create trigger users_queue_avatar_deletion
  after delete on public.users
  for each row execute function public.queue_avatar_deletion();

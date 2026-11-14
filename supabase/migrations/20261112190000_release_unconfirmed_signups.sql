-- An account that never entered the code from its sign-up email holds nothing: no session, trips or
-- photo. So it shouldn't hold a username or an email either, or a sign-up retried with a corrected
-- email reads its own username as taken, and one retried with the same email keeps the first
-- attempt's details, since Supabase won't change an unconfirmed user it already has

-- Only confirmed accounts keep a username taken. Accounts made before confirmations were on, and
-- Google or Apple accounts, all have email_confirmed_at set
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1
    from public.users u
    join auth.users a on a.id = u.id
    where lower(u.username) = lower(trim(candidate))
      and a.email_confirmed_at is not null
  );
$$;

-- Clears any unconfirmed account holding this email or username, so the sign-up that follows starts
-- fresh. Deleting from auth.users cascades to public.users. Returns nothing, so it can't be used to
-- learn whether an email has signed up. The cost of being callable by anyone is that a stranger
-- could restart someone's unfinished sign-up, which a confirmed account is never exposed to
create or replace function public.release_unconfirmed_signup(
  email_address text,
  wanted_username text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users a
  where a.email_confirmed_at is null
    and a.is_anonymous is not true
    and (
      lower(a.email) = lower(trim(email_address))
      or a.id in (
        select u.id
        from public.users u
        where lower(u.username) = lower(trim(wanted_username))
      )
    );
$$;

revoke execute on function public.release_unconfirmed_signup(text, text) from public;
grant execute on function public.release_unconfirmed_signup(text, text) to anon, authenticated;

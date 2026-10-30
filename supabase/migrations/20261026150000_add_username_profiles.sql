begin;

-- A private profile row for each auth user. Usernames are normalized to lowercase.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format_check
    check (username = pg_catalog.lower(username)
      and username ~ '^[a-z0-9_]{3,24}$')
);

-- Give accounts that existed before this migration a stable generated username.
-- Users can receive a chosen username when they register after this migration.
insert into public.profiles (id, username)
select
  u.id,
  'user_' || pg_catalog.substr(pg_catalog.replace(u.id::text, '-', ''), 1, 12)
from auth.users as u
where not exists (
  select 1 from public.profiles as p where p.id = u.id
)
on conflict (id) do nothing;

-- Availability pre-check for the registration UI. The UNIQUE constraint above
-- remains the authoritative protection against simultaneous duplicate requests.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    pg_catalog.lower(pg_catalog.btrim(coalesce(candidate, ''))) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles as p
      where p.username = pg_catalog.lower(pg_catalog.btrim(coalesce(candidate, '')))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Create the profile as part of auth-user creation. A missing username (for
-- older clients/admin-created users or future OAuth providers) receives a
-- deterministic private handle. Usernames supplied by the registration form
-- must still meet the format rule and the UNIQUE constraint.
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := pg_catalog.lower(
    pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'username', ''))
  );

  if requested_username = '' then
    requested_username := 'user_' || pg_catalog.substr(
      pg_catalog.replace(new.id::text, '-', ''), 1, 12
    );
  elsif requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters and contain only letters, numbers, and underscores.'
      using errcode = '23514';
  end if;

  insert into public.profiles (id, username)
  values (new.id, requested_username);

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

-- Profiles are private: users can read only their own row. Writes happen
-- through the auth trigger, so clients cannot self-assign a duplicate username.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

commit;

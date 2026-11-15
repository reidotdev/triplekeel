-- REI-286: deleting an account deletes all of its data.
--
-- Every user table now has a foreign key to public.users with
-- ON DELETE CASCADE. Deleting a users row removes the user's profile,
-- devices, signals, levels and nudges in the same statement. Two paths delete
-- a users row:
--   * public.delete_my_data(), which the settings page calls with the user's
--     Clerk session before it deletes the Clerk user;
--   * the Clerk user.deleted webhook, as a backstop, for example when an
--     account is deleted from the Clerk dashboard.
--
-- Orphans. Production may hold rows whose user_id has no users row, for
-- example from accounts created before the webhook could write users
-- (20261115013000_grant_users_to_service_role.sql). A foreign key would not
-- validate over them, and we must not delete anyone's data to make it fit.
-- So step 1 adds a placeholder users row for each orphan user_id first:
-- email, first_name and last_name are null, image_url is '', and both Clerk
-- times are the user's earliest row time. The next user.updated webhook for a
-- live Clerk user fills in the real values. A placeholder for a Clerk user
-- that no longer exists stays until someone deletes it, which then cascades.
-- Find placeholders with: where email is null and image_url = ''.

-- 1. Placeholder users rows for orphans. Returns how many it added.
-- Only the migration runs it. No client role can.
create function public.backfill_orphan_users()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_added integer;
begin
  insert into public.users (user_id, email, first_name, last_name, image_url, clerk_created_at, clerk_updated_at)
  select o.user_id, null, null, null, '', o.first_seen, o.first_seen
  from (
    select r.user_id, coalesce(pg_catalog.min(r.seen_at), pg_catalog.now()) as first_seen
    from (
      select p.user_id, p.created_at as seen_at from public.profiles p
      union all
      select d.user_id, d.created_at from public.devices d
      union all
      select s.user_id, s.created_at from public.signals s
      union all
      select l.user_id, l.updated_at from public.levels l
      union all
      select n.user_id, n.created_at from public.nudges n
    ) r
    group by r.user_id
  ) o
  where not exists (select 1 from public.users u where u.user_id = o.user_id)
  on conflict (user_id) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function public.backfill_orphan_users() from public, anon, authenticated, service_role;

select public.backfill_orphan_users();

-- 2. Foreign keys. Each child table already has an index that starts with
-- user_id, except devices, so add one there for the cascade.
create index devices_user_id_idx on public.devices (user_id);

alter table public.profiles
  add constraint profiles_user_id_fkey foreign key (user_id)
    references public.users (user_id) on delete cascade;
alter table public.devices
  add constraint devices_user_id_fkey foreign key (user_id)
    references public.users (user_id) on delete cascade;
alter table public.signals
  add constraint signals_user_id_fkey foreign key (user_id)
    references public.users (user_id) on delete cascade;
alter table public.levels
  add constraint levels_user_id_fkey foreign key (user_id)
    references public.users (user_id) on delete cascade;
alter table public.nudges
  add constraint nudges_user_id_fkey foreign key (user_id)
    references public.users (user_id) on delete cascade;

-- 3. Deletes the signed-in user's users row, and with it all their data.
-- The user is the token's `sub`. Running it again deletes nothing and
-- succeeds, so a retry after a failed Clerk deletion is safe.
create function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text := (select auth.jwt() ->> 'sub');
begin
  if v_user_id is null or pg_catalog.length(v_user_id) not between 1 and 200 then
    raise exception using errcode = 'P0001', message = 'not_signed_in';
  end if;

  delete from public.users where user_id = v_user_id;
end;
$$;

-- Only signed-in users. Revoke first: production gives new functions no
-- grants, and local defaults would otherwise let anon run it.
revoke all on function public.delete_my_data() from public, anon, authenticated, service_role;
grant execute on function public.delete_my_data() to authenticated;

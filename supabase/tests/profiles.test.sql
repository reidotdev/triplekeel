begin;

select plan(20);

-- Every user table references public.users (REI-286), so the test users
-- need a users row first.
insert into public.users (user_id, image_url, clerk_created_at, clerk_updated_at)
select id, '', now(), now() from unnest(array['clerk_user_1', 'clerk_user_2']) as id;

select has_column('public', 'profiles', 'waitlisted', 'profiles has a waitlisted column');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select')
    and has_table_privilege('authenticated', 'public.profiles', 'insert')
    and has_table_privilege('authenticated', 'public.profiles', 'update'),
  'authenticated can read, insert and update profiles'
);
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
    and not has_table_privilege('anon', 'public.profiles', 'insert')
    and not has_table_privilege('anon', 'public.profiles', 'update'),
  'anon has no access to profiles'
);
select is((select count(*)::int from public.tracks where id = 'product-manager'), 1, 'PM track exists for the profile foreign key');

set local role authenticated;
set local request.jwt.claims = '{"sub":"clerk_user_1"}';

select lives_ok(
  $$insert into public.profiles (user_id, job_title, track_id, current_level, target_level, waitlisted)
    values ('clerk_user_1', 'Product manager', 'product-manager', 'junior', 'mid', false)$$,
  'user inserts their own profile'
);
select is((select job_title from public.profiles), 'Product manager', 'user reads their own profile');
select throws_ok(
  $$insert into public.profiles (user_id, job_title, current_level, target_level)
    values ('clerk_user_2', 'Designer', 'junior', 'mid')$$,
  '42501', 'new row violates row-level security policy for table "profiles"',
  'user cannot insert a profile for someone else'
);
select lives_ok(
  $$insert into public.profiles (user_id, job_title, track_id, current_level, target_level, waitlisted)
    values ('clerk_user_1', 'Senior PM', 'product-manager', 'mid', 'senior', false)
    on conflict (user_id) do update set
      job_title = excluded.job_title, track_id = excluded.track_id,
      current_level = excluded.current_level, target_level = excluded.target_level,
      waitlisted = excluded.waitlisted, updated_at = now()$$,
  'user updates their own profile with an upsert'
);
select is((select target_level from public.profiles), 'senior', 'upsert changed the goal');
select throws_ok(
  $$update public.profiles set job_title = repeat('a', 81) where user_id = 'clerk_user_1'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_job_title_length"',
  'job title over 80 characters is rejected'
);
select throws_ok(
  $$update public.profiles set job_title = null, waitlisted = true where user_id = 'clerk_user_1'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_waitlisted_has_title"',
  'waitlist entry needs a job title'
);
select throws_ok(
  $$update public.profiles set track_id = 'unknown-track' where user_id = 'clerk_user_1'$$,
  '23503', 'insert or update on table "profiles" violates foreign key constraint "profiles_track_id_fkey"',
  'unknown track is rejected'
);

set local request.jwt.claims = '{"sub":"clerk_user_2"}';

select is((select count(*)::int from public.profiles), 0, 'second user cannot read the first profile');
update public.profiles set job_title = 'Changed by someone else' where user_id = 'clerk_user_1';
select lives_ok(
  $$insert into public.profiles (user_id, job_title, track_id, current_level, target_level, waitlisted)
    values ('clerk_user_2', 'Designer', null, 'junior', 'mid', true)$$,
  'user with an unsupported title joins the waitlist'
);
select is((select count(*)::int from public.profiles), 1, 'second user reads only their own profile');

reset role;

select is(
  (select job_title from public.profiles where user_id = 'clerk_user_1'),
  'Senior PM',
  'second user cannot update the first profile'
);
select is(
  (select job_title from public.profiles where waitlisted and track_id is null),
  'Designer',
  'waitlisted title is stored without a track'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501', 'permission denied for table profiles',
  'anon cannot read profiles'
);
reset role;

select * from finish();
rollback;

begin;

select plan(32);

-- Rows for one user in every user table.
create function pg_temp.add_user_data(p_user text, p_token text)
returns void
language sql
as $$
  insert into public.profiles (user_id, job_title, track_id, current_level, target_level)
  values (p_user, 'PM', 'product-manager', 'junior', 'mid');
  insert into public.devices (user_id, token_hash) values (p_user, repeat(p_token, 64));
  insert into public.signals (user_id, track_id, app, source, hour, length_bucket, answers)
  values (p_user, 'product-manager', 'claude', 'live', '2026-11-10T10:00Z', '200-500', '[{"q": "success_metric", "a": "yes", "p": 0.9}]');
  insert into public.levels (user_id, area_id, level, confidence, n_prompts, score)
  values (p_user, 'metrics', 'mid', 0.5, 3, 1.5);
  insert into public.nudges (user_id, track_id, items) values (p_user, 'product-manager', '[]');
$$;

create function pg_temp.add_user(p_user text, p_token text)
returns void
language sql
as $$
  insert into public.users (user_id, email, image_url, clerk_created_at, clerk_updated_at)
  values (p_user, p_user || '@example.com', '', now(), now());
  select pg_temp.add_user_data(p_user, p_token);
$$;

-- Rows for one user in each public table with a user_id column, so a new
-- user table is covered too.
create function pg_temp.rows_for(p_user text)
returns integer
language plpgsql
as $$
declare
  v_table text;
  v_count integer;
  v_total integer := 0;
begin
  for v_table in
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
  loop
    execute format('select count(*)::int from public.%I where user_id = $1', v_table) into v_count using p_user;
    v_total := v_total + v_count;
  end loop;
  return v_total;
end;
$$;

-- 1. Foreign keys with ON DELETE CASCADE.
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = ('public.' || t)::regclass and contype = 'f'
      and confrelid = 'public.users'::regclass and confdeltype = 'c'
      and conkey = array[(select attnum from pg_attribute where attrelid = ('public.' || t)::regclass and attname = 'user_id')]
  ),
  t || '.user_id references users on delete cascade'
)
from unnest(array['profiles', 'devices', 'signals', 'levels', 'nudges']) as t;

select is(
  (select array_agg(c.table_name::text order by c.table_name) from information_schema.columns c
   join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'),
  array['devices', 'levels', 'nudges', 'profiles', 'signals', 'users'],
  'these are all the user tables'
);

-- 2. Grants and settings.
select function_privs_are('public', 'delete_my_data', array[]::text[], 'authenticated', array['EXECUTE'], 'authenticated can delete their data');
select function_privs_are('public', 'delete_my_data', array[]::text[], 'anon', array[]::text[], 'anon cannot delete data');
select function_privs_are('public', 'delete_my_data', array[]::text[], 'service_role', array[]::text[], 'service_role cannot run delete_my_data');
select ok(
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid in ('public.delete_my_data()'::regprocedure, 'public.backfill_orphan_users()'::regprocedure)
      and a.grantee = 0
  ),
  'PUBLIC cannot execute the new functions'
);
select ok(
  (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.delete_my_data()'::regprocedure),
  'delete_my_data is security definer with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.backfill_orphan_users()', 'execute')
    and not has_function_privilege('authenticated', 'public.backfill_orphan_users()', 'execute')
    and not has_function_privilege('service_role', 'public.backfill_orphan_users()', 'execute'),
  'no client role can run the backfill'
);
select ok(not has_table_privilege('authenticated', 'public.users', 'delete'), 'authenticated cannot delete users rows directly');

-- 3. Deleting a users row deletes everything for that user, and only that.
select pg_temp.add_user('gone', 'a');
select pg_temp.add_user('kept', 'b');
select is(pg_temp.rows_for('gone'), 6, 'gone has a row in every user table');

-- The Clerk webhook deletes as service_role, which has no grants on the
-- child tables. The cascade still runs.
set local role service_role;
select lives_ok($$delete from public.users where user_id = 'gone'$$, 'the webhook deletes the users row');
select lives_ok($$delete from public.users where user_id = 'gone'$$, 'deleting an already deleted user is fine');
reset role;

select is(pg_temp.rows_for('gone'), 0, 'no rows left for the deleted user');
select is(pg_temp.rows_for('kept'), 6, 'the other user keeps all their rows');

-- 4. delete_my_data deletes the caller's data only.
select pg_temp.add_user('me', 'c');

set local role anon;
select throws_ok($$select public.delete_my_data()$$, '42501', null, 'anon cannot run delete_my_data');
reset role;

set local role service_role;
select throws_ok($$select public.delete_my_data()$$, '42501', null, 'service_role cannot run delete_my_data');
reset role;

set local role authenticated;
set local request.jwt.claims = '{}';
select throws_ok($$select public.delete_my_data()$$, 'P0001', 'not_signed_in', 'a token without a sub deletes nothing');

set local request.jwt.claims = '{"sub":"me"}';
select lives_ok($$select public.delete_my_data()$$, 'a signed-in user deletes their data');
select lives_ok($$select public.delete_my_data()$$, 'running it again is fine');
reset role;

select is(pg_temp.rows_for('me'), 0, 'no rows left for the caller');
select is(pg_temp.rows_for('kept'), 6, 'other users keep all their rows');

-- 5. The orphan backfill keeps data. Drop the foreign keys inside this
-- transaction to recreate the state before the migration.
alter table public.profiles drop constraint profiles_user_id_fkey;
alter table public.devices drop constraint devices_user_id_fkey;
alter table public.signals drop constraint signals_user_id_fkey;
alter table public.levels drop constraint levels_user_id_fkey;
alter table public.nudges drop constraint nudges_user_id_fkey;

select pg_temp.add_user_data('orphan', 'd');
update public.signals set created_at = '2026-11-01T08:00Z' where user_id = 'orphan';
insert into public.signals (user_id, track_id, app, source, hour, length_bucket, answers)
values ('orphan_signals_only', 'product-manager', 'chatgpt', 'live', '2026-11-10T10:00Z', '200-500', '[{"q": "success_metric", "a": "no", "p": 0.8}]');

select is(public.backfill_orphan_users(), 2, 'the backfill adds a users row for each orphan user');
select is(public.backfill_orphan_users(), 0, 'running the backfill again adds nothing');
select is(
  (select row(email, first_name, last_name, image_url, clerk_created_at, clerk_updated_at)::text from public.users where user_id = 'orphan'),
  row(null::text, null::text, null::text, '', '2026-11-01T08:00Z'::timestamptz, '2026-11-01T08:00Z'::timestamptz)::text,
  'a placeholder row has no details and the earliest row time'
);
select is(pg_temp.rows_for('orphan'), 6, 'the orphan keeps a row in every table, plus the new users row');
select is(pg_temp.rows_for('orphan_signals_only'), 2, 'the signals-only orphan keeps its signal');
select is(
  (select email from public.users where user_id = 'kept'),
  'kept@example.com',
  'existing users rows are unchanged'
);

select lives_ok(
  $$alter table public.profiles add constraint profiles_user_id_fkey foreign key (user_id) references public.users (user_id) on delete cascade;
    alter table public.devices add constraint devices_user_id_fkey foreign key (user_id) references public.users (user_id) on delete cascade;
    alter table public.signals add constraint signals_user_id_fkey foreign key (user_id) references public.users (user_id) on delete cascade;
    alter table public.levels add constraint levels_user_id_fkey foreign key (user_id) references public.users (user_id) on delete cascade;
    alter table public.nudges add constraint nudges_user_id_fkey foreign key (user_id) references public.users (user_id) on delete cascade$$,
  'the foreign keys validate after the backfill'
);

select * from finish();
rollback;

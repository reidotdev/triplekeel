begin;

select plan(7);

select ok((select relrowsecurity from pg_class where oid = 'public.users'::regclass), 'users RLS enabled');

-- The Clerk webhook writes users with the service-role key.
select ok(
  has_table_privilege('service_role', 'public.users', 'select')
    and has_table_privilege('service_role', 'public.users', 'insert')
    and has_table_privilege('service_role', 'public.users', 'update')
    and has_table_privilege('service_role', 'public.users', 'delete'),
  'service_role can select, insert, update and delete users'
);
select ok(
  not has_table_privilege('service_role', 'public.users', 'truncate'),
  'service_role cannot truncate users'
);

-- Signed-in users only read their own row. Anon has nothing.
select ok(
  has_table_privilege('authenticated', 'public.users', 'select')
    and not has_table_privilege('authenticated', 'public.users', 'insert')
    and not has_table_privilege('authenticated', 'public.users', 'update')
    and not has_table_privilege('authenticated', 'public.users', 'delete'),
  'authenticated can only read users'
);
select ok(not has_table_privilege('anon', 'public.users', 'select'), 'anon cannot read users');

-- The webhook upsert works as service_role.
set local role service_role;
select lives_ok(
  $$insert into public.users (user_id, email, image_url, clerk_created_at, clerk_updated_at)
    values ('clerk_user_webhook', 'webhook@example.com', '', now(), now())
    on conflict (user_id) do update set email = excluded.email, clerk_updated_at = excluded.clerk_updated_at$$,
  'service_role upserts a user like the Clerk webhook'
);
select lives_ok(
  $$delete from public.users where user_id = 'clerk_user_webhook'$$,
  'service_role deletes a user like the Clerk webhook'
);
reset role;

select * from finish();
rollback;

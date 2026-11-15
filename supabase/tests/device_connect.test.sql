begin;

select plan(22);

-- Every user table references public.users (REI-286), so the test users
-- need a users row first.
insert into public.users (user_id, image_url, clerk_created_at, clerk_updated_at)
select id, '', now(), now() from unnest(array['clerk_user_2']) as id;

insert into public.users (user_id, email, clerk_created_at, clerk_updated_at)
values ('clerk_user_1', 'one@example.com', now(), now());
insert into public.profiles (user_id, track_id)
values ('clerk_user_1', 'product-manager');
insert into public.devices (id, user_id, token_hash)
values ('00000000-0000-0000-0000-000000000002', 'clerk_user_2', repeat('b', 64));

-- A signed-in user creates, lists and revokes their own devices.
set local role authenticated;
set local request.jwt.claims = '{"sub":"clerk_user_1"}';

select lives_ok(
  $$insert into public.devices (user_id, token_hash) values ('clerk_user_1', repeat('a', 64))$$,
  'user creates their own device'
);
select throws_ok(
  $$insert into public.devices (user_id, token_hash) values ('clerk_user_2', repeat('c', 64))$$,
  '42501', null, 'user cannot create a device for someone else'
);
select throws_ok(
  $$insert into public.devices (user_id, token_hash, revoked_at) values ('clerk_user_1', repeat('d', 64), now())$$,
  '42501', null, 'user cannot set other columns on insert'
);
select is((select count(*)::int from public.devices), 1, 'user lists only their own devices');
select throws_ok(
  $$select token_hash from public.devices$$,
  '42501', null, 'user cannot read token hashes'
);
select throws_ok(
  $$update public.devices set token_hash = repeat('e', 64)$$,
  '42501', null, 'user cannot change a token hash'
);
select throws_ok(
  $$select * from public.read_device_context(repeat('a', 64))$$,
  '42501', null, 'signed-in users cannot call the device read function'
);
select lives_ok(
  $$update public.devices set revoked_at = now() where id = '00000000-0000-0000-0000-000000000002'$$,
  'revoking another user''s device matches no rows'
);
reset role;

select is(
  (select revoked_at from public.devices where id = '00000000-0000-0000-0000-000000000002'),
  null,
  'another user''s device stays active'
);

-- The extension reads its account with the token hash.
set local role anon;
select results_eq(
  $$select email, track_id, track_name from public.read_device_context(repeat('a', 64))$$,
  $$values ('one@example.com'::text, 'product-manager'::text, 'Product manager'::text)$$,
  'active device reads its owner''s email and track'
);
select results_eq(
  $$select email, track_id, track_name from public.read_device_context(repeat('b', 64))$$,
  $$values (null::text, null::text, null::text)$$,
  'a user with no profile yet gets empty fields'
);
select throws_ok(
  $$select * from public.read_device_context(repeat('f', 64))$$,
  'P0001', 'device_not_found', 'unknown token hash is rejected'
);
select throws_ok(
  $$select * from public.read_device_context(null)$$,
  'P0001', 'device_not_found', 'null token hash is rejected'
);
select throws_ok(
  $$select count(*) from public.devices$$,
  '42501', null, 'anon cannot read devices directly'
);
reset role;

-- Revoking makes the next read fail.
set local role authenticated;
set local request.jwt.claims = '{"sub":"clerk_user_1"}';
select lives_ok(
  $$update public.devices set revoked_at = now() where revoked_at is null$$,
  'user revokes their own device'
);
select throws_ok(
  $$update public.devices set revoked_at = null$$,
  '42501', null, 'a revoked device cannot be made active again'
);
reset role;

select isnt(
  (select revoked_at from public.devices where token_hash = repeat('a', 64)),
  null,
  'the device is revoked'
);

set local role anon;
select throws_ok(
  $$select * from public.read_device_context(repeat('a', 64))$$,
  'P0001', 'device_revoked', 'revoked device is rejected'
);
reset role;

select ok(has_function_privilege('anon', 'public.read_device_context(text)', 'execute'), 'anon can execute the device read function');
select ok(not has_function_privilege('authenticated', 'public.read_device_context(text)', 'execute'), 'authenticated cannot execute the device read function');
select ok(not has_function_privilege('service_role', 'public.read_device_context(text)', 'execute'), 'service_role cannot execute the device read function');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.read_device_context(text)'::regprocedure),
  'device read function is security definer with an empty search_path'
);

select * from finish();
rollback;

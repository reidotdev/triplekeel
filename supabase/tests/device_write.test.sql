begin;

select plan(34);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'devices', 'devices table exists');
select has_table('public', 'signals', 'signals table exists');
select has_table('public', 'tracks', 'tracks table exists');
select has_table('public', 'skill_areas', 'skill_areas table exists');
select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'levels', 'levels table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.devices'::regclass), 'devices RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.signals'::regclass), 'signals RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.tracks'::regclass), 'tracks RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.skill_areas'::regclass), 'skill areas RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.questions'::regclass), 'questions RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.levels'::regclass), 'levels RLS enabled');

insert into public.devices (id, user_id, token_hash)
values
  ('00000000-0000-0000-0000-000000000001', 'clerk_user_1', repeat('a', 64)),
  ('00000000-0000-0000-0000-000000000002', 'clerk_user_2', repeat('b', 64));

select is(
  public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}]}]'::jsonb),
  1,
  'device write stores a signal for its owner'
);
select is((select user_id from public.signals limit 1), 'clerk_user_1', 'device cannot choose another user');
select is(
  public.write_device_signals(repeat('b', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}]}]'::jsonb),
  1,
  'second device writes its own signal'
);

select throws_ok(
  $$select public.write_device_signals(repeat('c', 64), '[]'::jsonb)$$,
  'P0001', 'device_not_found', 'unknown token hash is rejected'
);
select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), '[]'::jsonb)$$,
  'P0001', 'invalid_batch', 'empty batch is rejected'
);
select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), (select jsonb_agg(jsonb_build_object('schema','triplekeel.signal.v1','track','product-manager','app','chatgpt','source','live','hour','2026-11-14T10:00Z','length_bucket','200-500','answers',jsonb_build_array(jsonb_build_object('q','target_user','a','yes','p',0.91)))) from generate_series(1, 51)))$$,
  'P0001', 'invalid_batch', 'batch over 50 is rejected'
);

update public.devices set revoked_at = now() where id = '00000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select public.write_device_signals(repeat('b', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}]}]'::jsonb)$$,
  'P0001', 'device_revoked', 'revoked device is rejected'
);

select is(
  public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"import","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}],"import_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'::jsonb),
  1,
  'first import key is inserted'
);
select is(
  public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"import","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}],"import_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'::jsonb),
  0,
  'duplicate import key is ignored'
);

update public.devices set rate_window_reports = 50 where token_hash = repeat('a', 64);
select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}]}]'::jsonb)$$,
  'P0001', 'rate_limit_exceeded', 'device report rate limit applies'
);
update public.devices set rate_window_started_at = date_trunc('minute', now()) - interval '2 minutes', rate_window_reports = 50 where token_hash = repeat('a', 64);

set local role authenticated;
set local request.jwt.claims = '{"sub":"clerk_user_1"}';
select is((select count(*)::int from public.signals), 2, 'Clerk user reads only their own signals');
set local request.jwt.claims = '{"sub":"clerk_user_2"}';
select is((select count(*)::int from public.signals), 1, 'second Clerk user reads only their own signals');
reset role;

select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v2","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}]}]'::jsonb)$$,
  'P0001', 'invalid_report', 'invalid schema version is rejected'
);
select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}],"prompt":"secret"}]'::jsonb)$$,
  'P0001', 'invalid_report', 'unknown prompt-bearing key is rejected'
);
select throws_ok(
  $$select public.write_device_signals(repeat('a', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"chatgpt","source":"live","hour":"2026-11-14T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"yes","p":0.91}],"user_id":"clerk_user_2"}]'::jsonb)$$,
  'P0001', 'invalid_report', 'report cannot select a different owner'
);

select is((select count(*)::int from public.tracks where id = 'product-manager'), 1, 'PM track seeded');
select ok(not has_table_privilege('anon', 'public.signals', 'insert'), 'anon cannot insert directly');
select ok(has_function_privilege('anon', 'public.write_device_signals(text,jsonb)', 'execute'), 'anon can execute only the device write entry point');
select ok(not has_function_privilege('authenticated', 'public.write_device_signals(text,jsonb)', 'execute'), 'authenticated cannot invoke device write function');
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.write_device_signals(text,jsonb)'::regprocedure),
  'device write function has an empty search_path'
);

select * from finish();
rollback;

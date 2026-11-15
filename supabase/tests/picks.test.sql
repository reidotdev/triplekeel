begin;

select plan(43);

-- Tables, RLS and grants.
select has_table('public', 'picks', 'picks exists');
select has_table('public', 'pick_flags', 'pick_flags exists');
select ok((select relrowsecurity from pg_class where oid = 'public.picks'::regclass), 'picks has RLS on');
select ok((select relrowsecurity from pg_class where oid = 'public.pick_flags'::regclass), 'pick_flags has RLS on');

select table_privs_are('public', 'picks', 'anon', array[]::text[], 'anon has no privileges on picks');
select table_privs_are('public', 'picks', 'authenticated', array['SELECT'], 'authenticated can only select picks');
select table_privs_are('public', 'picks', 'service_role', array[]::text[], 'service_role writes picks only through the function');
select table_privs_are('public', 'pick_flags', 'anon', array[]::text[], 'anon has no privileges on pick_flags');
select table_privs_are('public', 'pick_flags', 'authenticated', array['SELECT'], 'authenticated can only select pick_flags');
select table_privs_are('public', 'pick_flags', 'service_role', array[]::text[], 'service_role writes flags only through the function');
select table_privs_are('public', 'skill_areas', 'service_role', array['SELECT'], 'service_role can read skill areas');
select table_privs_are('public', 'tracks', 'service_role', array['SELECT'], 'service_role can read tracks');

select function_privs_are('public', 'replace_area_picks', array['date', 'text', 'text', 'text', 'jsonb', 'text'], 'service_role', array['EXECUTE'], 'service_role can execute replace_area_picks');
select function_privs_are('public', 'replace_area_picks', array['date', 'text', 'text', 'text', 'jsonb', 'text'], 'authenticated', array[]::text[], 'authenticated cannot execute replace_area_picks');
select function_privs_are('public', 'replace_area_picks', array['date', 'text', 'text', 'text', 'jsonb', 'text'], 'anon', array[]::text[], 'anon cannot execute replace_area_picks');
select ok(
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.replace_area_picks(date, text, text, text, jsonb, text)'::regprocedure and a.grantee = 0
  ),
  'PUBLIC cannot execute replace_area_picks'
);
select ok(
  (select prosecdef and proconfig = array['search_path=""'] from pg_proc
   where oid = 'public.replace_area_picks(date, text, text, text, jsonb, text)'::regprocedure),
  'replace_area_picks is security definer with an empty search_path'
);

create temporary table pick_input as
select
  jsonb_build_object(
    'title', 'Continuous discovery in practice', 'url', 'https://exa.ai/library/podcast/a/episode/1',
    'publisher', 'Product Talk', 'published_at', (now() - interval '10 days')::text,
    'podcast_timestamp_seconds', 754, 'source', 'podcast',
    'why_line', 'Shows how to run a weekly customer interview without a research team.'
  ) as podcast,
  jsonb_build_object(
    'title', 'Interview notes that lead to decisions', 'url', 'https://example.com/interviews',
    'publisher', 'example.com', 'published_at', (now() - interval '20 days')::text,
    'podcast_timestamp_seconds', null, 'source', 'web',
    'why_line', 'Gives a simple template for turning interview notes into problem statements.'
  ) as web;
grant select on pick_input to public;

-- The service role writes through the function.
set local role service_role;

select is(
  public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(podcast, web) from pick_input), null),
  2,
  'a run stores two picks'
);
select throws_ok(
  $$insert into public.picks (track_id, area_id, kind, title, url, published_at, source, why_line, run_date)
    values ('product-manager', 'specs', 'practice', 't', 'https://example.com', now(), 'web', 'w', current_date)$$,
  '42501', null, 'service_role cannot insert picks directly'
);
select throws_ok(
  $$delete from public.picks$$,
  '42501', null, 'service_role cannot delete picks directly'
);
select is(
  public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(web) from pick_input), null),
  1,
  'a second run replaces the set'
);

-- Bad input changes nothing.
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(podcast, jsonb_set(web, '{source}', '"video"')) from pick_input), null)$$,
  'P0001', 'invalid_picks', 'a bad second pick is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(jsonb_set(podcast, '{published_at}', to_jsonb((now() - interval '91 days')::text))) from pick_input), null)$$,
  'P0001', 'invalid_picks', 'a pick older than 90 days is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(podcast || '{"user_id": "someone"}') from pick_input), null)$$,
  'P0001', 'invalid_picks', 'a pick with an unknown key is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(podcast, web, jsonb_set(web, '{url}', '"https://example.com/2"'), jsonb_set(web, '{url}', '"https://example.com/3"')) from pick_input), null)$$,
  'P0001', 'invalid_picks', 'more than 3 picks are rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(jsonb_set(web, '{podcast_timestamp_seconds}', '30')) from pick_input), null)$$,
  'P0001', 'invalid_picks', 'a timestamp on a web pick is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'not_an_area', 'practice',
    (select jsonb_build_array(web) from pick_input), null)$$,
  'P0001', 'unknown_area', 'an unknown area is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'keep',
    (select jsonb_build_array(web) from pick_input), null)$$,
  'P0001', 'invalid_picks', 'an unknown kind is rejected'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice', '[]', null)$$,
  'P0001', 'invalid_picks', 'an empty set needs a flag reason'
);

reset role;
select is(
  (select array_agg(url) from public.picks where area_id = 'problem_discovery' and kind = 'practice'),
  array['https://example.com/interviews'],
  'failed calls left the stored set as it was'
);

-- Flags keep fresh picks and drop stale ones.
insert into public.picks (track_id, area_id, kind, title, url, published_at, source, why_line, run_date)
values ('product-manager', 'problem_discovery', 'practice', 'Old post', 'https://example.com/old',
  now() - interval '120 days', 'web', 'An old pick.', current_date - 30);

set local role service_role;
select is(
  public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice', '[]', 'no_good_picks'),
  0,
  'a run with no good picks stores a flag'
);
reset role;
select is(
  (select reason from public.pick_flags where run_date = current_date and area_id = 'problem_discovery' and kind = 'practice'),
  'no_good_picks',
  'the flag names the reason'
);
select is(
  (select array_agg(url) from public.picks where area_id = 'problem_discovery' and kind = 'practice'),
  array['https://example.com/interviews'],
  'a flag keeps fresh picks and drops stale ones'
);

set local role service_role;
select is(
  public.replace_area_picks(current_date, 'product-manager', 'problem_discovery', 'practice',
    (select jsonb_build_array(podcast) from pick_input), null),
  1,
  'a later run on the same day stores picks'
);
reset role;
select is(
  (select count(*)::int from public.pick_flags where run_date = current_date and area_id = 'problem_discovery' and kind = 'practice'),
  0,
  'a later successful run clears the flag'
);
select is(
  (select podcast_timestamp_seconds from public.picks where area_id = 'problem_discovery' and kind = 'practice'),
  754,
  'the podcast timestamp is stored in seconds'
);

set local role service_role;
select public.replace_area_picks(current_date, 'product-manager', 'eng_design_collab', 'mistake', '[]', 'no_candidates');
reset role;

-- Signed-in users read picks and flags. They can't write.
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_picks"}';
select is((select count(*)::int from public.picks), 1, 'authenticated can read picks');
select is((select count(*)::int from public.pick_flags), 1, 'authenticated can read flags');
select throws_ok(
  $$insert into public.picks (track_id, area_id, kind, title, url, published_at, source, why_line, run_date)
    values ('product-manager', 'specs', 'practice', 't', 'https://example.com', now(), 'web', 'w', current_date)$$,
  '42501', null, 'authenticated cannot insert picks'
);
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'specs', 'practice', '[]', 'no_candidates')$$,
  '42501', null, 'authenticated cannot execute replace_area_picks'
);
reset role;

-- Anonymous callers get nothing.
set local role anon;
select throws_ok($$select count(*) from public.picks$$, '42501', null, 'anon cannot read picks');
select throws_ok($$select count(*) from public.pick_flags$$, '42501', null, 'anon cannot read flags');
select throws_ok(
  $$select public.replace_area_picks(current_date, 'product-manager', 'specs', 'practice', '[]', 'no_candidates')$$,
  '42501', null, 'anon cannot execute replace_area_picks'
);
reset role;

select * from finish();
rollback;

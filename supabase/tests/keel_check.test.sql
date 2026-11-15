begin;

select plan(47);

-- Every user table references public.users (REI-286), so the test users
-- need a users row first.
insert into public.users (user_id, image_url, clerk_created_at, clerk_updated_at)
select id, '', now(), now() from unnest(array['alex', 'blair', 'casey', 'dana', 'erin', 'finn', 'gale', 'capped', 'waitlisted']) as id;

-- Table, RLS and grants.
select has_table('public', 'nudges', 'nudges exists');
select ok((select relrowsecurity from pg_class where oid = 'public.nudges'::regclass), 'nudges has RLS on');
select table_privs_are('public', 'nudges', 'anon', array[]::text[], 'anon has no privileges on nudges');
select table_privs_are('public', 'nudges', 'authenticated', array['SELECT'], 'authenticated can only select nudges');
select table_privs_are('public', 'nudges', 'service_role', array[]::text[], 'service_role has no privileges on nudges');
select function_privs_are('public', 'build_keel_check', array[]::text[], 'authenticated', array['EXECUTE'], 'authenticated can build a card');
select function_privs_are('public', 'build_keel_check', array[]::text[], 'anon', array[]::text[], 'anon cannot build a card');
select function_privs_are('public', 'build_keel_check', array[]::text[], 'service_role', array[]::text[], 'service_role cannot build a card');
select ok(
  not has_function_privilege('anon', 'public.build_keel_check_for(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.build_keel_check_for(text)', 'execute')
    and not has_function_privilege('service_role', 'public.build_keel_check_for(text)', 'execute'),
  'no client role can build a card for another user'
);
select ok(
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid in ('public.build_keel_check()'::regprocedure, 'public.build_keel_check_for(text)'::regprocedure)
      and a.grantee = 0
  ),
  'PUBLIC cannot execute the builders'
);
select ok(
  (select bool_and(prosecdef and proconfig = array['search_path=""']) from pg_proc
   where oid in ('public.build_keel_check()'::regprocedure, 'public.build_keel_check_for(text)'::regprocedure)),
  'both builders are security definer with an empty search_path'
);

-- Picks. Metrics has a newer web post and an older podcast. Prioritization
-- has no mistake pick. The only ai_product_sense mistake pick is stale.
insert into public.picks (id, track_id, area_id, kind, title, url, publisher, published_at, podcast_timestamp_seconds, source, why_line, run_date)
values
  ('00000000-0000-0000-0000-000000000101', 'product-manager', 'metrics', 'practice', 'Metrics podcast', 'https://example.com/metrics-podcast', 'Lenny''s Podcast', now() - interval '30 days', 754, 'podcast', 'Shows how to pick one success metric.', current_date),
  ('00000000-0000-0000-0000-000000000102', 'product-manager', 'metrics', 'practice', 'Metrics post', 'https://example.com/metrics-post', 'example.com', now() - interval '5 days', null, 'web', 'A template for success metrics.', current_date),
  ('00000000-0000-0000-0000-000000000103', 'product-manager', 'problem_discovery', 'practice', 'Discovery podcast', 'https://example.com/discovery-podcast', 'Product Talk', now() - interval '10 days', 60, 'podcast', 'How to name the user first.', current_date),
  ('00000000-0000-0000-0000-000000000104', 'product-manager', 'specs', 'practice', 'Specs post', 'https://example.com/specs-post', 'example.com', now() - interval '3 days', null, 'web', 'Acceptance criteria that engineers use.', current_date),
  ('00000000-0000-0000-0000-000000000105', 'product-manager', 'ai_prototyping', 'mistake', 'Fix-it loops', 'https://example.com/fix-it', 'example.com', now() - interval '2 days', null, 'web', 'Say what is wrong instead of "fix it".', current_date),
  ('00000000-0000-0000-0000-000000000106', 'product-manager', 'ai_product_sense', 'mistake', 'Old mistake post', 'https://example.com/old', 'example.com', now() - interval '120 days', null, 'web', 'A stale pick.', current_date - 30);

create function pg_temp.add_signals(p_user text, p_count integer, p_answers text, p_hour timestamptz default '2026-11-10T10:00Z')
returns void
language plpgsql
as $$
begin
  -- p_answers is a SQL expression over i, the report's number from 1.
  execute pg_catalog.format(
    'insert into public.signals (user_id, track_id, app, source, hour, length_bucket, answers)
     select %L, ''product-manager'', ''claude'', ''live'', %L::timestamptz, ''200-500'', %s
     from generate_series(1, %s) as i',
    p_user, p_hour, p_answers, p_count
  );
end;
$$;

create function pg_temp.a(p_q text, p_a text)
returns jsonb
language sql
as $$ select jsonb_build_object('q', p_q, 'a', p_a, 'p', 0.9) $$;

insert into public.profiles (user_id, job_title, track_id, current_level, target_level)
values
  ('alex', 'PM', 'product-manager', 'mid', 'senior'),
  ('blair', 'PM', 'product-manager', 'junior', 'mid'),
  ('casey', 'PM', 'product-manager', 'junior', 'senior'),
  ('dana', 'PM', 'product-manager', 'junior', 'senior'),
  ('erin', 'PM', 'product-manager', 'junior', 'senior'),
  ('finn', 'PM', 'product-manager', 'junior', 'senior'),
  ('gale', 'PM', 'product-manager', 'junior', 'senior'),
  ('capped', 'PM', 'product-manager', 'junior', 'senior');
insert into public.profiles (user_id, job_title, waitlisted) values ('waitlisted', 'Designer', true);

-- alex: sets a success metric often, says "fix it" often, and never names
-- the user or the problem. Five older reports fall outside the window.
select pg_temp.add_signals('alex', 20, $$jsonb_build_array(
  pg_temp.a('success_metric', case when i <= 14 then 'yes' else 'no' end),
  pg_temp.a('vague_fix', case when i <= 9 then 'yes' else 'no' end),
  pg_temp.a('acceptance', case when i <= 8 then 'yes' else 'no' end),
  pg_temp.a('target_user', 'no'), pg_temp.a('problem', 'no'), pg_temp.a('no_why', 'n/a'))$$);
select pg_temp.add_signals('alex', 5, $$jsonb_build_array(pg_temp.a('success_metric', 'no'))$$, '2026-11-01T10:00Z');

-- blair: strong acceptance criteria, a whole product in one prompt half the
-- time, and no success metrics. Target mid.
select pg_temp.add_signals('blair', 12, $$jsonb_build_array(
  pg_temp.a('acceptance', case when i <= 10 then 'yes' else 'no' end),
  pg_temp.a('kitchen_sink', case when i <= 6 then 'yes' else 'no' end),
  pg_temp.a('success_metric', 'no'))$$);

-- casey: new, three reports.
select pg_temp.add_signals('casey', 3, $$jsonb_build_array(pg_temp.a('target_user', 'yes'), pg_temp.a('success_metric', 'no'))$$);

-- dana: Keep and Test both land on metrics.
select pg_temp.add_signals('dana', 10, $$jsonb_build_array(
  pg_temp.a('success_metric', case when i <= 6 then 'yes' else 'no' end),
  pg_temp.a('metric_interpretation', 'no'))$$);

-- erin: evidence for Stop and Test, but no good pick for either.
select pg_temp.add_signals('erin', 6, $$jsonb_build_array(pg_temp.a('blind_accept', 'yes'), pg_temp.a('asks_tests', 'no'))$$);

-- finn: new, and the weakest area has no picks.
select pg_temp.add_signals('finn', 2, $$jsonb_build_array(pg_temp.a('agent_context', 'no'))$$);

-- gale has no reports.

select public.recompute_user_levels(u)
from unnest(array['alex', 'blair', 'casey', 'dana', 'erin', 'finn']) as u;

create temporary table cards (user_id text primary key, card jsonb not null);
grant all on cards to public;

create function pg_temp.build_as(p_user text)
returns jsonb
language plpgsql
as $$
declare
  v_card jsonb;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_card := public.build_keel_check();
  execute 'reset role';
  insert into cards values (p_user, v_card) on conflict (user_id) do update set card = excluded.card;
  return v_card;
end;
$$;

create function pg_temp.items(p_user text)
returns table (kind text, area_id text, question_id text, pick_url text)
language sql
as $$
  select i->>'kind', i->>'area_id', i->>'question_id', i->'pick'->>'url'
  from cards c, jsonb_array_elements(c.card->'items') with ordinality as e(i, n)
  where c.user_id = p_user
  order by e.n;
$$;

create function pg_temp.item(p_user text, p_kind text)
returns jsonb
language sql
as $$
  select i from cards c, jsonb_array_elements(c.card->'items') as e(i)
  where c.user_id = p_user and i->>'kind' = p_kind;
$$;

select pg_temp.build_as(u)
from unnest(array['alex', 'blair', 'casey', 'dana', 'erin', 'finn', 'gale']) as u;

-- Three users with different reports get different cards.
select results_eq(
  $$select * from pg_temp.items('alex')$$,
  $$values ('keep', 'metrics', 'success_metric', 'https://example.com/metrics-podcast'),
           ('stop', 'ai_prototyping', 'vague_fix', 'https://example.com/fix-it'),
           ('test', 'problem_discovery', null::text, 'https://example.com/discovery-podcast')$$,
  'alex: keep success metrics, stop "fix it", test problem discovery'
);
select results_eq(
  $$select * from pg_temp.items('blair')$$,
  $$values ('keep', 'specs', 'acceptance', 'https://example.com/specs-post'),
           ('test', 'metrics', null::text, 'https://example.com/metrics-podcast')$$,
  'blair: keep acceptance criteria, test metrics, and no Stop without a mistake pick'
);
select results_eq(
  $$select * from pg_temp.items('casey')$$,
  $$values ('test', 'metrics', null::text, 'https://example.com/metrics-podcast')$$,
  'casey, a new user, gets only a Test in the weakest area so far'
);
select isnt(
  (select card->'items' from cards where user_id = 'alex'),
  (select card->'items' from cards where user_id = 'blair'),
  'alex and blair get different cards'
);

-- Counts, labels and dated sources.
select is(
  pg_temp.item('alex', 'keep')->'counts',
  '{"yes": 14, "partly": 0, "no": 6, "answered": 20, "window": 20}'::jsonb,
  'Keep counts the last 20 reports only'
);
select is(
  pg_temp.item('alex', 'stop')->'counts',
  '{"yes": 9, "partly": 0, "no": 11, "answered": 20, "window": 20}'::jsonb,
  'Stop counts the anti-pattern hits'
);
select is(
  pg_temp.item('alex', 'keep')->>'card_label',
  'set a success metric',
  'Keep carries the question''s card label'
);
select is(
  pg_temp.item('alex', 'stop')->>'card_label',
  'asked to "fix it" with no detail',
  'Stop carries the anti-pattern''s card label'
);
select is(
  pg_temp.item('alex', 'test') - 'pick' - 'pick_id',
  '{"kind": "test", "status": "open", "area_id": "problem_discovery", "area_name": "Problem discovery and user research",
    "question_id": null, "card_label": null, "counts": {"prompts": 20, "window": 20},
    "level": {"level": "junior", "target_level": "senior", "gap": 2, "score": 0}}'::jsonb,
  'Test names the gap and counts the area''s prompts'
);
select ok(
  (select bool_and(
      jsonb_typeof(i->'counts') = 'object'
      and (i->'counts'->>'window')::int > 0
      and i->>'status' = 'open'
      and i->>'area_name' is not null
      and (i->'pick'->>'published_at')::timestamptz > now() - interval '90 days'
      and i->'pick'->>'title' is not null
      and i->'pick'->>'url' is not null
      and i->'pick' ?& array['publisher', 'podcast_timestamp_seconds', 'source', 'why_line']
      and (i->>'pick_id')::uuid is not null)
   from cards c, jsonb_array_elements(c.card->'items') as e(i)),
  'every item has counts, a status and a dated pick'
);
select is(
  (select count(*)::int from cards c, jsonb_array_elements(c.card->'items') as e(i)),
  8,
  'eight items across the seven cards'
);
select is(
  pg_temp.item('alex', 'keep')->'pick',
  jsonb_build_object(
    'title', 'Metrics podcast', 'url', 'https://example.com/metrics-podcast',
    'publisher', 'Lenny''s Podcast', 'published_at', (select published_at from public.picks where id = '00000000-0000-0000-0000-000000000101'),
    'podcast_timestamp_seconds', 754, 'source', 'podcast', 'why_line', 'Shows how to pick one success metric.'
  ),
  'a podcast pick wins over a newer web pick, and the item copies it'
);

-- One pick per card: Test takes the podcast, Keep the next metrics pick.
select results_eq(
  $$select * from pg_temp.items('dana')$$,
  $$values ('keep', 'metrics', 'success_metric', 'https://example.com/metrics-post'),
           ('test', 'metrics', null::text, 'https://example.com/metrics-podcast')$$,
  'a pick appears at most once per card'
);

-- No good pick, no item.
select is(
  (select card->'items' from cards where user_id = 'erin'),
  '[]'::jsonb,
  'items without a fresh pick are left out'
);
select is(
  (select card->'items' from cards where user_id = 'finn'),
  '[]'::jsonb,
  'a new user gets nothing when the area has no picks'
);
select is(
  (select card->'items' from cards where user_id = 'gale'),
  '[]'::jsonb,
  'a user without reports gets an empty card'
);

-- Cards are stored as returned.
select is(
  (select count(*)::int from public.nudges),
  7,
  'every build stores a card'
);
select ok(
  (select bool_and(n.items = c.card->'items' and n.user_id = c.user_id and n.track_id = 'product-manager'
      and n.created_at = (c.card->>'created_at')::timestamptz)
   from cards c join public.nudges n on n.id = (c.card->>'id')::uuid),
  'the stored card matches the returned card'
);

-- Errors.
select throws_ok(
  $$select pg_temp.build_as('waitlisted')$$,
  'P0001', 'profile_incomplete', 'a profile without a track cannot build a card'
);
select throws_ok(
  $$select pg_temp.build_as('nobody')$$,
  'P0001', 'profile_incomplete', 'a user without a profile cannot build a card'
);
select throws_ok(
  $$select public.build_keel_check_for(null)$$,
  'P0001', 'not_authenticated', 'a missing user is rejected'
);

-- The cap: 10 builds per UTC day. Yesterday's don't count.
insert into public.nudges (user_id, track_id, items, created_at)
select 'capped', 'product-manager', '[]', now() - interval '1 day' from generate_series(1, 10);
insert into public.nudges (user_id, track_id, items)
select 'capped', 'product-manager', '[]' from generate_series(1, 9);
select lives_ok($$select pg_temp.build_as('capped')$$, 'the 10th build today works');
select throws_ok(
  $$select pg_temp.build_as('capped')$$,
  'P0001', 'keel_check_limit', 'the 11th build today is refused'
);
select is(
  (select count(*)::int from public.nudges where user_id = 'capped' and created_at >= date_trunc('day', now(), 'UTC')),
  10,
  'a refused build stores nothing'
);

-- Row level security: each user reads only their own cards and writes none.
set local role authenticated;
set local request.jwt.claims = '{"sub":"alex","role":"authenticated"}';
select is((select count(*)::int from public.nudges), 1, 'alex sees one card');
select is((select count(*)::int from public.nudges where user_id <> 'alex'), 0, 'alex sees no other user''s cards');
select is(
  (select area_id from public.read_level_gaps() where rank = 1),
  (select i->>'area_id' from cards c, jsonb_array_elements(c.card->'items') as e(i) where c.user_id = 'alex' and i->>'kind' = 'test'),
  'Test is the biggest gap that read_level_gaps ranks first'
);
select throws_ok(
  $$insert into public.nudges (user_id, track_id, items) values ('alex', 'product-manager', '[]')$$,
  '42501', null, 'a user cannot insert a card'
);
select throws_ok(
  $$update public.nudges set items = '[]'$$,
  '42501', null, 'a user cannot update a card'
);
select throws_ok(
  $$delete from public.nudges$$,
  '42501', null, 'a user cannot delete a card'
);
select throws_ok(
  $$select public.build_keel_check_for('blair')$$,
  '42501', null, 'a user cannot build another user''s card'
);
set local request.jwt.claims = '{"sub":"blair","role":"authenticated"}';
select results_eq(
  $$select id from public.nudges$$,
  $$select (card->>'id')::uuid from cards where user_id = 'blair'$$,
  'blair sees only her own card'
);
reset role;

set local role anon;
select throws_ok($$select count(*) from public.nudges$$, '42501', null, 'anon cannot read cards');
select throws_ok($$select public.build_keel_check()$$, '42501', null, 'anon cannot build a card');
reset role;

set local role service_role;
select throws_ok($$select count(*) from public.nudges$$, '42501', null, 'service_role cannot read cards');
reset role;

-- The catalog keeps the labels.
select is(
  (select count(*)::int from public.questions where track_id = 'product-manager' and card_label is not null),
  25,
  'every PM question has a card label'
);

select * from finish();
rollback;

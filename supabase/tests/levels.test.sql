begin;

select plan(37);

-- Every user table references public.users (REI-286), so the test users
-- need a users row first.
insert into public.users (user_id, image_url, clerk_created_at, clerk_updated_at)
select id, '', now(), now() from unnest(array['user_junior', 'user_mid', 'user_senior', 'user_few', 'user_zero', 'user_recent', 'user_p', 'user_na', 'user_polarity', 'user_device']) as id;

-- Fixed reports, written straight into signals. Hours are in the past, so the
-- newest report hour is the recency reference.
create function pg_temp.add_signals(p_user text, p_count integer, p_answers jsonb, p_hour timestamptz default '2026-11-01T10:00Z', p_source text default 'live')
returns void
language sql
as $$
  insert into public.signals (user_id, track_id, app, source, hour, length_bucket, answers, import_key)
  select p_user, 'product-manager', 'claude', p_source, p_hour, '200-500', p_answers,
    case when p_source = 'import' then replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') end
  from generate_series(1, p_count);
$$;

create function pg_temp.level_of(p_user text, p_area text)
returns table (level text, score numeric, confidence numeric, n_prompts integer)
language sql
as $$
  select l.level, l.score, l.confidence, l.n_prompts
  from public.levels l
  where l.user_id = p_user and l.area_id = p_area;
$$;

-- Three users with clearly different habits in problem discovery
-- (target_user and problem are good, no_why is bad).
select pg_temp.add_signals('user_junior', 5, '[{"q":"target_user","a":"no","p":0.9},{"q":"problem","a":"no","p":0.9},{"q":"no_why","a":"yes","p":0.9},{"q":"acceptance","a":"partly","p":0.8},{"q":"edge_cases","a":"partly","p":0.8}]');
select pg_temp.add_signals('user_mid', 5, '[{"q":"target_user","a":"partly","p":0.9},{"q":"problem","a":"partly","p":0.9},{"q":"no_why","a":"partly","p":0.9}]', p_source => 'import');
select pg_temp.add_signals('user_senior', 3, '[{"q":"target_user","a":"yes","p":0.9},{"q":"problem","a":"yes","p":0.9},{"q":"no_why","a":"no","p":0.9}]');
select pg_temp.add_signals('user_senior', 2, '[{"q":"target_user","a":"yes","p":0.9},{"q":"problem","a":"yes","p":0.9},{"q":"no_why","a":"no","p":0.9}]', p_source => 'import');
select public.recompute_user_levels(u) from unnest(array['user_junior', 'user_mid', 'user_senior']) as u;

select results_eq(
  $$select u, l.level, l.score, l.confidence, l.n_prompts
    from unnest(array['user_junior', 'user_mid', 'user_senior']) as u, pg_temp.level_of(u, 'problem_discovery') l
    order by u$$,
  $$values ('user_junior', 'junior', 0::numeric, 0.5::numeric, 5),
           ('user_mid', 'mid', 1.5::numeric, 0.5::numeric, 5),
           ('user_senior', 'senior', 3::numeric, 0.5::numeric, 5)$$,
  'three users get junior, mid and senior in problem discovery'
);
select results_eq(
  $$select level, score from pg_temp.level_of('user_junior', 'specs')$$,
  $$values ('mid', 1.5::numeric)$$,
  'partly answers put specs at mid'
);
select is(
  (select count(*)::int from public.levels where user_id = 'user_mid'),
  1,
  'areas without answers get no row'
);

-- Polarity: "no" to the anti-pattern no_why is the best answer.
select pg_temp.add_signals('user_polarity', 5, '[{"q":"no_why","a":"no","p":0.9}]');
select public.recompute_user_levels('user_polarity');
select results_eq(
  $$select level, score from pg_temp.level_of('user_polarity', 'problem_discovery')$$,
  $$values ('senior', 3::numeric)$$,
  'a bad-polarity question is inverted'
);

-- n/a is skipped: it neither lowers the score nor counts as a prompt.
select pg_temp.add_signals('user_na', 5, '[{"q":"target_user","a":"yes","p":0.9},{"q":"problem","a":"n/a","p":0.9}]');
select pg_temp.add_signals('user_na', 3, '[{"q":"target_user","a":"n/a","p":0.9},{"q":"problem","a":"n/a","p":0.9}]');
select public.recompute_user_levels('user_na');
select results_eq(
  $$select level, score, n_prompts from pg_temp.level_of('user_na', 'problem_discovery')$$,
  $$values ('senior', 3::numeric, 5)$$,
  'n/a answers are skipped'
);

-- p weighting: four unsure "no" answers weigh less than one sure "yes".
-- score = 3 * 0.9 / (4 * 0.1 + 0.9). Unweighted it would be 0.6, junior.
select pg_temp.add_signals('user_p', 4, '[{"q":"target_user","a":"no","p":0.1}]');
select pg_temp.add_signals('user_p', 1, '[{"q":"target_user","a":"yes","p":0.9}]');
select public.recompute_user_levels('user_p');
select results_eq(
  $$select level, score from pg_temp.level_of('user_p', 'problem_discovery')$$,
  $$values ('senior', 2.0769::numeric)$$,
  'answers are weighted by p'
);

-- Recency: reports 60 days (two half-lives) before the newest weigh 1/4.
-- score = 3 * 3 / (3 + 3 * 0.25) = 2.4. Unweighted it would be 1.5, mid.
-- spread = 0.4, so confidence = 6 / 11 * 0.6.
select pg_temp.add_signals('user_recent', 3, '[{"q":"target_user","a":"no","p":1}]', '2026-09-02T10:00Z');
select pg_temp.add_signals('user_recent', 3, '[{"q":"target_user","a":"yes","p":1}]', '2026-11-01T10:00Z');
select public.recompute_user_levels('user_recent');
select results_eq(
  $$select level, score, confidence, n_prompts from pg_temp.level_of('user_recent', 'problem_discovery')$$,
  $$values ('senior', 2.4::numeric, 0.327::numeric, 6)$$,
  'recent reports count more'
);

-- More prompts and less spread mean more confidence.
select ok(
  (select confidence from pg_temp.level_of('user_senior', 'problem_discovery'))
    > (select confidence from pg_temp.level_of('user_p', 'problem_discovery')),
  'a wider spread lowers confidence'
);
select pg_temp.add_signals('user_senior', 5, '[{"q":"target_user","a":"yes","p":0.9}]');
select public.recompute_user_levels('user_senior');
select results_eq(
  $$select level, confidence, n_prompts from pg_temp.level_of('user_senior', 'problem_discovery')$$,
  $$values ('senior', round(10 / 15.0, 3), 10)$$,
  'more prompts raise confidence'
);

-- Under 5 prompts in an area: no row, and a stale row goes away.
insert into public.levels (user_id, area_id, level, confidence, n_prompts, score)
values ('user_few', 'problem_discovery', 'senior', 0.9, 10, 3);
select pg_temp.add_signals('user_few', 4, '[{"q":"target_user","a":"yes","p":0.9}]');
select public.recompute_user_levels('user_few');
select is(
  (select count(*)::int from public.levels where user_id = 'user_few'),
  0,
  'under 5 prompts there is no level, and a stale row is removed'
);
select pg_temp.add_signals('user_few', 1, '[{"q":"target_user","a":"yes","p":0.9}]');
select public.recompute_user_levels('user_few');
select is(
  (select n_prompts from pg_temp.level_of('user_few', 'problem_discovery')),
  5,
  'the area gets a level at 5 prompts'
);
select pg_temp.add_signals('user_zero', 5, '[{"q":"target_user","a":"yes","p":0}]');
select public.recompute_user_levels('user_zero');
select is(
  (select count(*)::int from public.levels where user_id = 'user_zero'),
  0,
  'answers with p = 0 give no level'
);

-- Thresholds come from skill_areas.
update public.skill_areas set thresholds = '{"junior": 0, "mid": 1.6, "senior": 2.5}' where id = 'problem_discovery';
select public.recompute_user_levels('user_mid');
select is((select level from pg_temp.level_of('user_mid', 'problem_discovery')), 'junior', 'levels follow the area thresholds');
update public.skill_areas set thresholds = '{"junior": 0, "mid": 1, "senior": 2}' where id = 'problem_discovery';
select public.recompute_user_levels('user_mid');
select is((select level from pg_temp.level_of('user_mid', 'problem_discovery')), 'mid', 'restoring the thresholds restores the level');

-- write_device_signals recomputes after each batch, and re-sent imports
-- change nothing.
insert into public.devices (id, user_id, token_hash)
values ('00000000-0000-0000-0000-000000000270', 'user_device', repeat('e', 64));
create temporary table import_batch as
select jsonb_agg(jsonb_build_object(
  'schema', 'triplekeel.signal.v1', 'track', 'product-manager', 'app', 'chatgpt',
  'source', 'import', 'hour', '2026-11-10T09:00Z', 'length_bucket', '200-500',
  'answers', '[{"q":"target_user","a":"yes","p":0.8},{"q":"problem","a":"partly","p":0.8}]'::jsonb,
  'import_key', repeat(i::text, 64)
)) as reports
from generate_series(1, 5) as i;

select is(public.write_device_signals(repeat('e', 64), (select reports from import_batch)), 5, 'five imports are stored');
select results_eq(
  $$select level, score, confidence, n_prompts from pg_temp.level_of('user_device', 'problem_discovery')$$,
  $$values ('senior', 2.25::numeric, 0.375::numeric, 5)$$,
  'the device write computes levels'
);
create temporary table levels_before as select * from public.levels where user_id = 'user_device';
select is(public.write_device_signals(repeat('e', 64), (select reports from import_batch)), 0, 're-sent imports are ignored');
select set_eq(
  $$select area_id, level, score, confidence, n_prompts, updated_at from public.levels where user_id = 'user_device'$$,
  $$select area_id, level, score, confidence, n_prompts, updated_at from levels_before$$,
  're-sent imports do not change levels'
);
select is(
  public.write_device_signals(repeat('e', 64), '[{"schema":"triplekeel.signal.v1","track":"product-manager","app":"claude","source":"live","hour":"2026-11-10T10:00Z","length_bucket":"200-500","answers":[{"q":"target_user","a":"no","p":0.8},{"q":"problem","a":"no","p":0.8}]}]'::jsonb),
  1,
  'a live report is stored'
);
select results_eq(
  $$select level, n_prompts from pg_temp.level_of('user_device', 'problem_discovery')$$,
  $$values ('mid', 6)$$,
  'each batch updates the levels'
);

-- Gaps for the signed-in user.
insert into public.profiles (user_id, job_title, track_id, current_level, target_level)
values
  ('user_junior', 'PM', 'product-manager', 'junior', 'senior'),
  ('user_mid', 'PM', 'product-manager', 'mid', 'senior'),
  ('user_senior', 'PM', 'product-manager', 'senior', 'mid');

set local role authenticated;
set local request.jwt.claims = '{"sub":"user_junior"}';
select is((select count(*)::int from public.read_level_gaps()), 11, 'one row per area of the track');
select results_eq(
  $$select rank, area_id, level, target_level, gap from public.read_level_gaps() where rank <= 3 order by rank$$,
  $$values (1, 'problem_discovery', 'junior', 'senior', 2),
           (2, 'specs', 'mid', 'senior', 1),
           (3, 'ai_agents_daily', null, 'senior', null)$$,
  'gaps are ranked by size, and areas without evidence come last'
);
select is(
  (select count(*)::int from public.read_level_gaps() where level is null and gap is null and confidence is null and n_prompts is null),
  9,
  'areas without enough evidence have no level'
);
select is((select count(*)::int from public.levels), 2, 'a user reads only their own levels');

set local request.jwt.claims = '{"sub":"user_mid"}';
select results_eq(
  $$select area_id, level, gap from public.read_level_gaps() where level is not null$$,
  $$values ('problem_discovery', 'mid', 1)$$,
  'another user sees only their own levels'
);

set local request.jwt.claims = '{"sub":"user_senior"}';
select is(
  (select gap from public.read_level_gaps() where area_id = 'problem_discovery'),
  0,
  'a level above the target is no gap'
);

set local request.jwt.claims = '{"sub":"user_polarity"}';
select is((select count(*)::int from public.read_level_gaps()), 0, 'a user without a profile gets no rows');

select throws_ok(
  $$select public.recompute_user_levels('user_junior')$$,
  '42501', null, 'signed-in users cannot run the recompute'
);
select throws_ok(
  $$insert into public.levels (user_id, area_id, level, confidence, n_prompts, score) values ('user_polarity', 'specs', 'senior', 1, 99, 3)$$,
  '42501', null, 'signed-in users cannot write levels'
);
reset role;

set local role anon;
select throws_ok($$select * from public.read_level_gaps()$$, '42501', null, 'anon cannot read gaps');
reset role;

-- Grants.
select ok(
  not has_function_privilege('anon', 'public.recompute_user_levels(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.recompute_user_levels(text)', 'execute')
    and not has_function_privilege('service_role', 'public.recompute_user_levels(text)', 'execute'),
  'no client role can execute recompute_user_levels'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.recompute_user_levels(text)'::regprocedure),
  'recompute_user_levels is security definer with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.read_level_gaps()', 'execute')
    and not has_function_privilege('anon', 'public.read_level_gaps()', 'execute')
    and not has_function_privilege('service_role', 'public.read_level_gaps()', 'execute'),
  'only authenticated can execute read_level_gaps'
);
select ok(
  (select not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.read_level_gaps()'::regprocedure),
  'read_level_gaps is security invoker with an empty search_path'
);
select ok(
  has_function_privilege('anon', 'public.write_device_signals(text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.write_device_signals(text,jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.write_device_signals(text,jsonb)', 'execute')
    and (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.write_device_signals(text,jsonb)'::regprocedure),
  'write_device_signals keeps its hardening'
);
select ok(
  has_table_privilege('authenticated', 'public.levels', 'select')
    and not has_table_privilege('authenticated', 'public.levels', 'insert')
    and not has_table_privilege('authenticated', 'public.levels', 'update')
    and not has_table_privilege('authenticated', 'public.levels', 'delete'),
  'authenticated can only read levels'
);
select ok(
  not has_table_privilege('anon', 'public.levels', 'select')
    and not has_table_privilege('service_role', 'public.levels', 'select'),
  'anon and service_role cannot read levels'
);

select * from finish();
rollback;

begin;

select plan(20);

-- seed.sql loads the catalog from tracks/ through sync_track_catalog.
select is((select count(*)::int from public.questions where track_id = 'product-manager'), 25, 'seed loads all 25 PM questions');
select is((select count(*)::int from public.skill_areas where track_id = 'product-manager'), 11, 'seed loads all 11 PM areas');
select ok(exists (select 1 from public.skill_areas where id = 'ai_agents_daily'), 'seed loads the ai_agents_daily area');
select is(
  (select thresholds from public.skill_areas where id = 'problem_discovery'),
  '{"junior": 0, "mid": 1, "senior": 2}'::jsonb,
  'seed loads area thresholds from the track file'
);

insert into public.devices (id, user_id, token_hash)
values ('00000000-0000-0000-0000-000000000011', 'clerk_user_catalog', repeat('d', 64));

create temporary table full_report as
select jsonb_build_object(
  'schema', 'triplekeel.signal.v1', 'track', 'product-manager', 'app', 'claude',
  'source', 'live', 'hour', '2026-11-15T09:00Z', 'length_bucket', '200-500',
  'answers', (select jsonb_agg(jsonb_build_object('q', id, 'a', 'yes', 'p', 0.5) order by id) from public.questions where track_id = 'product-manager')
) as report;
grant select on full_report to public;

select is(
  public.write_device_signals(repeat('d', 64), (select jsonb_build_array(report) from full_report)),
  1,
  'a report that answers all 25 PM questions is stored'
);
select is(
  (select jsonb_array_length(answers) from public.signals where user_id = 'clerk_user_catalog'),
  25,
  'all 25 answers are kept'
);
select throws_ok(
  $$select public.write_device_signals(repeat('d', 64), (select jsonb_build_array(jsonb_set(report, '{answers}', '[{"q":"not_a_question","a":"yes","p":0.5}]')) from full_report))$$,
  'P0001', 'invalid_report', 'an unknown question ID is rejected'
);
select throws_ok(
  $$select public.write_device_signals(repeat('d', 64), (select jsonb_build_array(jsonb_set(report, '{answers}', (report->'answers') || '[{"q":"target_user","a":"no","p":0.5}]')) from full_report))$$,
  'P0001', 'invalid_report', 'more answers than the track has questions is rejected'
);

-- The sync is idempotent and never deletes.
create temporary table catalog_input as
select jsonb_build_object('tracks', jsonb_build_array(jsonb_build_object(
  'id', t.id, 'name', t.name, 'alt_titles', to_jsonb(t.alt_titles),
  'areas', (select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'thresholds', a.thresholds, 'junior_description', a.junior_description, 'mid_description', a.mid_description, 'senior_description', a.senior_description, 'exa_queries', a.exa_queries)) from public.skill_areas a where a.track_id = t.id),
  'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'area_id', q.area_id, 'question_text', q.question_text, 'polarity', q.polarity, 'answers', to_jsonb(q.answers))) from public.questions q where q.track_id = t.id)
))) as catalog
from public.tracks t where t.id = 'product-manager';

select is(
  public.sync_track_catalog((select catalog from catalog_input)),
  '{"tracks": 1, "skill_areas": 11, "questions": 25}'::jsonb,
  'first sync reports the catalog size'
);
select is(
  public.sync_track_catalog((select catalog from catalog_input)),
  '{"tracks": 1, "skill_areas": 11, "questions": 25}'::jsonb,
  'second sync reports the same size'
);
select is(
  (select array[(select count(*) from public.tracks), (select count(*) from public.skill_areas), (select count(*) from public.questions)]::int[]),
  array[1, 11, 25],
  'running the sync twice leaves the same row counts'
);

select public.sync_track_catalog(jsonb_set(
  (select catalog from catalog_input), '{tracks,0,questions}',
  (select jsonb_agg(case when q->>'id' = 'problem' then jsonb_set(q, '{question_text}', '"New wording?"') else q end)
   from jsonb_array_elements((select catalog from catalog_input)->'tracks'->0->'questions') as q
   where q->>'id' <> 'agent_workflow')
));
select is((select question_text from public.questions where id = 'problem'), 'New wording?', 'sync updates changed question text');

select public.sync_track_catalog(jsonb_set(
  (select catalog from catalog_input), '{tracks,0,areas}',
  (select jsonb_agg(case when a->>'id' = 'specs' then jsonb_set(a, '{thresholds}', '{"junior": 0, "mid": 1.5, "senior": 2.5}') else a end)
   from jsonb_array_elements((select catalog from catalog_input)->'tracks'->0->'areas') as a)
));
select is(
  (select thresholds from public.skill_areas where id = 'specs'),
  '{"junior": 0, "mid": 1.5, "senior": 2.5}'::jsonb,
  'sync updates changed thresholds'
);
select throws_ok(
  $$select public.sync_track_catalog(jsonb_set((select catalog from catalog_input), '{tracks,0,areas,0}', ((select catalog from catalog_input)->'tracks'->0->'areas'->0) - 'thresholds'))$$,
  'P0001', 'invalid_catalog', 'an area without thresholds is rejected'
);
select throws_ok(
  $$select public.sync_track_catalog(jsonb_set((select catalog from catalog_input), '{tracks,0,areas,0,thresholds}', '{"junior": 0, "mid": 2, "senior": 1}'))$$,
  '23514', null, 'thresholds that do not increase are rejected'
);
select ok(exists (select 1 from public.questions where id = 'agent_workflow'), 'sync never deletes a question missing from the files');

insert into public.tracks (id, name) values ('other-track', 'Other');
select throws_ok(
  $$select public.sync_track_catalog(jsonb_build_object('tracks', jsonb_build_array(jsonb_build_object('id', 'other-track', 'name', 'Other', 'alt_titles', '[]'::jsonb, 'areas', '[]'::jsonb, 'questions', '[{"id":"problem","area_id":"problem_discovery","question_text":"x","polarity":"good","answers":["yes","partly","no","n/a"]}]'::jsonb))))$$,
  'P0001', 'catalog_question_in_other_track', 'sync will not move a question to another track'
);

-- Only service_role can run the sync.
select ok(has_function_privilege('service_role', 'public.sync_track_catalog(jsonb)', 'execute'), 'service_role can execute sync_track_catalog');
select ok(
  not has_function_privilege('anon', 'public.sync_track_catalog(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.sync_track_catalog(jsonb)', 'execute'),
  'anon and authenticated cannot execute sync_track_catalog'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.sync_track_catalog(jsonb)'::regprocedure),
  'sync_track_catalog is security definer with an empty search_path'
);

select * from finish();
rollback;

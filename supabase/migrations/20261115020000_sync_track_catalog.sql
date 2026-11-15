-- REI-311: the database catalog follows tracks/.
--
-- 1. Reports may carry one answer per question in their track. The PM track
--    has 25 questions, but signals and write_device_signals capped answers at
--    16, so valid reports failed with invalid_report.
-- 2. public.sync_track_catalog(p_catalog) upserts tracks, skill areas and
--    questions from tracks/. seed.sql calls it locally, and the deploy job
--    calls it in production with the service-role key
--    (scripts/sync-catalog.mts).

-- 1a. The table keeps a hard ceiling. write_device_signals checks the real
-- limit: the number of questions in the report's track. parseReport() allows
-- at most QUESTION_IDS.length answers, and a test keeps that at or under 100.
alter table public.signals drop constraint signals_answers_check;
alter table public.signals add constraint signals_answers_check
  check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 1 and 100);

-- 1b. Same function as before, with the answer limit taken from the track.
-- It keeps every error message /api/signals maps.
create or replace function public.write_device_signals(p_token_hash text, p_reports jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.devices%rowtype;
  v_report jsonb;
  v_answers jsonb;
  v_hour timestamptz;
  v_inserted integer := 0;
  v_row_count integer;
  v_batch_size integer;
  v_max_answers integer;
begin
  select * into v_device
  from public.devices
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'device_not_found';
  end if;
  if v_device.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'device_revoked';
  end if;
  if p_reports is null or jsonb_typeof(p_reports) <> 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_batch';
  end if;
  v_batch_size := pg_catalog.jsonb_array_length(p_reports);
  if v_batch_size < 1 or v_batch_size > 50 then
    raise exception using errcode = 'P0001', message = 'invalid_batch';
  end if;
  if pg_catalog.date_trunc('minute', pg_catalog.now()) > v_device.rate_window_started_at then
    v_device.rate_window_started_at := pg_catalog.date_trunc('minute', pg_catalog.now());
    v_device.rate_window_reports := 0;
  end if;
  if v_device.rate_window_reports + v_batch_size > 50 then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  for v_report in select value from pg_catalog.jsonb_array_elements(p_reports)
  loop
    if pg_catalog.jsonb_typeof(v_report) is distinct from 'object' then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if (v_report - array['schema','track','app','source','hour','length_bucket','answers','import_key']) <> '{}'::jsonb
      or not (v_report ?& array['schema','track','app','source','hour','length_bucket','answers'])
      or v_report->>'schema' is distinct from 'triplekeel.signal.v1'
      or not exists (select 1 from public.tracks where id = v_report->>'track')
      or not coalesce(v_report->>'app' = any(array['chatgpt', 'claude', 'other']), false)
      or not coalesce(v_report->>'source' = any(array['live', 'import', 'paste']), false)
      or not coalesce(v_report->>'length_bucket' = any(array['0-50','50-200','200-500','500-1000','1000-2000','2000-5000','5000+']), false)
      or pg_catalog.jsonb_typeof(v_report->'hour') <> 'string'
      or (v_report ? 'import_key' and (pg_catalog.jsonb_typeof(v_report->'import_key') <> 'string' or coalesce(v_report->>'import_key' !~ '^[0-9a-f]{64}$', true) or v_report->>'source' <> 'import'))
      or (v_report->>'source' = 'import' and not (v_report ? 'import_key'))
      or (v_report->>'source' = 'paste' and v_report ? 'import_key') then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    -- At most one answer per question in the track, and never over the
    -- table's ceiling of 100.
    select least(pg_catalog.count(*), 100)::integer into v_max_answers
    from public.questions
    where track_id = v_report->>'track';
    if pg_catalog.jsonb_typeof(v_report->'answers') is distinct from 'array'
      or pg_catalog.jsonb_array_length(case when pg_catalog.jsonb_typeof(v_report->'answers') = 'array' then v_report->'answers' else '[]'::jsonb end) not between 1 and v_max_answers then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    begin
      if v_report->>'hour' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:00Z$' then
        raise;
      end if;
      v_hour := (v_report->>'hour')::timestamptz;
      if pg_catalog.to_char(v_hour at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') <> v_report->>'hour' then
        raise;
      end if;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end;
    v_answers := v_report->'answers';
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_answers) as answer(value)
      where pg_catalog.jsonb_typeof(value) is distinct from 'object'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_answers) as answer(value)
      where pg_catalog.jsonb_typeof(value->'p') is distinct from 'number'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_answers) as answer(value)
      where pg_catalog.jsonb_typeof(value) <> 'object'
        or (value - array['q','a','p']) <> '{}'::jsonb
        or not (value ?& array['q','a','p'])
        or not exists (select 1 from public.questions where id = value->>'q' and track_id = v_report->>'track')
        or not coalesce(value->>'a' = any(array['yes','partly','no','n/a']), false)
        or (value->>'p')::numeric < 0 or (value->>'p')::numeric > 1
        or pg_catalog.round((value->>'p')::numeric, 2) <> (value->>'p')::numeric
    ) or (select pg_catalog.count(distinct value->>'q') from pg_catalog.jsonb_array_elements(v_answers) as answer(value)) <> pg_catalog.jsonb_array_length(v_answers) then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;

    insert into public.signals (user_id, track_id, app, source, hour, length_bucket, answers, import_key)
    values (v_device.user_id, v_report->>'track', v_report->>'app', v_report->>'source', v_hour, v_report->>'length_bucket', v_answers, v_report->>'import_key')
    on conflict (user_id, import_key) do nothing;
    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
  end loop;

  update public.devices
  set rate_window_started_at = v_device.rate_window_started_at,
      rate_window_reports = v_device.rate_window_reports + v_batch_size
  where id = v_device.id;
  return v_inserted;
end;
$$;

revoke all on function public.write_device_signals(text, jsonb) from public, authenticated, service_role;
grant execute on function public.write_device_signals(text, jsonb) to anon;

-- 2. Upserts the catalog built from tracks/ (packages/schema/src/catalog.ts):
--   {"tracks": [{"id", "name", "alt_titles",
--     "areas": [{"id", "name", "junior_description", "mid_description",
--                "senior_description", "exa_queries"}],
--     "questions": [{"id", "area_id", "question_text", "polarity", "answers"}]}]}
--
-- Safe to run again: it only inserts and updates. It never deletes, because
-- stored signals name question IDs and levels reference skill areas. An area
-- or question that belongs to another track is an error, not a silent move.
create function public.sync_track_catalog(p_catalog jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track jsonb;
  v_tracks integer := 0;
  v_areas integer := 0;
  v_questions integer := 0;
  v_conflict text;
begin
  if p_catalog is null
    or pg_catalog.jsonb_typeof(p_catalog->'tracks') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_catalog->'tracks') < 1 then
    raise exception using errcode = 'P0001', message = 'invalid_catalog';
  end if;

  for v_track in select value from pg_catalog.jsonb_array_elements(p_catalog->'tracks')
  loop
    if pg_catalog.jsonb_typeof(v_track->'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_track->'name') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_track->'alt_titles') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_track->'areas') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_track->'questions') is distinct from 'array' then
      raise exception using errcode = 'P0001', message = 'invalid_catalog';
    end if;

    select a.id into v_conflict
    from pg_catalog.jsonb_array_elements(v_track->'areas') as e(value)
    join public.skill_areas a on a.id = e.value->>'id'
    where a.track_id <> v_track->>'id'
    limit 1;
    if found then
      raise exception using errcode = 'P0001', message = 'catalog_area_in_other_track',
        detail = v_conflict;
    end if;
    select q.id into v_conflict
    from pg_catalog.jsonb_array_elements(v_track->'questions') as e(value)
    join public.questions q on q.id = e.value->>'id'
    where q.track_id <> v_track->>'id'
    limit 1;
    if found then
      raise exception using errcode = 'P0001', message = 'catalog_question_in_other_track',
        detail = v_conflict;
    end if;

    insert into public.tracks (id, name, alt_titles)
    values (
      v_track->>'id',
      v_track->>'name',
      array(select pg_catalog.jsonb_array_elements_text(v_track->'alt_titles'))
    )
    on conflict (id) do update
      set name = excluded.name, alt_titles = excluded.alt_titles;
    v_tracks := v_tracks + 1;

    insert into public.skill_areas (id, track_id, name, junior_description, mid_description, senior_description, exa_queries)
    select e.value->>'id', v_track->>'id', e.value->>'name',
      e.value->>'junior_description', e.value->>'mid_description',
      e.value->>'senior_description', e.value->'exa_queries'
    from pg_catalog.jsonb_array_elements(v_track->'areas') as e(value)
    on conflict (id) do update
      set name = excluded.name,
        junior_description = excluded.junior_description,
        mid_description = excluded.mid_description,
        senior_description = excluded.senior_description,
        exa_queries = excluded.exa_queries;
    v_areas := v_areas + pg_catalog.jsonb_array_length(v_track->'areas');

    insert into public.questions (id, track_id, area_id, question_text, polarity, answers)
    select e.value->>'id', v_track->>'id', e.value->>'area_id',
      e.value->>'question_text', e.value->>'polarity',
      array(select pg_catalog.jsonb_array_elements_text(e.value->'answers'))
    from pg_catalog.jsonb_array_elements(v_track->'questions') as e(value)
    on conflict (id) do update
      set area_id = excluded.area_id,
        question_text = excluded.question_text,
        polarity = excluded.polarity,
        answers = excluded.answers;
    v_questions := v_questions + pg_catalog.jsonb_array_length(v_track->'questions');
  end loop;

  return pg_catalog.jsonb_build_object('tracks', v_tracks, 'skill_areas', v_areas, 'questions', v_questions);
end;
$$;

-- Only the deploy job's service-role key runs the sync. Revoke first, so the
-- result is the same locally (where default privileges apply) and in
-- production (where new functions get no grants). The function is security
-- definer, so service_role needs no table privileges.
revoke all on function public.sync_track_catalog(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sync_track_catalog(jsonb) to service_role;

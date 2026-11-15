-- REI-270: levels and gaps from a user's stored reports.
--
-- public.recompute_user_levels(user_id) turns the user's signals into one
-- public.levels row per skill area. write_device_signals calls it at the end
-- of every batch, in the same transaction, so /api/signals keeps using only
-- the anon key (ADR-0006). public.read_level_gaps() is the read path for the
-- signed-in user.
--
-- The method (v1, simple and explainable):
--
-- 1. Answer score s: yes = 1, partly = 0.5, no = 0. n/a is skipped. For a
--    polarity 'bad' question, s = 1 - s.
-- 2. Answer weight w = p * 0.5 ^ (age_days / 30). age_days is the time from
--    the report's hour to the user's newest report hour (capped at the
--    current hour, never negative, at most 100 half-lives). A weighted
--    average only depends on the ratio of weights, so measuring age from the
--    newest report gives the same scores as measuring from now, and the
--    result doesn't drift between batches. Every source (live, import,
--    paste) counts the same.
-- 3. Per area, over every answer to the area's questions in the user's
--    reports:
--      score      = round(3 * sum(w * s) / sum(w), 4), on a 0-3 scale
--      spread     = sqrt(sum(w * s^2) / sum(w) - (sum(w * s) / sum(w))^2),
--                   the weighted standard deviation of s, between 0 and 0.5
--      n_prompts  = number of reports with at least one non-n/a answer in
--                   the area
--      level      = the highest level whose threshold is at or below score,
--                   using skill_areas.thresholds from the track file. Below
--                   the junior threshold is still junior.
--      confidence = round(n_prompts / (n_prompts + 5) * (1 - spread), 3)
--    With the PM thresholds { junior: 0, mid: 1, senior: 2 }: score < 1 is
--    junior, 1 to 2 is mid, 2 and up is senior.
-- 4. Under 5 prompts in an area, or when every weight is 0 (all p = 0), the
--    area has no row: "not enough evidence yet" is the absence of a row.
-- 5. Gap = target level - current level, when positive, else 0, with
--    junior < mid < senior one step apart. read_level_gaps ranks by gap.
--
-- The constants live at the top of recompute_user_levels. To tune them, add
-- a migration that replaces the function. Thresholds are tuned in the track
-- files and reach the database through sync_track_catalog.

-- 1. Thresholds on skill_areas, filled by the catalog sync. Existing rows get
-- the values every current track file uses. The sync sets them on deploy.
alter table public.skill_areas
  add column thresholds jsonb not null default '{"junior": 0, "mid": 1, "senior": 2}'::jsonb;
alter table public.skill_areas alter column thresholds drop default;
alter table public.skill_areas add constraint skill_areas_thresholds_valid check (
  case
    when jsonb_typeof(thresholds) = 'object'
      and (thresholds - array['junior', 'mid', 'senior']) = '{}'::jsonb
      and jsonb_typeof(thresholds -> 'junior') = 'number'
      and jsonb_typeof(thresholds -> 'mid') = 'number'
      and jsonb_typeof(thresholds -> 'senior') = 'number'
    then (thresholds ->> 'junior')::numeric >= 0
      and (thresholds ->> 'junior')::numeric < (thresholds ->> 'mid')::numeric
      and (thresholds ->> 'mid')::numeric < (thresholds ->> 'senior')::numeric
      and (thresholds ->> 'senior')::numeric <= 3
    else false
  end
);

-- 2. The same catalog sync as REI-311, now with thresholds. Each area must
-- carry a thresholds object; the table constraint checks its values.
create or replace function public.sync_track_catalog(p_catalog jsonb)
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
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_track->'areas') as e(value)
      where pg_catalog.jsonb_typeof(e.value->'thresholds') is distinct from 'object'
    ) then
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

    insert into public.skill_areas (id, track_id, name, thresholds, junior_description, mid_description, senior_description, exa_queries)
    select e.value->>'id', v_track->>'id', e.value->>'name', e.value->'thresholds',
      e.value->>'junior_description', e.value->>'mid_description',
      e.value->>'senior_description', e.value->'exa_queries'
    from pg_catalog.jsonb_array_elements(v_track->'areas') as e(value)
    on conflict (id) do update
      set name = excluded.name,
        thresholds = excluded.thresholds,
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

revoke all on function public.sync_track_catalog(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sync_track_catalog(jsonb) to service_role;

-- 3. levels keeps the area score next to the level, on the 0-3 scale, so the
-- dashboard can show progress inside a level and gaps can be ranked within a
-- step. levels is derived data and nothing wrote it before this migration;
-- step 7 rebuilds it from signals.
delete from public.levels;
alter table public.levels
  add column score numeric not null constraint levels_score_range check (score between 0 and 3);

-- Row level security and levels_select_own still apply. State the grants
-- again so the new column is covered explicitly: signed-in users read their
-- own rows, and only the security definer functions write.
revoke all on public.levels from public, anon, authenticated, service_role;
grant select on public.levels to authenticated;

-- 4. Recomputes every level of one user from their signals. See the method
-- at the top of this file.
create function public.recompute_user_levels(p_user_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Tuning knobs (REI-270 v1).
  c_half_life_days constant double precision := 30;
  c_max_half_lives constant double precision := 100;
  c_min_prompts constant integer := 5;
  c_confidence_prompts constant numeric := 5;
begin
  if p_user_id is null then
    return;
  end if;
  -- One recompute per user at a time, so two devices sending at once can't
  -- store a result that misses the other's reports.
  perform pg_catalog.pg_advisory_xact_lock(270, pg_catalog.hashtext(p_user_id));

  with reference as (
    select least(pg_catalog.max(s.hour), pg_catalog.date_trunc('hour', pg_catalog.now())) as newest_hour
    from public.signals s
    where s.user_id = p_user_id
  ),
  scored_answers as (
    select q.area_id, s.id as signal_id,
      case when q.polarity = 'bad' then 1 - v.raw else v.raw end as answer_score,
      (a.value->>'p')::double precision * pg_catalog.power(
        0.5::double precision,
        least(
          greatest(extract(epoch from (r.newest_hour - s.hour))::double precision, 0) / 86400 / c_half_life_days,
          c_max_half_lives
        )
      ) as weight
    from public.signals s
    cross join reference r
    cross join lateral pg_catalog.jsonb_array_elements(s.answers) as a(value)
    cross join lateral (
      select case a.value->>'a'
        when 'yes' then 1::double precision
        when 'partly' then 0.5::double precision
        when 'no' then 0::double precision
      end as raw
    ) v
    join public.questions q on q.id = a.value->>'q' and q.track_id = s.track_id
    where s.user_id = p_user_id
      and v.raw is not null
  ),
  areas as (
    select x.area_id,
      pg_catalog.count(distinct x.signal_id)::integer as n_prompts,
      pg_catalog.sum(x.weight) as sw,
      pg_catalog.sum(x.weight * x.answer_score) as sws,
      pg_catalog.sum(x.weight * x.answer_score * x.answer_score) as swss
    from scored_answers x
    group by x.area_id
  ),
  scored as (
    select g.area_id, g.n_prompts,
      pg_catalog.round((3 * g.sws / g.sw)::numeric, 4) as score,
      pg_catalog.sqrt(greatest(g.swss / g.sw - (g.sws / g.sw) * (g.sws / g.sw), 0)) as spread
    from areas g
    where g.n_prompts >= c_min_prompts and g.sw > 0
  ),
  leveled as (
    select x.area_id,
      case
        when x.score >= (sa.thresholds->>'senior')::numeric then 'senior'
        when x.score >= (sa.thresholds->>'mid')::numeric then 'mid'
        else 'junior'
      end as level,
      pg_catalog.round(x.n_prompts / (x.n_prompts + c_confidence_prompts) * (1 - x.spread::numeric), 3) as confidence,
      x.n_prompts,
      x.score
    from scored x
    join public.skill_areas sa on sa.id = x.area_id
  ),
  removed as (
    delete from public.levels l
    where l.user_id = p_user_id
      and not exists (select 1 from leveled x where x.area_id = l.area_id)
  )
  insert into public.levels as l (user_id, area_id, level, confidence, n_prompts, score, updated_at)
  select p_user_id, x.area_id, x.level, x.confidence, x.n_prompts, x.score, pg_catalog.now()
  from leveled x
  on conflict (user_id, area_id) do update
    set level = excluded.level,
      confidence = excluded.confidence,
      n_prompts = excluded.n_prompts,
      score = excluded.score,
      updated_at = excluded.updated_at
    where (l.level, l.confidence, l.n_prompts, l.score)
      is distinct from (excluded.level, excluded.confidence, excluded.n_prompts, excluded.score);
end;
$$;

-- No client role runs it. write_device_signals, owned by the same role,
-- calls it. Revoke first, so local and production end up the same.
revoke all on function public.recompute_user_levels(text) from public, anon, authenticated, service_role;

-- 5. The device write from REI-311, unchanged except that it recomputes the
-- user's levels after the batch. It keeps every error message /api/signals
-- maps.
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

  -- REI-270: levels follow the reports, in this transaction. Levels are
  -- derived data, so a failure here never loses the batch: the reports are
  -- kept, the log gets only the error code, and the next batch recomputes.
  begin
    perform public.recompute_user_levels(v_device.user_id);
  exception when others then
    raise warning using message = 'recompute_user_levels failed', detail = sqlstate;
  end;
  return v_inserted;
end;
$$;

revoke all on function public.write_device_signals(text, jsonb) from public, authenticated, service_role;
grant execute on function public.write_device_signals(text, jsonb) to anon;

-- 6. The signed-in user's levels and gaps, one row per skill area of their
-- profile's track, ranked: biggest gap first, then the lowest score, then
-- area ID. Areas under the evidence minimum come last with a null level,
-- gap, score, confidence and n_prompts. gap is null when the level or the
-- target is unknown, and 0 at or above the target.
--
-- Security invoker: row level security on profiles and levels limits it to
-- the caller's own rows.
create function public.read_level_gaps()
returns table (
  rank integer,
  area_id text,
  area_name text,
  level text,
  target_level text,
  gap integer,
  score numeric,
  confidence numeric,
  n_prompts integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select p.user_id, p.track_id, p.target_level
    from public.profiles p
    where p.user_id = (select auth.jwt() ->> 'sub')
  ),
  area_levels as (
    select a.id as area_id, a.name as area_name, l.level, me.target_level,
      case
        when l.level is null or me.target_level is null then null
        else greatest(
          pg_catalog.array_position(array['junior', 'mid', 'senior'], me.target_level)
            - pg_catalog.array_position(array['junior', 'mid', 'senior'], l.level),
          0
        )
      end as gap,
      l.score, l.confidence, l.n_prompts
    from me
    join public.skill_areas a on a.track_id = me.track_id
    left join public.levels l on l.user_id = me.user_id and l.area_id = a.id
  )
  select
    (pg_catalog.row_number() over (order by x.gap desc nulls last, x.score asc nulls last, x.area_id))::integer,
    x.area_id, x.area_name, x.level, x.target_level, x.gap, x.score, x.confidence, x.n_prompts
  from area_levels x
  order by 1;
$$;

-- Only signed-in users. Revoke first: production gives new functions no
-- grants, and local defaults would otherwise let anon run it.
revoke all on function public.read_level_gaps() from public, anon, authenticated, service_role;
grant execute on function public.read_level_gaps() to authenticated;

-- 7. Rebuild levels for everyone who already has reports.
select public.recompute_user_levels(u.user_id)
from (select distinct s.user_id from public.signals s) u;

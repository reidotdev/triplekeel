-- REI-279: the keel check card.
--
-- public.build_keel_check() builds the signed-in user's card from their
-- reports, levels and the day's picks, stores it in public.nudges and returns
-- it. POST /api/keel-check calls it with the Clerk session token. It is
-- deterministic: no model calls, only counts and stored picks.
--
-- A card has up to three items, in this order:
--
--   keep  The good question the user answers "yes" to most often.
--         A `practice` pick for its area confirms it's current practice.
--   stop  The anti-pattern (polarity bad) the user hits most often. For bad
--         questions "yes" means the anti-pattern happened. A `mistake` pick
--         for its area says what to do instead.
--   test  One new practice for the biggest gap toward the target level.
--         A `practice` pick for that area.
--
-- The rules (v1):
--
-- 1. Window: the user's 20 newest reports on their profile's track, newest
--    report hour first. A question's counts are its yes, partly and no
--    answers in the window. n/a and missing answers don't count. `answered`
--    is yes + partly + no.
-- 2. Keep: polarity good, at least 5 answered, and yes in at least half of
--    them. Stop: polarity bad, at least 5 answered, at least 2 yes, and yes
--    in at least a fifth of them. Only "yes" counts toward the share;
--    "partly" is stored so the card can mention it. Ties go to more yes
--    answers, then the question ID.
-- 3. Test: the user's areas with a level, ranked like read_level_gaps():
--    biggest gap first, then the lowest score, then the area ID. With no
--    positive gap (at the target, or no target set), that is the lowest-score
--    area. A user without any level yet (under 5 prompts per area) gets the
--    area with the lowest average answer score in the window (yes 1,
--    partly 0.5, no 0, inverted for bad questions). No reports, no Test.
-- 4. Picks: from the user's track, published in the last 90 days. A podcast
--    pick wins over a web pick, then the newest. Test chooses first, and one
--    pick appears at most once per card, so Keep takes the next pick when
--    both land on the same area.
-- 5. Not enough evidence, or no good pick for the area: the item is left
--    out. It is never filled with a weaker question or another area. A card
--    can have no items; it is still stored.
-- 6. At most 10 builds per user per UTC day. The 11th raises
--    keel_check_limit, which the route maps to 429.
--
-- Items store counts and IDs, not sentences, so the UI can phrase them. The
-- pick is copied into the item, because the daily job replaces picks and the
-- card must keep its source. Each item has a `status`, "open" when built.
-- REI-283 updates it through a new security definer function; the item's
-- `kind` is unique per card, so (nudge id, kind) names one item.
--
-- The constants live at the top of build_keel_check_for. To tune them, add
-- a migration that replaces the function.

-- 1. A short card label per question, from questions.yaml (card_label). It
-- completes "You ___ in 14 of your last 20 prompts".
alter table public.questions
  add column card_label text
  constraint questions_card_label_valid
    check (card_label is null or (length(card_label) between 1 and 80 and card_label !~ '[\r\n]'));

-- Row level security and questions_select_all still apply. State the grants
-- again so the new column is covered explicitly in every environment.
revoke all on public.questions from public, anon, authenticated, service_role;
grant select on public.questions to anon, authenticated;

-- 2. The catalog sync from REI-270, now with card labels. card_label is
-- optional in the payload and may be null; anything else is invalid_catalog.
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
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_track->'questions') as e(value)
      where e.value ? 'card_label'
        and pg_catalog.jsonb_typeof(e.value->'card_label') not in ('string', 'null')
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

    insert into public.questions (id, track_id, area_id, question_text, card_label, polarity, answers)
    select e.value->>'id', v_track->>'id', e.value->>'area_id',
      e.value->>'question_text', e.value->>'card_label', e.value->>'polarity',
      array(select pg_catalog.jsonb_array_elements_text(e.value->'answers'))
    from pg_catalog.jsonb_array_elements(v_track->'questions') as e(value)
    on conflict (id) do update
      set area_id = excluded.area_id,
        question_text = excluded.question_text,
        card_label = excluded.card_label,
        polarity = excluded.polarity,
        answers = excluded.answers;
    v_questions := v_questions + pg_catalog.jsonb_array_length(v_track->'questions');
  end loop;

  return pg_catalog.jsonb_build_object('tracks', v_tracks, 'skill_areas', v_areas, 'questions', v_questions);
end;
$$;

revoke all on function public.sync_track_catalog(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.sync_track_catalog(jsonb) to service_role;

-- 3. Stored cards. Only build_keel_check writes them.
create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(user_id) between 1 and 200),
  track_id text not null references public.tracks(id),
  created_at timestamptz not null default now(),
  items jsonb not null constraint nudges_items_valid check (
    case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) <= 3 else false end
  )
);

-- The latest card and the daily cap both read by user, newest first.
create index nudges_user_created_at_idx on public.nudges (user_id, created_at desc);

alter table public.nudges enable row level security;
create policy nudges_select_own on public.nudges for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- Revoke first, so the result is the same locally (where default privileges
-- apply) and in production (where new tables get no grants). Signed-in users
-- read their own cards. Nobody writes them directly.
revoke all on public.nudges from public, anon, authenticated, service_role;
grant select on public.nudges to authenticated;

-- 4. Builds, stores and returns one user's card. See the rules at the top of
-- this file. Returns:
--   {"id", "track_id", "created_at", "items": [{
--      "kind": "keep" | "stop" | "test", "status": "open",
--      "area_id", "area_name",
--      "question_id", "card_label",      -- null for test
--      "counts": keep/stop {"yes", "partly", "no", "answered", "window"}
--                test      {"prompts", "window"},
--      "level": test only, null without a level:
--                {"level", "target_level", "gap", "score"},
--      "pick_id",
--      "pick": {"title", "url", "publisher", "published_at",
--               "podcast_timestamp_seconds", "source", "why_line"}}]}
-- Raises P0001 with not_authenticated, profile_incomplete (no track yet) or
-- keel_check_limit.
--
-- No client role runs it. build_keel_check() passes the signed-in user. A
-- device-token variant for the extension (REI-282) or a weekly job can call
-- it the same way.
create function public.build_keel_check_for(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Tuning knobs (REI-279 v1).
  c_window constant integer := 20;
  c_min_answered constant integer := 5;
  c_keep_min_share constant numeric := 0.5;
  c_stop_min_share constant numeric := 0.2;
  c_stop_min_yes constant integer := 2;
  c_pick_max_age constant interval := interval '90 days';
  c_daily_cap constant integer := 10;
  v_track_id text;
  v_target text;
  v_window uuid[];
  v_test jsonb;
  v_candidates jsonb;
  v_candidate jsonb;
  v_pick jsonb;
  v_pick_id uuid;
  v_used uuid[] := '{}';
  v_items jsonb := '[]'::jsonb;
  v_nudge public.nudges%rowtype;
begin
  if p_user_id is null or pg_catalog.length(p_user_id) not between 1 and 200 then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  -- One build per user at a time, so parallel requests can't pass the cap.
  perform pg_catalog.pg_advisory_xact_lock(279, pg_catalog.hashtext(p_user_id));

  select p.track_id, p.target_level into v_track_id, v_target
  from public.profiles p
  where p.user_id = p_user_id;
  if v_track_id is null then
    raise exception using errcode = 'P0001', message = 'profile_incomplete';
  end if;

  if (
    select pg_catalog.count(*) from public.nudges n
    where n.user_id = p_user_id
      and n.created_at >= pg_catalog.date_trunc('day', pg_catalog.now(), 'UTC')
  ) >= c_daily_cap then
    raise exception using errcode = 'P0001', message = 'keel_check_limit';
  end if;

  v_window := array(
    select s.id
    from public.signals s
    where s.user_id = p_user_id and s.track_id = v_track_id
    order by s.hour desc, s.created_at desc, s.id desc
    limit c_window
  );

  -- Keep and Stop: the top good and the top bad question in the window.
  with answers as (
    select q.id as question_id, q.area_id, q.polarity, q.card_label, a.value->>'a' as answer
    from public.signals s
    cross join lateral pg_catalog.jsonb_array_elements(s.answers) as a(value)
    join public.questions q on q.id = a.value->>'q' and q.track_id = v_track_id
    where s.id = any(v_window)
  ),
  stats as (
    select x.question_id, x.area_id, x.polarity, x.card_label,
      (pg_catalog.count(*) filter (where x.answer = 'yes'))::integer as n_yes,
      (pg_catalog.count(*) filter (where x.answer = 'partly'))::integer as n_partly,
      (pg_catalog.count(*) filter (where x.answer = 'no'))::integer as n_no,
      (pg_catalog.count(*) filter (where x.answer in ('yes', 'partly', 'no')))::integer as n_answered
    from answers x
    group by x.question_id, x.area_id, x.polarity, x.card_label
  ),
  best as (
    select distinct on (st.polarity) st.*
    from stats st
    where st.n_answered >= c_min_answered
      and case st.polarity
        when 'good' then st.n_yes >= c_keep_min_share * st.n_answered
        else st.n_yes >= c_stop_min_yes and st.n_yes >= c_stop_min_share * st.n_answered
      end
    order by st.polarity, st.n_yes::numeric / st.n_answered desc, st.n_yes desc, st.question_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'kind', case t.polarity when 'good' then 'keep' else 'stop' end,
      'pick_kind', case t.polarity when 'good' then 'practice' else 'mistake' end,
      'area_id', t.area_id,
      'question_id', t.question_id,
      'card_label', t.card_label,
      'counts', pg_catalog.jsonb_build_object(
        'yes', t.n_yes, 'partly', t.n_partly, 'no', t.n_no,
        'answered', t.n_answered, 'window', pg_catalog.cardinality(v_window)
      ),
      'level', null
    ) order by t.polarity desc), '[]'::jsonb)
  into v_candidates
  from best t;

  -- Test: the biggest gap, ranked like read_level_gaps().
  select pg_catalog.jsonb_build_object(
      'kind', 'test', 'pick_kind', 'practice', 'area_id', g.area_id,
      'question_id', null, 'card_label', null,
      'level', pg_catalog.jsonb_build_object(
        'level', g.level, 'target_level', v_target, 'gap', g.gap, 'score', g.score
      )
    )
  into v_test
  from (
    select a.id as area_id, l.level, l.score,
      case
        when v_target is null then null
        else greatest(
          pg_catalog.array_position(array['junior', 'mid', 'senior'], v_target)
            - pg_catalog.array_position(array['junior', 'mid', 'senior'], l.level),
          0
        )
      end as gap
    from public.skill_areas a
    join public.levels l on l.user_id = p_user_id and l.area_id = a.id
    where a.track_id = v_track_id
  ) g
  order by g.gap desc nulls last, g.score asc, g.area_id
  limit 1;

  -- No level yet: the weakest area in the window.
  if v_test is null then
    select pg_catalog.jsonb_build_object(
        'kind', 'test', 'pick_kind', 'practice', 'area_id', w.area_id,
        'question_id', null, 'card_label', null, 'level', null
      )
    into v_test
    from (
      select q.area_id,
        pg_catalog.avg(case when q.polarity = 'bad' then 1 - v.raw else v.raw end) as score
      from public.signals s
      cross join lateral pg_catalog.jsonb_array_elements(s.answers) as a(value)
      cross join lateral (
        select case a.value->>'a'
          when 'yes' then 1::numeric
          when 'partly' then 0.5::numeric
          when 'no' then 0::numeric
        end as raw
      ) v
      join public.questions q on q.id = a.value->>'q' and q.track_id = v_track_id
      where s.id = any(v_window) and v.raw is not null
      group by q.area_id
    ) w
    order by w.score asc, w.area_id
    limit 1;
  end if;

  if v_test is not null then
    v_test := v_test || pg_catalog.jsonb_build_object('counts', pg_catalog.jsonb_build_object(
      'prompts', (
        select pg_catalog.count(distinct s.id)::integer
        from public.signals s
        cross join lateral pg_catalog.jsonb_array_elements(s.answers) as a(value)
        join public.questions q on q.id = a.value->>'q' and q.track_id = v_track_id
        where s.id = any(v_window)
          and q.area_id = v_test->>'area_id'
          and a.value->>'a' in ('yes', 'partly', 'no')
      ),
      'window', pg_catalog.cardinality(v_window)
    ));
    -- Test chooses its pick first.
    v_candidates := pg_catalog.jsonb_build_array(v_test) || v_candidates;
  end if;

  for v_candidate in select e.value from pg_catalog.jsonb_array_elements(v_candidates) as e(value)
  loop
    select p.id, pg_catalog.jsonb_build_object(
        'title', p.title, 'url', p.url, 'publisher', p.publisher,
        'published_at', p.published_at,
        'podcast_timestamp_seconds', p.podcast_timestamp_seconds,
        'source', p.source, 'why_line', p.why_line
      )
    into v_pick_id, v_pick
    from public.picks p
    where p.track_id = v_track_id
      and p.area_id = v_candidate->>'area_id'
      and p.kind = v_candidate->>'pick_kind'
      and p.published_at >= pg_catalog.now() - c_pick_max_age
      and p.id <> all(v_used)
    order by (p.source = 'podcast') desc, p.published_at desc, p.id
    limit 1;

    if v_pick_id is not null then
      v_used := v_used || v_pick_id;
      v_items := v_items || pg_catalog.jsonb_build_array(
        (v_candidate - 'pick_kind') || pg_catalog.jsonb_build_object(
          'area_name', (select a.name from public.skill_areas a where a.id = v_candidate->>'area_id'),
          'pick_id', v_pick_id,
          'pick', v_pick,
          'status', 'open'
        )
      );
    end if;
  end loop;

  select coalesce(pg_catalog.jsonb_agg(
      e.value order by pg_catalog.array_position(array['keep', 'stop', 'test'], e.value->>'kind')
    ), '[]'::jsonb)
  into v_items
  from pg_catalog.jsonb_array_elements(v_items) as e(value);

  insert into public.nudges (user_id, track_id, items)
  values (p_user_id, v_track_id, v_items)
  returning * into v_nudge;

  return pg_catalog.jsonb_build_object(
    'id', v_nudge.id,
    'track_id', v_nudge.track_id,
    'created_at', v_nudge.created_at,
    'items', v_nudge.items
  );
end;
$$;

-- No client role runs it directly. Revoke first, so local and production end
-- up the same.
revoke all on function public.build_keel_check_for(text) from public, anon, authenticated, service_role;

-- 5. The signed-in user's card, built now. The user is the token's `sub`.
create function public.build_keel_check()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.build_keel_check_for((select auth.jwt() ->> 'sub'));
end;
$$;

-- Only signed-in users. Revoke first: production gives new functions no
-- grants, and local defaults would otherwise let anon run it.
revoke all on function public.build_keel_check() from public, anon, authenticated, service_role;
grant execute on function public.build_keel_check() to authenticated;

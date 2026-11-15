-- REI-276: the daily jobs Worker (apps/jobs) stores fresh practice picks.
--
-- For each skill area and kind (`practice` for Test and Keep, `mistake` for
-- Stop), the job finds recent podcast episodes and web posts with Exa, lets
-- Claude Haiku pick up to 3, and saves them here. Picks are the same for
-- everyone: they hold no user data.
--
-- Write model: public.replace_area_picks(...) replaces one area and kind's
-- set in a single transaction, so readers always see a complete set from one
-- run. When a run finds nothing good, it records a row in public.pick_flags
-- and keeps the earlier picks that are still inside the 90-day window. Stale
-- picks are dropped.

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  area_id text not null,
  kind text not null check (kind in ('practice', 'mistake')),
  title text not null check (length(title) between 1 and 300),
  url text not null check (url ~ '^https?://' and length(url) <= 2000),
  publisher text check (publisher is null or length(publisher) between 1 and 200),
  published_at timestamptz not null,
  podcast_timestamp_seconds integer check (podcast_timestamp_seconds is null or podcast_timestamp_seconds >= 0),
  source text not null check (source in ('podcast', 'web')),
  why_line text not null check (length(why_line) between 1 and 300 and why_line !~ '[\r\n]'),
  run_date date not null,
  created_at timestamptz not null default now(),
  constraint picks_area_fk foreign key (track_id, area_id) references public.skill_areas(track_id, id) on delete cascade,
  constraint picks_timestamp_needs_podcast check (podcast_timestamp_seconds is null or source = 'podcast'),
  constraint picks_one_url_per_set unique (track_id, area_id, kind, url)
);

-- One row per area and kind that a run could not fill. A later successful run
-- on the same day removes it.
create table public.pick_flags (
  run_date date not null,
  track_id text not null,
  area_id text not null,
  kind text not null check (kind in ('practice', 'mistake')),
  reason text not null check (reason in ('no_candidates', 'no_good_picks', 'model_error', 'search_error', 'cap_reached')),
  created_at timestamptz not null default now(),
  primary key (run_date, track_id, area_id, kind),
  constraint pick_flags_area_fk foreign key (track_id, area_id) references public.skill_areas(track_id, id) on delete cascade
);

alter table public.picks enable row level security;
alter table public.pick_flags enable row level security;

create policy picks_select_authenticated on public.picks for select to authenticated using (true);
create policy pick_flags_select_authenticated on public.pick_flags for select to authenticated using (true);

-- Revoke first, so the result is the same locally (where default privileges
-- may apply) and in production (where new tables get no grants).
revoke all on public.picks, public.pick_flags from public, anon, authenticated, service_role;
grant select on public.picks, public.pick_flags to authenticated;

-- The job reads the catalog (area names, descriptions and Exa queries) with
-- the service-role key. anon and authenticated can already read it.
grant select on public.tracks, public.skill_areas to service_role;

-- Replaces one area and kind's picks for a run, or flags it.
--
--   p_picks: [] or an array of 1 to 3 objects with exactly these keys:
--     title, url, publisher (string or null), published_at (ISO 8601),
--     podcast_timestamp_seconds (integer or null), source, why_line
--   p_flag_reason: null when p_picks is non-empty; one of the pick_flags
--     reasons when p_picks is empty.
--
-- Every pick must be published in the 90 days before the end of p_run_date.
-- Returns the number of picks stored. Raises P0001 with invalid_picks or
-- unknown_area, and changes nothing, when the input is wrong.
create function public.replace_area_picks(
  p_run_date date,
  p_track_id text,
  p_area_id text,
  p_kind text,
  p_picks jsonb,
  p_flag_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick jsonb;
  v_count integer;
  v_published timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  if p_run_date is null or p_kind is null or p_kind not in ('practice', 'mistake')
    or p_picks is null or pg_catalog.jsonb_typeof(p_picks) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'invalid_picks';
  end if;
  if not exists (
    select 1 from public.skill_areas where id = p_area_id and track_id = p_track_id
  ) then
    raise exception using errcode = 'P0001', message = 'unknown_area';
  end if;

  v_window_start := ((p_run_date - 90)::timestamp at time zone 'UTC');
  v_window_end := ((p_run_date + 1)::timestamp at time zone 'UTC');
  v_count := pg_catalog.jsonb_array_length(p_picks);

  if v_count = 0 then
    if p_flag_reason is null
      or p_flag_reason not in ('no_candidates', 'no_good_picks', 'model_error', 'search_error', 'cap_reached') then
      raise exception using errcode = 'P0001', message = 'invalid_picks';
    end if;
    insert into public.pick_flags (run_date, track_id, area_id, kind, reason)
    values (p_run_date, p_track_id, p_area_id, p_kind, p_flag_reason)
    on conflict (run_date, track_id, area_id, kind) do update
      set reason = excluded.reason, created_at = pg_catalog.now();
    delete from public.picks
    where track_id = p_track_id and area_id = p_area_id and kind = p_kind
      and published_at < v_window_start;
    return 0;
  end if;

  if v_count > 3 or p_flag_reason is not null then
    raise exception using errcode = 'P0001', message = 'invalid_picks';
  end if;

  for v_pick in select value from pg_catalog.jsonb_array_elements(p_picks)
  loop
    if pg_catalog.jsonb_typeof(v_pick) is distinct from 'object'
      or (v_pick - array['title', 'url', 'publisher', 'published_at', 'podcast_timestamp_seconds', 'source', 'why_line']) <> '{}'::jsonb
      or not (v_pick ?& array['title', 'url', 'publisher', 'published_at', 'podcast_timestamp_seconds', 'source', 'why_line'])
      or pg_catalog.jsonb_typeof(v_pick->'title') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_pick->'url') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_pick->'published_at') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_pick->'source') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_pick->'why_line') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_pick->'publisher') not in ('string', 'null')
      or pg_catalog.jsonb_typeof(v_pick->'podcast_timestamp_seconds') not in ('number', 'null') then
      raise exception using errcode = 'P0001', message = 'invalid_picks';
    end if;
    begin
      v_published := (v_pick->>'published_at')::timestamptz;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_picks';
    end;
    if v_published < v_window_start or v_published >= v_window_end then
      raise exception using errcode = 'P0001', message = 'invalid_picks';
    end if;
  end loop;

  delete from public.picks
  where track_id = p_track_id and area_id = p_area_id and kind = p_kind;

  begin
    insert into public.picks (
      track_id, area_id, kind, title, url, publisher, published_at,
      podcast_timestamp_seconds, source, why_line, run_date
    )
    select p_track_id, p_area_id, p_kind, e.value->>'title', e.value->>'url',
      e.value->>'publisher', (e.value->>'published_at')::timestamptz,
      (e.value->>'podcast_timestamp_seconds')::integer, e.value->>'source',
      e.value->>'why_line', p_run_date
    from pg_catalog.jsonb_array_elements(p_picks) as e(value);
  exception when others then
    -- A failed check rolls back this block. Re-raising aborts the whole call,
    -- so the delete above is undone too and the old set stays.
    raise exception using errcode = 'P0001', message = 'invalid_picks';
  end;

  delete from public.pick_flags
  where run_date = p_run_date and track_id = p_track_id and area_id = p_area_id and kind = p_kind;

  return v_count;
end;
$$;

-- Only the jobs Worker's service-role key may write picks.
revoke all on function public.replace_area_picks(date, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.replace_area_picks(date, text, text, text, jsonb, text) to service_role;

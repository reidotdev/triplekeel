create table public.tracks (
  id text primary key,
  name text not null,
  alt_titles text[] not null default '{}',
  levels text[] not null default array['junior', 'mid', 'senior'],
  created_at timestamptz not null default now(),
  constraint tracks_levels_valid check (levels = array['junior', 'mid', 'senior'])
);

create table public.skill_areas (
  id text primary key,
  track_id text not null references public.tracks(id) on delete cascade,
  name text not null,
  junior_description text not null,
  mid_description text not null,
  senior_description text not null,
  exa_queries jsonb not null,
  unique (track_id, id)
);

create table public.questions (
  id text primary key,
  track_id text not null references public.tracks(id) on delete cascade,
  area_id text not null,
  question_text text not null,
  polarity text not null check (polarity in ('good', 'bad')),
  answers text[] not null default array['yes', 'partly', 'no', 'n/a'],
  constraint questions_answers_valid check (answers = array['yes', 'partly', 'no', 'n/a']),
  constraint questions_track_area_fk foreign key (track_id, area_id) references public.skill_areas(track_id, id) on delete cascade
);

create table public.profiles (
  user_id text primary key check (length(user_id) between 1 and 200),
  job_title text,
  track_id text references public.tracks(id),
  current_level text check (current_level in ('junior', 'mid', 'senior')),
  target_level text check (target_level in ('junior', 'mid', 'senior')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(user_id) between 1 and 200),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  rate_window_started_at timestamptz not null default date_trunc('minute', now()),
  rate_window_reports integer not null default 0 check (rate_window_reports >= 0)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(user_id) between 1 and 200),
  track_id text not null references public.tracks(id),
  app text not null check (app in ('chatgpt', 'claude', 'other')),
  source text not null check (source in ('live', 'import', 'paste')),
  hour timestamptz not null check (date_trunc('hour', hour at time zone 'UTC') = hour at time zone 'UTC'),
  length_bucket text not null check (length_bucket in ('0-50', '50-200', '200-500', '500-1000', '1000-2000', '2000-5000', '5000+')),
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 1 and 16),
  import_key text check (import_key is null or import_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint signals_import_key_by_source check ((source = 'import' and import_key is not null) or (source = 'paste' and import_key is null) or source = 'live'),
  constraint signals_user_import_key_unique unique (user_id, import_key)
);

create table public.levels (
  user_id text not null check (length(user_id) between 1 and 200),
  area_id text not null references public.skill_areas(id),
  level text not null check (level in ('junior', 'mid', 'senior')),
  confidence numeric not null check (confidence between 0 and 1),
  n_prompts integer not null default 0 check (n_prompts >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.signals enable row level security;
alter table public.tracks enable row level security;
alter table public.skill_areas enable row level security;
alter table public.questions enable row level security;
alter table public.levels enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);
create policy devices_select_own on public.devices for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy signals_select_own on public.signals for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy levels_select_own on public.levels for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy tracks_select_all on public.tracks for select to anon, authenticated using (true);
create policy skill_areas_select_all on public.skill_areas for select to anon, authenticated using (true);
create policy questions_select_all on public.questions for select to anon, authenticated using (true);

revoke all on public.profiles, public.devices, public.signals, public.tracks, public.skill_areas, public.questions, public.levels from public, anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select (id, user_id, created_at, revoked_at) on public.devices to authenticated;
grant select (id, user_id, track_id, app, source, hour, length_bucket, answers, import_key, created_at) on public.signals to authenticated;
grant select on public.tracks, public.skill_areas, public.questions to anon, authenticated;
grant select on public.levels to authenticated;

create or replace function public.write_device_signals(p_token_hash text, p_reports jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_device public.devices%rowtype;
  v_report jsonb;
  v_answers jsonb;
  v_hour timestamptz;
  v_inserted integer := 0;
  v_row_count integer;
  v_batch_size integer;
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
  v_batch_size := jsonb_array_length(p_reports);
  if v_batch_size < 1 or v_batch_size > 50 then
    raise exception using errcode = 'P0001', message = 'invalid_batch';
  end if;
  if date_trunc('minute', now()) > v_device.rate_window_started_at then
    v_device.rate_window_started_at := date_trunc('minute', now());
    v_device.rate_window_reports := 0;
  end if;
  if v_device.rate_window_reports + v_batch_size > 50 then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  for v_report in select value from jsonb_array_elements(p_reports)
  loop
    if jsonb_typeof(v_report) is distinct from 'object' then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if (v_report - array['schema','track','app','source','hour','length_bucket','answers','import_key']) <> '{}'::jsonb
      or not (v_report ?& array['schema','track','app','source','hour','length_bucket','answers'])
      or v_report->>'schema' is distinct from 'triplekeel.signal.v1'
      or not exists (select 1 from public.tracks where id = v_report->>'track')
      or not coalesce(v_report->>'app' = any(array['chatgpt', 'claude', 'other']), false)
      or not coalesce(v_report->>'source' = any(array['live', 'import', 'paste']), false)
      or not coalesce(v_report->>'length_bucket' = any(array['0-50','50-200','200-500','500-1000','1000-2000','2000-5000','5000+']), false)
      or jsonb_typeof(v_report->'hour') <> 'string'
      or (v_report ? 'import_key' and (jsonb_typeof(v_report->'import_key') <> 'string' or coalesce(v_report->>'import_key' !~ '^[0-9a-f]{64}$', true) or v_report->>'source' <> 'import'))
      or (v_report->>'source' = 'import' and not (v_report ? 'import_key'))
      or (v_report->>'source' = 'paste' and v_report ? 'import_key') then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if jsonb_typeof(v_report->'answers') is distinct from 'array'
      or jsonb_array_length(case when jsonb_typeof(v_report->'answers') = 'array' then v_report->'answers' else '[]'::jsonb end) not between 1 and 16 then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    begin
      if v_report->>'hour' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:00Z$' then
        raise exception;
      end if;
      v_hour := (v_report->>'hour')::timestamptz;
      if to_char(v_hour at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') <> v_report->>'hour' then
        raise exception;
      end if;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end;
    v_answers := v_report->'answers';
    if exists (
      select 1 from jsonb_array_elements(v_answers) as answer(value)
      where jsonb_typeof(value) is distinct from 'object'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_answers) as answer(value)
      where jsonb_typeof(value->'p') is distinct from 'number'
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_report';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_answers) as answer(value)
      where jsonb_typeof(value) <> 'object'
        or (value - array['q','a','p']) <> '{}'::jsonb
        or not (value ?& array['q','a','p'])
        or not exists (select 1 from public.questions where id = value->>'q' and track_id = v_report->>'track')
        or not coalesce(value->>'a' = any(array['yes','partly','no','n/a']), false)
        or (value->>'p')::numeric < 0 or (value->>'p')::numeric > 1
        or round((value->>'p')::numeric, 2) <> (value->>'p')::numeric
    ) or (select count(distinct value->>'q') from jsonb_array_elements(v_answers) as answer(value)) <> jsonb_array_length(v_answers) then
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

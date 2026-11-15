-- REI-263: sign-up profile. Unsupported job titles go on a waitlist.
-- The job title stays the only free-text column on profiles.

alter table public.profiles
  add column waitlisted boolean not null default false;

alter table public.profiles
  add constraint profiles_job_title_length
    check (job_title is null or length(job_title) between 1 and 80),
  add constraint profiles_waitlisted_has_title
    check (not waitlisted or job_title is not null);

-- profiles.track_id references tracks. `supabase db push` does not load
-- seed.sql, so make sure the product-manager track row exists everywhere.
-- Values mirror tracks/product-manager/track.yaml, as seed.sql does.
insert into public.tracks (id, name, alt_titles)
values ('product-manager', 'Product manager', array['PM', 'Product owner', 'Associate product manager', 'APM', 'Senior PM'])
on conflict (id) do nothing;

-- Row level security and the own-row policies from the first migration still
-- apply. State the grants again so the new column is covered explicitly.
-- Users can read, insert and update their own row. They cannot delete it.
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

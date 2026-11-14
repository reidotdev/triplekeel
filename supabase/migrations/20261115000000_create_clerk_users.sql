create table public.users (
  user_id text primary key,
  email text,
  first_name text,
  last_name text,
  image_url text not null default '',
  clerk_created_at timestamptz not null,
  clerk_updated_at timestamptz not null
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select to authenticated
  using ((auth.jwt()->>'sub') = user_id);

revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;

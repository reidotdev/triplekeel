-- REI-264: the extension connect flow.
-- A signed-in user creates and revokes their own devices through row level
-- security. The extension reads its account with a device token through one
-- narrowly scoped function, like write_device_signals.

-- Users create devices for themselves only.
create policy devices_insert_own on public.devices for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- Users revoke their own devices. A revoked device can't be made active again.
create policy devices_revoke_own on public.devices for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id and revoked_at is not null);

-- Column grants: a user sets the owner and hash on insert and only
-- revoked_at on update. token_hash stays unreadable.
grant insert (user_id, token_hash) on public.devices to authenticated;
grant update (revoked_at) on public.devices to authenticated;

-- Device-authenticated read for GET /api/me and GET /api/questions.
-- Returns the email and track of the device's owner, and nothing else.
create function public.read_device_context(p_token_hash text)
returns table (email text, track_id text, track_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_revoked_at timestamptz;
begin
  select d.user_id, d.revoked_at into v_user_id, v_revoked_at
  from public.devices d
  where d.token_hash = p_token_hash;

  if not found then
    raise exception using errcode = 'P0001', message = 'device_not_found';
  end if;
  if v_revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'device_revoked';
  end if;

  return query
  select u.email, p.track_id, t.name
  from (select v_user_id as user_id) me
  left join public.users u on u.user_id = me.user_id
  left join public.profiles p on p.user_id = me.user_id
  left join public.tracks t on t.id = p.track_id;
end;
$$;

revoke all on function public.read_device_context(text) from public, authenticated, service_role;
grant execute on function public.read_device_context(text) to anon;

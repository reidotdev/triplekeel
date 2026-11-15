# Supabase database

Run `supabase start`, then `supabase db reset` to apply migrations and load the placeholder product-manager track. Run database tests with `supabase test db`.

## Device signal writes

`POST /api/signals` should validate each report with `parseReport()` and call the Supabase RPC:

```ts
supabase.rpc("write_device_signals", {
  p_token_hash: sha256Hex(deviceToken),
  p_reports: reports,
});
```

The token hash is lowercase SHA-256 hex. The RPC signature is `public.write_device_signals(text, jsonb) returns integer`. `p_reports` is an array of 1–50 `triplekeel.signal.v1` reports. The return value is the number inserted; duplicate `(user_id, import_key)` rows are ignored and do not contribute to it.

Only the `anon` database role has `EXECUTE` on the function. The role has no direct table write grants. The function has an empty `search_path` and schema-qualifies database objects. The API can use the project's publishable/anon key; it must not use the service-role key. The function looks up an active device by token hash, derives `user_id` from that row, and allows up to 50 submitted reports per device in each database minute window. It raises `P0001` with one of `device_not_found`, `device_revoked`, `invalid_batch`, `invalid_report`, or `rate_limit_exceeded`.

The `authenticated` role can read a user's own profile, devices, signals, and levels using the Clerk JWT `sub`. It cannot read device token hashes or execute the device write function. Anonymous and authenticated users can read the seeded track catalog.

`signals` stores only the report fields: track, app, source, UTC hour, length bucket, answers, and optional import key. It has no prompt text or arbitrary text field. The RPC validates exact report and answer keys before insertion. The SQL seed mirrors the placeholder PM track files under `tracks/product-manager/`, including skill descriptions, Exa queries, and questions.

## Device connect

A signed-in user can insert a device row for themselves (`user_id` and `token_hash` only) and set `revoked_at` on their own devices. A revoked device can't be made active again. Users still can't read token hashes.

`public.read_device_context(text)` takes a token hash and returns the owner's `email`, `track_id` and `track_name`. It backs `GET /api/me` and `GET /api/questions`. Like the write function, it is `SECURITY DEFINER` with an empty `search_path`, and only `anon` can execute it. It raises `P0001` with `device_not_found` or `device_revoked`.

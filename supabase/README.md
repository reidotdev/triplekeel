# Supabase database

Run `supabase start`, then `supabase db reset` to apply migrations and load the track catalog from `supabase/seed.sql`. Run database tests with `supabase test db`.

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

`signals` stores only the report fields: track, app, source, UTC hour, length bucket, answers, and optional import key. It has no prompt text or arbitrary text field. The RPC validates exact report and answer keys before insertion. A report can have one answer per question in its track, and the table caps answers at 100.

## Track catalog

`tracks/` is the source of truth for `tracks`, `skill_areas` (with each area's level `thresholds`) and `questions`. `public.sync_track_catalog(jsonb)` upserts them. It never deletes rows, because stored signals name question IDs. It raises `catalog_question_in_other_track` or `catalog_area_in_other_track` instead of moving a row between tracks. Only `service_role` can execute it.

- Local: `supabase/seed.sql` is generated and calls the function. After you change a track file, run `node scripts/sync-catalog.mts --write-seed`. A test fails while the seed is out of date.
- Production: the deploy job runs `node scripts/sync-catalog.mts` after `supabase db push`, with the service-role key. The script then reads the catalog back with the anon key and fails if it differs from `tracks/`.
- CI: after `supabase db reset`, CI runs the same sync and check against the local stack.

## Device connect

A signed-in user can insert a device row for themselves (`user_id` and `token_hash` only) and set `revoked_at` on their own devices. A revoked device can't be made active again. Users still can't read token hashes.

`public.read_device_context(text)` takes a token hash and returns the owner's `email`, `track_id` and `track_name`. It backs `GET /api/me` and `GET /api/questions`. Like the write function, it is `SECURITY DEFINER` with an empty `search_path`, and only `anon` can execute it. It raises `P0001` with `device_not_found` or `device_revoked`.

## Levels and gaps

`public.recompute_user_levels(text)` turns a user's signals into one `levels` row per skill area. `write_device_signals` calls it after every batch, in the same transaction. No client role can execute it. If it fails, the batch is still stored and the next batch recomputes.

- Answer score: yes = 1, partly = 0.5, no = 0, n/a skipped. A `bad` question is inverted (1 − score).
- Weight: `p × 0.5^(age_days / 30)`, with age measured from the user's newest report hour. Every source counts the same.
- Area score: `3 × Σ(weight × score) / Σ(weight)`, on the 0–3 scale. The level is the highest one whose threshold (`skill_areas.thresholds`, from `skill-areas.yaml`) is at or below the score.
- Confidence: `n_prompts / (n_prompts + 5) × (1 − spread)`, where spread is the weighted standard deviation of the answer scores.
- Under 5 prompts in an area there is no row: "not enough evidence yet".

The migration `20261115030000_compute_levels.sql` documents the exact formula and holds the constants.

`public.read_level_gaps()` returns the signed-in user's areas for their profile's track: `rank, area_id, area_name, level, target_level, gap, score, confidence, n_prompts`. Gap is the target level minus the current level, never below 0. Rows are ranked by gap, then by the lowest score. Areas without enough evidence come last with a null level. It is `SECURITY INVOKER`, so row level security applies, and only `authenticated` can execute it. In the web app, call `readLevelGaps(supabase)` from `apps/web/src/lib/levels.ts` with the Clerk-session client.

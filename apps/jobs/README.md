# Jobs Worker

The `triplekeel-jobs` Cloudflare Worker finds fresh material for every skill area once a day, so keel checks can cite something recent.

## What a run does

1. Reads the track catalog (areas, descriptions and Exa queries) from Supabase.
2. Makes two sets per area: `practice` (for Test and Keep) and `mistake` (for Stop). A query with "mistake", "fail", "complain", "wrong" or "when not to" in it is a `mistake` query. When an area has no query of a kind, the job uses "mistakes {people} make with {area}" or "{people} talking about {area}".
3. For each set, runs two Exa searches limited to the last 90 days:
   - podcasts: the first query of the kind, with `includeDomains: ["exa.ai/library/podcast"]`, highlights, and the first 800 characters of text for the show name;
   - posts and talks: the second query of the kind (or the first again), on the web without `exa.ai`.
4. Drops results without a date in the window, a title or an http(s) URL, and repeats by URL or title.
5. Asks Claude Haiku (`claude-haiku-5-5`) to pick up to 3 and write one plain sentence on why each helps. The output is JSON, constrained to the candidate URLs and checked again in code.
6. For podcast picks, fetches the full transcript in one Exa `/contents` call, finds the highlight in it, and stores the start of that transcript turn in seconds.
7. Saves each set with `public.replace_area_picks`. A set with nothing good is flagged in `public.pick_flags` instead, and its earlier picks stay while they are under 90 days old.

The job never reads user data. Only area names, descriptions and queries go to Exa and Claude. Search results are untrusted: they reach Claude as quoted JSON, and the system prompt says to ignore instructions inside them.

## Flags

| Reason          | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `no_candidates` | No search result was dated in the window.                  |
| `no_good_picks` | Claude found nothing good enough. No weak picks are saved. |
| `model_error`   | The Claude call failed or returned invalid output.         |
| `search_error`  | Both Exa searches failed.                                  |
| `cap_reached`   | The run hit a call cap before this set.                    |

## Caps and cost

- At most 80 Exa calls and 22 Claude calls per run (`src/config.ts`). A capped set is flagged. Raise the caps when a track or area is added.
- The PM track uses 44 searches and up to 22 transcript calls a day. Exa charged about $0.007 per call in REI-248, so about $0.40 a day.
- Claude Haiku costs about $0.02 a day for 22 short calls.
- Logs hold counts and error codes only, never content or keys.

## Kill switch

Set the `KILL_SWITCH` Worker variable to `true` in the Cloudflare dashboard to stop the job without a redeploy. The job then returns before it calls Supabase, Exa or Claude. It uses the same rule as the web Worker. Deploys use `--keep-vars`, so the dashboard value stays.

## Schedule and manual runs

- The Cron Trigger in `wrangler.jsonc` runs the job daily at 04:17 UTC. The Worker has no fetch handler and no URL.
- For the demo, run the **Daily job (manual run)** workflow from the GitHub Actions tab. It runs the same `runDailyJob` in Node (`node apps/jobs/src/cli.ts`) in the `production` environment, so it waits for the owner's approval. The `KILL_SWITCH` GitHub variable stops it too.

## Keepalive

The daily catalog read and picks write are the database requests that [ADR-0013](../../docs/adr/0013-supabase-migrations-and-free-plan-operations.md) relies on to lower the chance of a Free plan pause. A failed write marks the cron run as failed in Workers Observability, and the manual run exits with an error.

## Deploy

The CI deploy job runs `wrangler deploy --keep-vars` after the web Worker deploy. It uploads `EXA_API_KEY`, `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as secrets, and sets `SUPABASE_URL` from the `NEXT_PUBLIC_SUPABASE_URL` variable. The service-role key is a new-style `sb_secret_...` key, so it goes only in the `apikey` header.

## Local checks

- `pnpm --filter @triplekeel/jobs build` type-checks and builds.
- `pnpm --filter @triplekeel/jobs bundle` runs `wrangler deploy --dry-run`.
- `pnpm test` runs the unit tests. They mock every network call.

---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Stack: Next.js on Cloudflare Workers, Clerk for auth, Supabase for data

## Context and problem statement

TripleKeel has to be a real app that strangers can sign up for and keep using. One person builds it. The stack was chosen in the planning notes (notes repo: `requirements.md`, 2026-11-13) but never got its own ADR. This ADR records it, because the scaffold (REI-254), `.env.example` and the infrastructure tickets already depend on it. What runs the web app, the API, auth, data and background jobs?

## Decision drivers

- Solo builder: managed services, no servers to run.
- Real sign-up from day one, no fake accounts.
- Users only ever see their own data, enforced by the database, not only by our code.
- Others can deploy their own copy with their own keys ([ADR-0005](0005-open-source-mit-monorepo-tracks-as-data.md)).
- Low fixed cost.

## Considered options

1. **Next.js on Cloudflare Workers, Clerk, Supabase.**
2. **Next.js on Vercel, Clerk, Supabase.**
3. **Supabase for everything,** including Supabase Auth and Edge Functions.

## Decision outcome

Chosen: **option 1.** Workers run the web app and the jobs. Clerk gives hosted sign-up screens. Supabase gives Postgres with Row Level Security (RLS) tied to the Clerk user.

| Layer           | Choice                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Web app and API | Next.js (App Router) on Cloudflare Workers, via the OpenNext adapter (`@opennextjs/cloudflare`) |
| Jobs            | A separate Worker (`apps/jobs`) with Cron Triggers, for the daily Exa scan and due nudges       |
| Auth            | Clerk. Supabase trusts Clerk as a third-party auth provider                                     |
| Data            | Supabase Postgres. RLS checks `auth.jwt()->>'sub' = user_id`                                    |
| LLM             | Claude, on the server only, never on prompt text                                                |
| Domain          | `triplekeel.rei.dev`, read from `APP_URL`, never hardcoded                                      |

- **Workers Paid ($5/month), not Free.** The free plan allows 10 ms of CPU per request, and Next.js server rendering plus Clerk checks usually take 10–20 ms (Cloudflare limits page, 2026-11-13).
- **The jobs Worker is separate** so it doesn't fight OpenNext over a `scheduled` handler.
- **Secrets** live in Cloudflare Worker secrets and GitHub Actions secrets. `.env.example` lists every variable with no values. The Supabase service role key is used only in webhooks and the jobs Worker. The signals route uses the restricted device-write function described below.

## Device-authenticated signal writes

The extension and paste page authenticate with per-device bearer tokens, not Clerk sessions. Supabase therefore has no Clerk `sub` to use for those requests. `POST /api/signals` validates each report with `parseReport()` and calls a narrowly scoped `SECURITY DEFINER` function to authenticate the device, enforce its rate limit, and insert reports for that device's user.

The function is the only database write path for device-authenticated signals. It has a fixed `search_path`, exposes only the required operation, and does not grant broad table access. The route never uses the service role key. Device token hashes and request bodies must not be logged. The API rejects any report that does not match `triplekeel.signal.v1` before calling the function.

This preserves Clerk `sub`-based RLS for user-session access while allowing a separate, narrowly scoped path for device writes. Table RLS remains enabled. The migration must explicitly grant only the table and function permissions each client needs.

### Consequences

- Good: device writes do not require the service role key or a second JWT issuer.
- Good: the database limits the device write path to token verification, rate limiting, and signal insertion.
- Bad: the function is security-sensitive and needs tests for token ownership, rate limits, privileges, and invalid writes.
- Bad: device-authenticated requests do not use the Clerk `sub` RLS policy; the function must enforce the device-to-user relationship itself.

### Consequences

- Good: no servers. Deploys come from the repo plus Cloudflare secrets.
- Good: RLS enforces "users only see their own data" in the database.
- Good: Clerk's hosted components mean no auth screens to build.
- Bad: Workers can't run Node-only native modules and can't write files.
- Bad: three vendors, each with its own dashboard and keys.
- Bad: a free Supabase project pauses after a week with no activity and has no daily backups.

### Confirmation

- REI-259: the web skeleton is live at `triplekeel.rei.dev`, deployed from CI.
- A second test account can't read the first account's rows, checked through the Supabase client with each user's token.

## Pros and cons of the options

### 1. Cloudflare Workers, Clerk, Supabase

- Good: cheap, fast, and the jobs run on the same platform.
- Bad: Workers runtime limits. OpenNext is one more layer to debug.

### 2. Vercel, Clerk, Supabase

- Good: the smoothest path for Next.js.
- Bad: cron and background work need another service or plan.

### 3. Supabase for everything

- Good: one vendor.
- Bad: we'd build our own sign-up screens. Edge Functions don't host the Next.js app.

## More information

- Infrastructure tickets: REI-252 (Cloudflare and domain), REI-253 (Clerk and Supabase), REI-255 (API keys and secrets), REI-259 (web skeleton).
- `.env.example` in the repo root.

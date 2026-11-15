# Web app operations

## Local development

Copy the empty values from the repository `.env.example` into `apps/web/.env.local` and fill them with development credentials. Keep `.env.local` out of git.

Run `pnpm --filter @triplekeel/web dev` for Next.js development or `pnpm --filter @triplekeel/web preview` to run the OpenNext Worker locally.

## Clerk webhook setup

Create a Clerk webhook for `POST ${APP_URL}/api/webhooks/clerk` and enable `user.created`, `user.updated`, and `user.deleted`. Save its signing secret as `CLERK_WEBHOOK_SECRET` in GitHub Actions and in the local environment when testing. The endpoint returns a 400 response when Svix verification fails.

## Extension connect

Set `NEXT_PUBLIC_EXTENSION_ID` to the extension's pinned ID, `pdnjcggmbannclgepccjfphlfchijfln`. Add it as a GitHub Actions variable in the `production` environment. The deploy fails without it.

`/connect` creates a device token for the signed-in user and sends it to the extension. Only the token's SHA-256 hash is stored in `devices`. `/settings/devices` lists devices and revokes them. Both use the Supabase client with the Clerk session token, so row level security applies.

The extension calls `GET /api/me` and `GET /api/questions` with `Authorization: Bearer tkd_...`. Both return 401 for an unknown or revoked device.

## Signals API

`POST /api/signals` stores score reports from the extension. Send `Authorization: Bearer tkd_...` and a JSON body `{ "reports": [...] }` with 1 to 50 `triplekeel.signal.v1` reports. It returns `{ "received": n, "inserted": m }`. Duplicate import keys are not inserted again.

- `400`: the body or any report is invalid. The response never repeats the input.
- `401`: the device token is missing, malformed, unknown or revoked.
- `429`: the device sent more than 50 reports in a minute.
- `503`: the kill switch is on.

The route uses the Supabase anon key and the `write_device_signals` function. It never uses the service-role key and never logs request content.

## Cloudflare controls

The `routes` entry in `wrangler.jsonc` attaches `triplekeel.rei.dev` as a Workers Custom Domain during deployment. Do not add a DNS record by hand.

Add the `KILL_SWITCH` Worker variable in the Cloudflare dashboard. Leave it unset or set it to `false` normally; set it to `true` to reject API requests other than the Clerk webhook without a redeploy. Deploys use `--keep-vars` so dashboard-managed variables are retained.

Add a Cloudflare rate-limit rule for `triplekeel.rei.dev` that blocks requests above 60 per minute per IP on `/api/*`. Do not enable Bot Fight Mode because it can challenge extension report uploads.

The Worker starts with a 1000 ms CPU limit. In the local OpenNext preview, warmed sign-up SSR took 76 ms, the dashboard redirect took 18 ms, and an unsigned webhook request took 70 ms. The first home request took 2161 ms during cold startup. These are total request durations, not CPU measurements. Review CPU usage in Workers Observability after the first approved live deployment and lower the cap if those measurements allow it.

## GitHub environment

The deployment job uses the `production` environment. Configure it to require approval before the first production deployment. Main-branch pushes run migrations and deploy through this environment.

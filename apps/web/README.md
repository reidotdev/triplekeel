# Web app operations

## Local development

Copy the empty values from the repository `.env.example` into `apps/web/.env.local` and fill them with development credentials. Keep `.env.local` out of git.

Run `pnpm --filter @triplekeel/web dev` for Next.js development or `pnpm --filter @triplekeel/web preview` to run the OpenNext Worker locally.

## Clerk webhook setup

Create a Clerk webhook for `POST ${APP_URL}/api/webhooks/clerk` and enable `user.created`, `user.updated`, and `user.deleted`. Save its signing secret as `CLERK_WEBHOOK_SECRET` in GitHub Actions and in the local environment when testing. The endpoint returns a 400 response when Svix verification fails.

## Cloudflare controls

The `routes` entry in `wrangler.jsonc` attaches `triplekeel.rei.dev` as a Workers Custom Domain during deployment. Do not add a DNS record by hand.

Add the `KILL_SWITCH` Worker variable in the Cloudflare dashboard. Leave it unset or set it to `false` normally; set it to `true` to reject API requests other than the Clerk webhook without a redeploy. Deploys use `--keep-vars` so dashboard-managed variables are retained.

Add a Cloudflare rate-limit rule for `triplekeel.rei.dev` that blocks requests above 60 per minute per IP on `/api/*`. Do not enable Bot Fight Mode because it can challenge extension report uploads.

The Worker starts with a 1000 ms CPU limit. In the local OpenNext preview, warmed sign-up SSR took 76 ms, the dashboard redirect took 18 ms, and an unsigned webhook request took 70 ms. The first home request took 2161 ms during cold startup. These are total request durations, not CPU measurements. Review CPU usage in Workers Observability after the first approved live deployment and lower the cap if those measurements allow it.

## GitHub environment

The deployment job uses the `production` environment. Configure it to require approval before the first production deployment. Main-branch pushes run migrations and deploy through this environment.

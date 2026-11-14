# REI-259 Web Skeleton Implementation Plan

> **For agentic workers:** Use inline execution with task-by-task verification. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a small authenticated Next.js web app with a reusable UI foundation, Clerk-backed user rows, and CI-ready Cloudflare deployment.

**Architecture:** Keep the application inside `apps/web`, expose its minimal components under `components/ui`, and keep authentication, webhook verification, and Supabase service-role access on the server. Store a single Clerk `users` synchronization migration and use GitHub Actions to push migrations and prepare/deploy the OpenNext Worker after merges to `main`.

**Tech Stack:** Next.js App Router, React Aria Components, Tailwind CSS, Clerk, Supabase, Svix, OpenNext Cloudflare, Wrangler, pnpm, GitHub Actions.

## Global Constraints

- Prompt text never leaves the browser; only score reports may be sent to server routes.
- Do not commit secrets. Keep all required values in `.env.example` as empty names.
- Read the public URL from `APP_URL`; do not hardcode an app domain in application code.
- Keep Worker host permissions and the personal-only product scope unchanged.
- Worker configuration includes `limits.cpu_ms`, `KILL_SWITCH`, and no Bot Fight Mode setting.
- Do not create a DNS record by hand. The custom domain is a Workers Custom Domain route.
- Use Supabase CLI v3 explicitly against `dxkvltfrxzquqxzhzkxb` and pass the database password.
- Do not create the Clerk webhook endpoint or trigger the first production deployment without the owner's checkpoint.

---

### Task 1: Scaffold Next.js and UI foundation

**Files:** `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/app/**`, `apps/web/components/ui/**`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `docs/adr/0014-ui-stack-react-aria-tailwind.md`, `docs/adr/README.md`.

- [x] Add Next.js, React, React Aria Components, Tailwind and the Tailwind PostCSS plugin.
- [x] Replace the placeholder app with App Router layout and neutral home page.
- [x] Define light and dark CSS token variables and map Tailwind theme values to them.
- [x] Add thin Button, Link, TextField, Select, Dialog and Card wrappers.
- [x] Add `/dev/ui`, with development-only rendering.
- [x] Document the app-local component rule and decision in ADR-0014.
- [x] Run lint, typecheck and tests.

### Task 2: Add Clerk sign-in and sign-up

**Files:** `apps/web/app/layout.tsx`, `apps/web/app/sign-in/[[...sign-in]]/page.tsx`, `apps/web/app/sign-up/[[...sign-up]]/page.tsx`, `apps/web/proxy.ts`, `apps/web/src/lib/clerk-appearance.ts`, `.env.example`.

- [x] Add Clerk's Next.js SDK and root provider.
- [x] Add hosted sign-in and sign-up screens themed with CSS tokens through `appearance`.
- [x] Protect the authenticated app while allowing auth, webhook and health routes.
- [x] Keep `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` public and `CLERK_SECRET_KEY` server-only.
- [x] Run lint, typecheck and tests.

### Task 3: Synchronize Clerk users into Supabase

**Files:** `supabase/migrations/20261115000000_create_clerk_users.sql`, `apps/web/app/api/webhooks/clerk/route.ts`, `apps/web/src/lib/supabase-admin.ts`, `.env.example`.

- [x] Create a `public.users` table keyed by Clerk `user_id`, with RLS and `auth.jwt()->>'sub' = user_id` ownership policy.
- [x] Add the minimum profile columns needed for Clerk create/update/delete sync and timestamps.
- [x] Verify Svix signatures using `CLERK_WEBHOOK_SECRET`; handle user created, updated and deleted events idempotently.
- [x] Use the service-role key only in this server-side webhook client.
- [ ] Run lint, typecheck and tests; verify migration syntax locally if the Supabase local stack is available.

### Task 4: Prepare Cloudflare Worker and CI workflows

**Files:** `apps/web/wrangler.jsonc`, `apps/web/open-next.config.ts`, root `.gitignore`, `.github/workflows/ci.yml`, `apps/web/package.json`, `apps/web/proxy.ts`.

- [x] Add OpenNext build/preview/deploy scripts and Worker custom-domain configuration.
- [x] Set an initial `limits.cpu_ms` value from local Worker request timings and wire `KILL_SWITCH` into API paths.
- [x] Add a dashboard-only rate-limit instruction for `/api/*` at 60 requests/minute/IP; do not enable Bot Fight Mode.
- [x] Add CI migration push on main with explicit Supabase remote and database password.
- [x] Add main-branch deployment with Worker secrets populated from GitHub secrets and public config from GitHub variables.
- [ ] Keep the deployment job manually gated for the first production deploy.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:extension`, and the web/OpenNext production build.

### Task 5: Review and publish the pull request

- [ ] Review the full diff, confirm no secret values or unrelated Supabase files were added, and check ticket requirements.
- [ ] Commit with a `REI-259:` prefix after the required verification commands pass.
- [ ] Open a PR against `main` and report the Clerk endpoint/signing-secret setup and first-deploy approval checkpoints.

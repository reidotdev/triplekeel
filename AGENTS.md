# Triplekeel

Triplekeel is a personal coach for knowledge work that scores prompts locally in the user's browser. It sends score reports to a web app, which shows a role skill matrix and weekly practice suggestions.

## Repository layout

- `apps/web`: dashboard and API placeholder.
- `apps/jobs`: daily Exa job placeholder.
- `apps/extension`: Chrome Manifest V3 extension.
- `packages/schema`: shared report schema placeholder.
- `packages/scorer`: shared local scorer placeholder.
- `tracks`: role track data files.
- `supabase/migrations` and `supabase/seed`: database setup locations.
- `docs/adr`: architecture decision records.

## Hard rules

- Prompt text never leaves the user's browser. Only `triplekeel.signal.v1` score reports go to the server, and the server rejects anything else.
- Never commit secrets. Real values live in Cloudflare and GitHub Actions secrets.
- No hardcoded domain: use `APP_URL` and `TRIPLEKEEL_API_BASE`.
- Extension host permissions are `claude.ai` and `chatgpt.com` only.
- Personal only: no employer or team views.
- After the MVP freeze, new features go behind a flag that's off by default.

## How to work

- Use one Linear ticket per branch and pull request.
- Name branches `rei-<number>-<short-title>`.
- Reference the ticket in commit messages, for example `REI-254: Scaffold the repo`.
- Check a ticket's "blocked by" relations before starting.
- If blocked or a human decision is needed, stop and say so instead of guessing.

## Commands

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build:extension`

## Writing style

Use plain, short, direct sentences for docs and UI text.

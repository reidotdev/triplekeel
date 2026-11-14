# TripleKeel

Get better at your job on autopilot. TripleKeel learns from your AI chats, privately, and brings you the best new practices for your skill gaps.

TripleKeel scores prompts on your device. It sends score reports, never prompt text. A dashboard shows your skill matrix and weekly keel checks.

## Layout

`apps/` contains the web app, jobs worker, and Chrome extension. `packages/` contains shared schema and scorer placeholders. `tracks/` holds role data; `supabase/` and `docs/adr/` hold database setup and architecture decisions.

## Checks

Run `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build:extension`.

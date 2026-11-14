---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Supabase migrations and Free plan operations

## Context and problem statement

TripleKeel uses Supabase for production data. The project is on the Free plan, which can pause after a week of low activity and does not provide daily backups. We need a repeatable way to test and deploy database changes, and a low-cost way to reduce the chance of an inactivity pause.

## Decision drivers

- Keep schema changes in the repository and review them before production.
- Avoid developing against production data.
- Keep fixed costs low before the demo.
- Do not treat a keepalive request as a backup or as a guarantee against pausing.

## Considered options

### Migration deployment

1. Run `supabase db push` from GitHub Actions after a merge to `main`.
2. Use Supabase's GitHub integration.
3. Run `supabase db push` manually from a laptop.

### Development database

1. Run a local Supabase stack with `supabase start`.
2. Develop directly against the hosted production project.

### Free plan activity

1. Keep the Free project and send a small daily database request from the jobs Worker.
2. Upgrade to Pro before the demo.
3. Keep the Free project without scheduled activity and restore it if it pauses.

## Decision outcome

- Use `supabase start` for local development and migration checks.
- Run `supabase db push` from GitHub Actions after changes merge to `main`.
- Keep Supabase on the Free plan before the demo. The daily jobs Worker makes a small database request and monitors the request for failures. This is a best-effort measure only. Supabase does not guarantee that scheduled requests will prevent a pause. If the project pauses, restore it through the Supabase dashboard.
- Treat the daily request as an availability measure, not a backup. The Free plan has no daily backups. The project owner accepts this recovery risk for the demo.

The migration workflow uses GitHub Actions secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. The project reference is configuration, not a secret. Secrets must not be committed.

## Consequences

- Good: migrations are versioned, tested locally, and deployed through the existing GitHub workflow.
- Good: no monthly Supabase plan cost before the demo.
- Bad: the daily request may not prevent a pause; the project may need manual restoration.
- Bad: the Free plan has no daily backups, so data recovery is limited.
- Bad: local Supabase requires the local container runtime and setup.

## More information

- Stack and device write path: [ADR-0006](0006-stack-nextjs-cloudflare-clerk-supabase.md).
- Schema and API work: REI-262.
- Web deployment workflow: REI-259.

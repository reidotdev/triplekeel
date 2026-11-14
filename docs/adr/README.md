# Architecture decision records

One file per decision that is hard to reverse or that we'd otherwise argue about twice.

## Format

We use [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records), trimmed to what a solo build needs. Copy [template.md](template.md).

- **File name:** `NNNN-title-with-dashes.md`. Numbers are sequential and never reused.
- **Status:** `proposed`, `accepted`, `rejected`, `deprecated` or `superseded by ADR-NNNN`.
- **Don't rewrite history.** When a decision changes, write a new ADR and mark the old one `superseded by ADR-NNNN`. Fixing typos or adding a dated update is fine.
- **Keep it short.** One to two pages.
- **Date-stamp facts** that were checked, e.g. `(Modal docs, 2026-11-13)`.
- **Link the work.** Name the Linear ticket and the code that carries out the decision.

## Where these come from

- **0001–0005** were written in the private planning notes and copied here, as ADR-0005 planned. Event-specific details, like prizes, judging and the event schedule, were removed. Links to other planning files are plain text, marked "notes repo". They use the old project name, Rei.
- **0006 and later** record decisions made while building this repo. Each one links the ticket and the code.

The project was renamed from Rei to **TripleKeel** on 2026-11-14, and the app moved from `agent.rei.dev` to `triplekeel.rei.dev`.

## Index

| #                                                             | Decision                                                                     | Status   | Date       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-post-train-ranker-on-modal.md)                    | Post-train the material ranker on Modal with Modal Dojo (now a stretch goal) | accepted | 2026-11-13 |
| [0002](0002-one-learning-track-agentic-product-builder.md)    | Ship one learning track (now Product manager)                                | accepted | 2026-11-13 |
| [0003](0003-local-skill-check-evals-only.md)                  | Local skill check in Claude Code, send only evals                            | accepted | 2026-11-13 |
| [0004](0004-browser-extension-local-scoring-in-app-nudges.md) | Chrome extension with local scoring, in-app nudges instead of Telegram       | accepted | 2026-11-13 |
| [0005](0005-open-source-mit-monorepo-tracks-as-data.md)       | Open source: MIT license, one public monorepo, tracks as data files          | accepted | 2026-11-14 |
| [0006](0006-stack-nextjs-cloudflare-clerk-supabase.md)        | Stack: Next.js on Cloudflare Workers, Clerk, Supabase                        | accepted | 2026-11-14 |
| [0007](0007-monorepo-tooling-pnpm-typescript-biome-vitest.md) | Monorepo tooling: pnpm, TypeScript project references, Biome, Vitest         | accepted | 2026-11-14 |
| [0008](0008-extension-runs-on-claude-and-chatgpt-only.md)     | The extension runs on claude.ai and chatgpt.com only                         | accepted | 2026-11-14 |
| [0009](0009-track-files-yaml-frozen-question-ids.md)          | Track files are YAML checked in CI, and question IDs are append-only         | accepted | 2026-11-14 |
| [0010](0010-report-schema-signal-v1.md)                       | Report schema `triplekeel.signal.v1`: enums and fixed formats only           | accepted | 2026-11-14 |
| [0011](0011-scorer-interface-stub-first-on-device-routing.md) | One scorer interface, a stub first, and track routing on the device          | accepted | 2026-11-14 |
| [0012](0012-keyword-scorer-for-the-mvp.md)                    | The MVP scores prompts with keyword rules, not Gemma                         | accepted | 2026-11-14 |
| [0013](0013-supabase-migrations-and-free-plan-operations.md)  | Supabase migrations and Free plan operations                                 | accepted | 2026-11-14 |

## Open decisions

- **REI-249: add Context.dev or not.**

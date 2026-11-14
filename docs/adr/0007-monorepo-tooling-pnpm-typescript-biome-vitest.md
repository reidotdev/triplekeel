---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Monorepo tooling: pnpm workspaces, TypeScript project references, Biome, Vitest

## Context and problem statement

[ADR-0005](0005-open-source-mit-monorepo-tracks-as-data.md) chose one public monorepo, with apps (`web`, `jobs`, `extension`) and shared packages (`schema`, `scorer`). The scaffold (REI-254) had to pick the tools. Several agents work in parallel, one ticket per branch, so the checks must be fast, the same everywhere, and strict enough to catch mistakes before review. How is the repo built, checked and shared between packages?

## Decision drivers

- One command each for install, lint, typecheck, test and build. The same commands locally and in CI.
- Fast feedback: the whole CI job runs in well under a minute.
- Shared code is defined once. The extension and the API import the same schema.
- Few tools and little config.

## Considered options

1. **pnpm, TypeScript project references, Biome, Vitest.**
2. **npm or Yarn workspaces, ESLint and Prettier, Jest.**
3. **Turborepo or Nx** on top of either.

## Decision outcome

Chosen: **option 1.**

- **pnpm workspaces** (`apps/*`, `packages/*`), pinned to `pnpm@10.26.2`. CI runs `pnpm install --frozen-lockfile`.
- **Node 22**, pinned in `.nvmrc` and `engines`.
- **TypeScript project references.** The root `tsconfig.json` lists every package, and `pnpm typecheck` runs `tsc -b`. Strict mode, ES2022, NodeNext modules.
- **Biome** for linting and formatting, with the recommended rules (`pnpm lint`).
- **Vitest** for tests, run once from the root (`pnpm test`). It finds `*.test.ts` in every package.
- **One CI job** (`.github/workflows/ci.yml`): install, lint, typecheck, test, build the extension, then upload the zip. A `v*` tag publishes a GitHub Release with the zip.
- **Packages are imported by name** (`@triplekeel/schema`, `@triplekeel/scorer`) through `workspace:*` dependencies (REI-260). Each package's `exports` points at its TypeScript source, `./src/index.ts`. A package that imports another lists it under `references`, so `tsc -b` checks types across packages.
- **Node-only code stays out of package entry points.** For example, `packages/schema/src/track-files.ts` reads `tracks/` with `node:fs` and isn't exported, so the browser extension never bundles it.
- **Spikes** live in `spikes/` with their own `package.json` and lockfile, outside the workspace, so throwaway code can't break the main build.

### Consequences

- Good: the whole check suite runs in seconds, locally and in CI (about 15–20 s for the CI job, 2026-11-14).
- Good: one formatter and linter, one test runner, little config.
- Good: shared types can't drift, because there's one copy.
- Bad: exporting TypeScript source means every app needs a bundler that compiles TypeScript (esbuild or Vite). The extension has none yet. REI-264 adds one.
- Bad: no build cache or task graph. That's fine at this size. Add Turborepo only if CI gets slow.

### Confirmation

- CI is green on every merged pull request. It was green on PRs #3–#5 (REI-258, REI-257, REI-260).
- `pnpm build:extension` produces `apps/extension/triplekeel-extension.zip`.

## Pros and cons of the options

### 1. pnpm, project references, Biome, Vitest

- Good: fast, strict about dependencies, one tool each for lint, format and tests.
- Bad: Biome has fewer plugins than ESLint.

### 2. npm or Yarn, ESLint and Prettier, Jest

- Good: the most familiar setup.
- Bad: more config and slower tests. Jest needs extra setup for ES modules and TypeScript.

### 3. Turborepo or Nx

- Good: caching and task graphs.
- Bad: more setup than five small packages need.

## More information

- Scaffold: REI-254. Imports by name: REI-260.
- Commands are listed in `AGENTS.md`.

---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Track files are YAML checked in CI, and question IDs are append-only

## Context and problem statement

[ADR-0005](0005-open-source-mit-monorepo-tracks-as-data.md) made tracks data files, so anyone can add a field with a pull request. The scorer, the levels code and the track content are built in parallel by different agents, so they need a fixed contract early. Reports also carry question IDs forever, so an ID that changes would corrupt old data. What exactly is in a track folder, how is it checked, and how can question IDs change?

## Decision drivers

- Parallel work: the IDs and file format must be frozen before the content exists.
- Old reports must stay readable. A question ID never changes meaning.
- Contributors get clear errors from CI, not a broken deploy.
- The browser extension must not bundle Node-only code.

## Considered options

1. **YAML files, zod schemas in `packages/schema`, checked in `pnpm test`.**
2. **JSON files with JSON Schema,** checked by a separate CI step.
3. **Tracks as rows in Supabase only,** edited in an admin page.

## Decision outcome

Chosen: **option 1.**

**Files per track:**

```
tracks/<track-id>/
  track.yaml        # id, name, levels [junior, mid, senior], alt_titles
  skill-areas.yaml  # areas: id, name, levels {junior, mid, senior}: description, exa_queries
  questions.yaml    # questions: id, text, area, polarity (good | bad), answers
```

**Question IDs:**

- 16 IDs are frozen as `QUESTION_IDS_V0`: 12 good habits and 4 anti-patterns (`no_why`, `kitchen_sink`, `vague_fix`, `blind_accept`). Anti-patterns feed "Stop doing".
- New IDs are only ever **appended** to `QUESTION_IDS`. v0 IDs are never renamed, reordered or removed. A test fails if one is.

**Checks** (`checkTrack()`, run on every folder by `packages/schema/src/tracks.test.ts`):

- Every object is strict, so unknown keys fail.
- The track `id` matches its folder name, and the folder list matches `TRACK_IDS`.
- Levels are exactly `junior, mid, senior`. Each area describes all three, with at least one Exa query each.
- Every question ID is known and appears once, and every question's `area` exists.
- Every track includes all 16 v0 questions.
- Answers are a set of `yes | partly | no | n/a`.
- No extra files are allowed in a track folder.

**IDs:** track IDs are kebab-case (`product-manager`). Area and question IDs are snake_case (`problem_discovery`).

**Placeholder:** `tracks/product-manager/` holds the 10 draft areas and 16 questions from the planning notes. REI-273 replaces it after the Exa skills check.

### Consequences

- Good: CI catches a broken track before merge, with a message naming the file and field.
- Good: scorer, levels and content work could start in parallel.
- Good: old reports stay valid, because their question IDs never go away.
- Bad: adding a question takes two changes: the ID in `QUESTION_IDS` and the question in `questions.yaml`.
- Bad: every future track must include the 16 v0 questions, even if some fit it poorly. Revisit before the second track (REI-301).
- Bad: tracks reach the database only through a seed script that doesn't exist yet.

### Confirmation

- CI fails on a copy of the PM track with a wrong ID and a missing area. This was checked before merge (REI-258).
- REI-273's final PM track passes without schema changes.

## Pros and cons of the options

### 1. YAML, zod, `pnpm test`

- Good: easy for people to edit. One schema library for tracks and reports. No extra CI step.
- Bad: YAML's quirks (indentation, unquoted values).

### 2. JSON with JSON Schema

- Good: standard schema, editor support.
- Bad: JSON is harder to write by hand, and it adds a second schema system next to zod.

### 3. Supabase rows only

- Good: no seed step.
- Bad: no pull requests, no review, no CI. Breaks ADR-0005's contribution model.

## More information

- Ticket: REI-258. Code: `packages/schema/src/questions.ts`, `track.ts`, `track-files.ts`.
- Draft areas and the question mapping: notes repo, `job-titles-and-skills.md`.

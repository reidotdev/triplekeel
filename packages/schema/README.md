# Shared schema

Shared IDs and schemas for TripleKeel. The extension, the scorer and the API import from here, so nothing is defined twice.

## Question IDs

`QUESTION_IDS_V0` holds the 16 frozen question IDs. They never change and are never removed. To add a question, append its ID to `QUESTION_IDS`. A test fails if a v0 ID moves or disappears.

Also exported: `QuestionIdSchema`, `ANSWERS` (`yes | partly | no | n/a`), `POLARITIES` (`good | bad`) and `LEVELS` (`junior | mid | senior`).

## Track files

Each track lives in `tracks/<track-id>/` with three files:

- `track.yaml`: `id`, `name`, `levels` (always `[junior, mid, senior]`), `alt_titles`.
- `skill-areas.yaml`: `areas`, each with `id`, `name`, and `levels.{junior,mid,senior}` holding a `description` and `exa_queries`.
- `questions.yaml`: `questions`, each with `id`, `text`, `area`, `polarity` and `answers`.

`checkTrack()` validates the three parsed files. It also checks that:

- the track `id` matches the folder name
- every question's `area` exists
- every v0 question ID is present
- question IDs are known and unique

Every object is strict, so unknown keys are rejected.

`src/track-files.ts` reads track folders from disk. It uses `node:fs`, so it isn't exported from the package entry point.

## CI

`src/tracks.test.ts` validates every folder under `tracks/`. It runs with `pnpm test`.

The report schema (`triplekeel.signal.v1`) comes in REI-257. It should import `QuestionIdSchema` and `AnswerSchema` from here.

# Shared schema

Shared IDs and schemas for Triplekeel. The extension, the scorer and the API import from here, so nothing is defined twice.

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

## Score reports

A `triplekeel.signal.v1` report is the only data that leaves the user's browser. Every string in it is an enum or a fixed format, so free text can't get through.

```json
{
  "schema": "triplekeel.signal.v1",
  "track": "product-manager",
  "app": "chatgpt",
  "source": "import",
  "hour": "2026-11-14T10:00Z",
  "length_bucket": "200-500",
  "answers": [{ "q": "target_user", "a": "yes", "p": 0.91 }],
  "import_key": "<64 hex characters>"
}
```

- `track`: one of `TRACK_IDS`. CI checks that it matches the folders in `tracks/`.
- `app`: `chatgpt`, `claude`, or `other` for the paste page.
- `source`: `live`, `import` or `paste`.
- `hour`: UTC, rounded down to the hour.
- `length_bucket`: prompt length in characters: `0-50`, `50-200`, `200-500`, `500-1000`, `1000-2000`, `2000-5000` or `5000+`.
- `answers`: 1 to `QUESTION_IDS.length` entries, each question once. `p` is 0–1 with at most 2 decimals.
- `import_key`: a SHA-256 hash of site + conversation ID + message index, computed on the device. Required for `import`, optional for `live`, not allowed for `paste`.

Helpers:

- `buildReport()`: for the extension and the paste page. Takes the prompt's length, never its text. Rounds the hour and `p`, picks the bucket, sorts answers, and throws if the result is invalid.
- `parseReport()`: for the API. Validates untrusted input and never throws. Error messages name the field and problem, never the value.
- `computeImportKey()`: hashes a chat message's identity with Web Crypto.

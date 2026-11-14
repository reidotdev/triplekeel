---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# Report schema `triplekeel.signal.v1`: enums and fixed formats only

## Context and problem statement

The hard rule is that prompt text never leaves the user's browser. Only score reports go to the server, and the server rejects anything else ([ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md)). ADR-0004 sketched the report as "enum IDs, answers, probabilities, the hour and a length bucket". It didn't fix the length buckets, the app values, how duplicate imports are caught, or what an error message may contain. What exactly is a report, and how strict is the validator?

## Decision drivers

- **Privacy boundary.** When in doubt, reject.
- A report must not be matchable back to a prompt.
- Scoring the same past chat twice must not count twice.
- One schema, shared by the extension, the paste page and the API, so they can't drift.
- Rejected input must never end up in logs.

## Considered options

1. **A strict zod schema where every string is an enum or a fixed format.**
2. **A looser schema** that allows short strings, like a model name or an error note.

## Decision outcome

Chosen: **option 1.**

```json
{
  "schema": "triplekeel.signal.v1",
  "track": "product-manager",
  "app": "chatgpt",
  "source": "import",
  "hour": "2026-11-14T10:00Z",
  "length_bucket": "200-500",
  "answers": [{ "q": "target_user", "a": "yes", "p": 0.91 }],
  "import_key": "<64 lowercase hex characters>"
}
```

| Field           | Rule                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `track`         | One of `TRACK_IDS`. CI checks it matches `tracks/` ([ADR-0009](0009-track-files-yaml-frozen-question-ids.md))      |
| `app`           | `chatgpt`, `claude`, or `other` for the paste page ([ADR-0008](0008-extension-runs-on-claude-and-chatgpt-only.md)) |
| `source`        | `live` (typed now), `import` (a past chat message) or `paste` (the paste page)                                     |
| `hour`          | UTC, rounded down to the hour, exactly `YYYY-MM-DDTHH:00Z`, and a real date                                        |
| `length_bucket` | Prompt length in characters: `0-50`, `50-200`, `200-500`, `500-1000`, `1000-2000`, `2000-5000`, `5000+`            |
| `answers`       | 1 to `QUESTION_IDS.length` entries, each question once. `a` is `yes`, `partly`, `no` or `n/a`                      |
| `p`             | 0 to 1, **at most 2 decimals**                                                                                     |
| `import_key`    | SHA-256 hex. Required for `import`, optional for `live`, not allowed for `paste`                                   |

- **Every object is strict.** Unknown keys are rejected, including a `__proto__` key from JSON.
- **The import key** is a SHA-256 hash of `triplekeel.import.v1` + site + conversation ID + message index, computed on the device with Web Crypto. The fields are JSON-encoded so `"1"+"23"` and `"12"+"3"` don't collide. The server can't turn the hash back into a conversation ID.
- **`p` precision is limited** because a very precise number is close to a fingerprint of one prompt.
- **Error messages name the field and the problem, never the value** or the names of unknown keys. A rejected report can't leak text into logs.

**Helpers** in `@triplekeel/schema`:

- `buildReport()` is for the extension and the paste page. It takes the prompt's length, never its text. It rounds the hour and `p`, picks the bucket, sorts answers in `QUESTION_IDS` order, and throws if the report is invalid.
- `parseReport()` is for `/api/signals`. It validates untrusted input and never throws.
- `computeImportKey()` hashes a chat message's identity.

### Consequences

- Good: free text has no field to go in. Every string is checked against a list or a pattern.
- Good: the rejection tests are public, so anyone can check the privacy claim (ADR-0005).
- Good: re-importing a chat is caught by the `import_key`, not by matching content.
- Bad: any new field, app or bucket needs a schema change and a new version if it breaks old reports.
- Bad: the hourly time and length buckets lose detail the levels code might have used.
- Bad: a `live` report without an `import_key` can't be deduplicated. That's fine, because live prompts happen once.

### Confirmation

- The rejection tests were written first and failed before the schema existed (REI-257). Removing `.strict()` from the answer object makes a test fail.
- REI-289: after a real session, Supabase and the request logs contain no prompt text.

## Pros and cons of the options

### 1. Enums and fixed formats only

- Good: the privacy rule is enforced by the schema itself.
- Bad: rigid. Every change is a schema change.

### 2. Short strings allowed

- Good: easier to extend and debug.
- Bad: any string field can carry prompt text. Breaks the hard rule.

## More information

- Ticket: REI-257. Code: `packages/schema/src/report.ts`, tests in `report.test.ts`.
- ADR-0004 called this `rei.signal.v1`. It was renamed with the project.

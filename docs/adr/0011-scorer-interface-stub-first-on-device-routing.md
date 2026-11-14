---
status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# One scorer interface, a stub first, and track routing on the device

## Context and problem statement

The extension and the paste page both score prompts on the device ([ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md)). Whether the MVP scorer is Gemma or keyword rules is still open (REI-256), but the extension, the paste page and the end-to-end check can't wait for that. Prompts that aren't about a user's track, or that are personal, must also be dropped before scoring. How do callers talk to the scorer, what do they use until the real one exists, and where does routing happen?

## Decision drivers

- Integration work must start before the real scorer is chosen.
- Swapping stub → keyword → Gemma must not change any caller.
- Prompt text stays inside the scorer. Only answers come out.
- Off-topic and personal prompts are dropped on the device, never sent.
- Demos should look sensible, and tests must be repeatable.

## Considered options

1. **One `Scorer` interface, with a deterministic stub first.**
2. **Wait for REI-256,** then build callers against the real scorer.
3. **A random stub.**

## Decision outcome

Chosen: **option 1.**

```ts
interface Scorer {
  id: "stub" | "keyword" | "gemma";
  ready(onProgress?: (fraction: number) => void): Promise<void>;
  score(prompt: string, questions: TrackQuestion[]): Promise<ScoredAnswer[]>;
}
```

- `score()` returns one `{ q, a, p }` per question, in the same order. Each `a` is one of that question's allowed answers. `p` has 2 decimals, so the answers go straight into `buildReport()` ([ADR-0010](0010-report-schema-signal-v1.md)).
- `ready()` loads the model if needed and reports progress, which matters for a large Gemma download. It's safe to call more than once.

**Stub scorer** (`createStubScorer()`):

- The same prompt always gives the same answers. They come from an FNV-1a hash of the prompt and the question ID.
- Longer, more specific prompts get more `yes` on good questions, and cue words help. Anti-patterns are likelier in short prompts.
- A prompt with "fix it" and under 10 words gets `vague_fix: yes`.
- It's for integration and demos only. It is not a skill check.

**Routing** (`routeTrack(prompt, tracks?)`):

- Returns a track ID or `"none"`. A `"none"` prompt is dropped without scoring or sending anything.
- It picks the track with the most whole-word keyword matches. No match returns `"none"`.
- **A personal topic always returns `"none"`,** even if the prompt also mentions work. Examples are health, relationships or money. This filter drops too much rather than too little.
- Keywords live in `TRACK_KEYWORDS` in the scorer for now. Moving them into `track.yaml` would need a track schema change ([ADR-0009](0009-track-files-yaml-frozen-question-ids.md)).

### Consequences

- Good: "Score this chat", live capture, the paste page and the end-to-end check can be built and tested now.
- Good: REI-275 only adds a new `Scorer`. Callers don't change.
- Good: deterministic answers make tests and demos repeatable.
- Bad: stub results look real. The UI must not present them as a skill measure, and the real scorer must replace the stub before the fresh-user test (REI-290).
- Bad: keyword routing misses prompts that use other words, and the personal filter drops some work prompts, like "reduce user anxiety at checkout".

### Confirmation

- 17 scorer tests cover determinism, the heuristics, allowed answers, valid reports through `buildReport()`, and routing for product, off-topic and personal prompts (REI-260).
- REI-275 implements the real scorer without changing the interface.

## Pros and cons of the options

### 1. Interface and deterministic stub

- Good: unblocks integration. Stable tests.
- Bad: a fake scorer can hide integration problems that only real scores show.

### 2. Wait for the real scorer

- Good: no throwaway code.
- Bad: blocks lanes B and C on a decision that isn't made yet.

### 3. Random stub

- Good: simplest.
- Bad: tests and demos change on every run.

## More information

- Ticket: REI-260. Code: `packages/scorer/src/`.
- The REI-247 spike measured keyword rules at 86.2% agreement with hand labels and a median of 0.68 ms per prompt. Gemma wasn't measured. That's input for REI-256.

# Shared local scorer

Scores prompts on the user's device. The extension and the paste page import it. Prompt text never leaves the scorer, only answers do.

## Use it

```ts
import { createScorer, isPersonal, routeTrack } from "@triplekeel/scorer";

const scorer = createScorer(); // the keyword scorer (ADR-0012)
await scorer.ready();
const answers = await scorer.score(prompt, questions, { followUp: false });
```

Always call `createScorer()`, not a specific scorer, so a later scorer replaces it in one place.

## Interface

```ts
interface Scorer {
  id: "stub" | "keyword" | "gemma";
  ready(onProgress?: (fraction: number) => void): Promise<void>;
  score(
    prompt: string,
    questions: TrackQuestion[],
    context?: { followUp?: boolean },
  ): Promise<ScoredAnswer[]>;
}
```

- `ready()` loads the model if needed. It's safe to call more than once.
- `score()` returns one `{ q, a, p }` per question, in the same order. Each `a` is one of that question's allowed answers. `p` is 0–1 with 2 decimals, so the answers can go straight into `buildReport()` from `@triplekeel/schema`.
- `followUp` says whether the prompt replies to the AI's earlier answer. The extension knows this from the message's position in the chat. Without it, the scorer guesses from the text.

## Keyword scorer

`createKeywordScorer()` is the MVP scorer. It has one rule per v0 question, built from text features: a named audience, a measurable target, "acceptance:", "out of scope", numbered steps, stack names, "fix it" with no detail, and so on.

- `p` is a fixed confidence per rule and answer, not a calibrated probability.
- `specific_feedback` and `vague_fix` only apply to follow-ups. `no_why` and `kitchen_sink` only apply to first prompts. Otherwise the answer is `n/a`.
- A question with no rule yet gets `n/a` with `p` 0.5.

### Check agreement

`eval/` holds two sets of 20 labelled prompts:

- `dev.ts`: the REI-247 spike prompts. Tune rules against these.
- `holdout.ts`: labelled before the rules were written. **Never tune against these.** Its header has the labelling guide.

Print the report:

```bash
SCORER_REPORT=all pnpm exec vitest run packages/scorer/eval --disableConsoleIntercept
```

Use `SCORER_REPORT=dev` while tuning, so you don't see the held-out results. CI fails if agreement drops below 88% on dev or 90% on held-out, or if recall on "yes" labels drops below 85%.

## Stub scorer

`createStubScorer()` returns fake but plausible answers, for tests and integration. It is not a real skill check.

- The same prompt always gets the same answers. It uses a hash of the prompt.
- Longer, more specific prompts get more `yes` on good questions.
- A prompt with "fix it" and under 10 words gets `vague_fix: yes`.

## Track routing

`routeTrack(prompt, tracks?)` returns a track ID or `"none"`. A `"none"` prompt is dropped on the device without scoring.

- It picks the track with the most whole-word keyword matches. Ties go to the first track.
- **Route a chat by its first prompt.** Follow-ups like "fix it" have no keywords, so they return `"none"` and take their chat's track.
- **Run `isPersonal(prompt)` on every prompt,** follow-ups too. A personal prompt is never scored. Health words are first-person, like "my medication", so a PRD for nurses isn't dropped.

The keywords live in `TRACK_KEYWORDS` for now. They can move into `track.yaml` later.

# Shared local scorer

Scores prompts on the user's device. The extension and the paste page import it. Prompt text never leaves the scorer, only answers do.

## Interface

```ts
interface Scorer {
  id: "stub" | "keyword" | "gemma";
  ready(onProgress?: (fraction: number) => void): Promise<void>;
  score(prompt: string, questions: TrackQuestion[]): Promise<ScoredAnswer[]>;
}
```

- `ready()` loads the model if needed. It's safe to call more than once.
- `score()` returns one `{ q, a, p }` per question, in the same order. Each `a` is one of that question's allowed answers. `p` is 0–1 with 2 decimals, so the answers can go straight into `buildReport()` from `@triplekeel/schema`.

The real scorer (REI-275) implements `keyword` or `gemma` behind the same interface.

## Stub scorer

`createStubScorer()` returns fake but plausible answers, for integration and demos. It is not a real skill check.

- The same prompt always gets the same answers. It uses a hash of the prompt.
- Longer, more specific prompts get more `yes` on good questions. Cue words help, like "metric" for `success_metric`.
- A prompt with "fix it" and under 10 words gets `vague_fix: yes`.

## Track routing

`routeTrack(prompt, tracks?)` returns a track ID or `"none"`. A `"none"` prompt is dropped on the device without scoring.

- It picks the track with the most keyword matches, using whole words. Ties go to the first track.
- A prompt that matches no keywords returns `"none"`.
- A prompt with a personal topic, like health, relationships or money, always returns `"none"`.

The keywords live in `TRACK_KEYWORDS` for now. They can move into `track.yaml` later.

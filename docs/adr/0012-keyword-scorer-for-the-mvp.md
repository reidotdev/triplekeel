---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# The MVP scores prompts with keyword rules, not Gemma

## Context and problem statement

Prompts are scored on the device ([ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md)). The plan was a small Gemma model in WebGPU, with a keyword scorer as the fallback if Gemma was too slow. The REI-247 spike measured only the keyword scorer. Gemma 3 270M couldn't be run, because the spike's machine had no browser and too little disk space, and a later cloud session couldn't reach Hugging Face. Which scorer does the MVP ship with (REI-256)?

## Decision drivers

- Prompt text never leaves the browser. No cloud fallback, silent or otherwise.
- Under about 3 s per prompt on a normal laptop.
- Works for strangers on any laptop, including ones without WebGPU.
- Answers we can test and explain.
- Decide now. The extension and the paste page are waiting on it.

## Considered options

1. **Keyword rules.**
2. **Gemma 3 270M in WebGPU.**
3. **Gemma, with keyword rules where WebGPU isn't available.**

## Decision outcome

Chosen: **option 1, keyword rules**, because they are the only option with measured speed and quality, and they work on every laptop with no download.

- `createScorer()` in `@triplekeel/scorer` returns the keyword scorer. The extension and the paste page call `createScorer()`, never a specific scorer, so a later scorer replaces it in one place ([ADR-0011](0011-scorer-interface-stub-first-on-device-routing.md)).
- **One rule per v0 question**, from text features: a named audience, a measurable target, "acceptance:" or "done when", "out of scope" or "MVP", numbered steps, pasted or named material, tests that aren't negated, stack names, "fix it" with no detail, "ship it as is", and so on.
- **`p`** is a fixed confidence per rule and answer, from 0.7 to 0.9. It isn't a calibrated probability.
- **Follow-ups:** `score()` takes an optional `{ followUp }`. The extension knows it from the message's position in the chat. Without it, the scorer guesses from the text. `specific_feedback` and `vague_fix` only apply to follow-ups. `no_why` and `kitchen_sink` only apply to first prompts. Otherwise the answer is `n/a`.
- **A question added after v0 with no rule** gets `n/a` with `p` 0.5.

**Routing** (`routeTrack()`) stays keyword-based, with a wider list of build words and product surfaces. Health words in the personal filter are now first-person ("my medication"), so a PRD for nurses isn't dropped. A chat is routed by its first prompt, and `isPersonal()` runs on every prompt.

### Measured (2026-11-14)

Exact agreement with hand labels, leaving out expected `n/a`:

| Set                                                              | Agreement       | Always "no" | "yes" labels found | False "yes" |
| ---------------------------------------------------------------- | --------------- | ----------- | ------------------ | ----------- |
| Dev: the 20 REI-247 prompts, used for tuning                     | 257/279 (92.1%) | 153/279     | 104/109            | 5/170       |
| Held-out: 20 new prompts, labelled before the rules were written | 263/280 (93.9%) | 232/280     | 43/46              | 14/234      |

- Without the follow-up flag, it drops to 90.0% on dev and 93.2% on held-out.
- 40 prompts score in well under a second in Node. The test fails above 1 s.
- Routing sends all 30 first prompts in both sets to `product-manager`.

**Caveats:**

- **One person wrote the rules and both label sets.** The held-out set was labelled first and committed before the rules (commit `0ca8c83`), but it isn't independent. Real prompts will likely score lower.
- **Most labels are "no",** so the agreement number flatters the scorer. Answering "no" to everything gets 82.9% on the held-out set. Recall on "yes" labels (43/46) and the false "yes" rate (14/234) matter more.
- Both sets are invented PM prompts in English, mostly about building software.

### Consequences

- Good: no download, works on every laptop, scores in milliseconds.
- Good: deterministic. The same prompt always gets the same answers, so tests are stable and results can be explained.
- Good: CI fails if agreement drops below a floor (88% on dev, 90% on held-out), or if recall on "yes" drops below 85%.
- Bad: rules match words, not meaning. Indirect phrasing is missed, and words used in other senses are matched. For example, "faster search" in release notes counts as a speed concern.
- Bad: rules are written for English PM prompts. Each new track needs its own check, and maybe its own rules.
- Bad: the rules never answer "partly" for most questions, even where a person would.
- Bad: no Gemma, so less to show for on-device AI.

### Confirmation

- The REI-277 end-to-end check and the REI-290 fresh-user test produce scores that look right to the person being scored.
- Re-run the agreement report when the final PM track lands (REI-273): `SCORER_REPORT=all pnpm exec vitest run packages/scorer/eval --disableConsoleIntercept`.

## Pros and cons of the options

### 1. Keyword rules

- Good: measured, fast, works everywhere, testable.
- Bad: shallow. Needs care to avoid matching on one prompt's words.

### 2. Gemma in WebGPU

- Good: could understand meaning, not only words.
- Bad: unmeasured. A 426 MB first download, needs WebGPU, and a 270M model may not follow the JSON format reliably.

### 3. Gemma with keyword fallback

- Good: the best quality where WebGPU works.
- Bad: two scorers to build and test, and Gemma's risks remain.

## More information

- Tickets: REI-247 (spike), REI-256 (decision), REI-275 (keyword scorer).
- Code: `packages/scorer/src/keyword.ts`. Eval sets and report: `packages/scorer/eval/`.
- **Revisit** by running the spike page (`spikes/rei-247-gemma-speed/TESTING.md`) in Chrome on a normal laptop. If Gemma is under 3 s and beats the keyword rules on the held-out set, write a new ADR. Gemma would be a new `Scorer` that `createScorer()` returns.

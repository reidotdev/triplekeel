---
status: accepted
date: 2026-11-13
decision-makers: Andrei
---

# Post-train the material ranker on Modal with Modal Dojo

## Context and problem statement

Rei finds learning materials for a skill with Exa and has to pick the few that matter. Claude does this ranking in the core app. Option B (b-exa-plus-posttrained-model.md (notes repo: `b-exa-plus-posttrained-model.md`)) planned to move one step to a post-trained open model on Verda, for the Verda and Gemma bounties.

Two things changed: the team is one person, and that person has never trained a model (2026-11-13). Which platform and method should the training lane use, and which step should the model own?

## Decision drivers

- Solo builder, no training experience. Setup time is the main risk.
- The lane must be cuttable. It adds nothing to the Exa main score.
- A narrow task the model can learn and we can measure.
- Bounties it can earn: Modal (tech), Gemma (tech).
- Real users must never hit a broken path.

## Considered options

1. **Verda GPU instance**, own training and serving stack (original option B).
2. **Modal with Modal Dojo**, training and serving on Modal.
3. **No post-training.** Serve a base open model on Modal for one step, or skip open models.

## Decision outcome

Chosen: **option 2, Modal with Modal Dojo**, because it has the least setup for a beginner. Dojo trains from one Python config, Modal serves behind a URL, and Modal engineers are on site all weekend.

**What the model does:** rank materials. The input is a skill, the learner's level and goal, and 10–20 Exa candidates (title, URL, snippet, type, length). The output is JSON: the top 3 in order with a one-line reason each.

**How it learns:**

1. The core app logs every Claude ranking to Supabase. Those logs are the labels, so the dataset builds itself from M1 onward.
2. Export about 500 rankings. Hold out 100 for eval.
3. Train with Dojo's RL recipe. The reward is the overlap between the model's top 3 and Claude's top 3, plus a bonus for valid JSON. Dojo's quickstart already uses a custom reward function this way (Dojo docs, 2026-11-13).
4. Serve on Modal. The planner step reads `PLANNER_MODEL`. Any error or timeout falls back to Claude.

**Model:**

- **Default: Qwen3.5-4B.** It's the model in Dojo's documented quickstart (`Qwen3_5_4B`, `Qwen3_5_4B_Recipe`), so it's the shortest path. It earns the Modal bounty only.
- **Upgrade: Gemma-4-26B-A4B-it.** It's the only Gemma model in Dojo's list, and it would also earn the Gemma bounty. It's a larger MoE model and the docs don't show a recipe for it. Use it only if the Modal mentors confirm it works for this setup at the kickoff workshop.

```mermaid
flowchart LR
    APP["Core app<br/>Claude ranks Exa results"] -->|"log input + top 3"| DB[("Supabase<br/>ranker_calls")]
    DB -->|"export ~500 rows"| DS[("Dataset<br/>400 train / 100 eval")]
    DS --> DOJO["Modal Dojo<br/>RL, reward = top-3 overlap"]
    DOJO --> EVAL{"Beats base model<br/>on held-out 100?"}
    EVAL -->|"yes"| SERVE["Modal endpoint<br/>PLANNER_MODEL"]
    EVAL -->|"no"| DOC["Don't swap.<br/>Document the run."]
    SERVE --> APP
    APP -.->|"error / timeout"| CLAUDE["Claude fallback"]
```

### Consequences

- Good: one platform, one SDK, no GPU box to manage. Credits ($100) cover several runs. Help is on site.
- Good: the dataset comes from real usage, not a separate generation script.
- Bad: we drop the Verda bounty (bigger prize, $10k credits). Splitting the lane across Verda and Modal would weaken both entries.
- Bad: Dojo is a young library (0.1.x). SFT, LoRA and adapter export aren't in the docs we read. We use the RL path the docs do show.
- Bad: the default model doesn't earn the Gemma bounty.

### Confirmation

- **Cutoff h14:** no training run started → drop the lane. Submit with Claude ranking.
- **Cutoff h22:** fine-tune doesn't beat base Qwen/Gemma on top-3 overlap → don't swap. Still show the eval table for the Modal bounty.
- **Demo number:** top-3 overlap with Claude for base model, fine-tune and Claude itself, on the same 100 held-out sets.

## Pros and cons of the options

### 1. Verda GPU instance

- Good: biggest prize. Rubric rewards a documented process.
- Bad: drivers, CUDA, SSH, training script and serving all by hand. Too much for a first training run done alone.

### 2. Modal with Modal Dojo

- Good: plain Python, `modal deploy` gives a public URL, on-site mentors, a Junction starter kit.
- Bad: smaller prize. Dojo docs are thin beyond the quickstart.

### 3. No post-training

- Good: zero risk. Serving a base model on Modal still enters the Modal bounty.
- Bad: weaker Modal entry ("technical ambition" is 25%). Nothing to show for "how you improved the model".
- Kept as the fallback if the h14 cutoff hits.

## Update (2026-11-14)

Under option G ([ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md)), the Modal lane is a **stretch goal, done only if time allows**. The preferred target changes from the material ranker to the **local scorer**: fine-tune Gemma on Modal to answer the typed questions better, using synthetic prompts labelled by Claude and never user prompts. The ranker served as a Modal endpoint stays as the fallback. Kill rules are in implementation-plan.md (notes repo: `implementation-plan.md`).

## More information

- Modal bounty rubric: effective use of Modal 40, technical ambition 25, impact 20, demo 15 (`junction2026_challenges.json`).
- [Modal Dojo docs](https://dojo.modal.dev/) and [repo](https://github.com/modal-projects/modal-dojo): RL post-training, supported model list (checked 2026-11-13).
- [Modal's training example](https://modal.com/docs/examples/unsloth_finetune) (now a Dojo quickstart).
- Nemotron bounty requires Nemotron 3.5 Super VL (120B, 12B active). Too big to train here. It could take a separate, untrained role through the free NVIDIA Build API. That's out of scope for this ADR.
- **Open questions for the Modal workshop:**
  - Does Dojo support SFT or LoRA, or only RL?
  - Can Gemma-4-26B-A4B-it be trained with our credits, and on which GPU?
  - How do we serve a Dojo checkpoint (vLLM on Modal? Spindle?)

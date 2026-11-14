---
status: accepted
date: 2026-11-13
decision-makers: Andrei
---

# Ship one learning track: "Agentic product builder"

## Context and problem statement

**The user problem (2026-11-13):** agentic product building changes every week. New models, protocols, frameworks and practices ship faster than anyone can follow, so it's hard to keep up with the tech and to know which skills are actually required now.

Rei was planned to take any goal ("I want to become X"). That means a goal → skills planner, a live Exa Webset per new goal (minutes of latency), and quality that varies by goal. One person has 30 hours. Should Rei support any goal, or ship one track done well?

## Decision drivers

- Solo builder, 30 hours. Fewer moving parts.
- Exa Websets are slow. Live Websets for each judge's goal were the riskiest product step.
- Quality we can check: we know this field well enough to tell good material from bad.
- The Exa rubric gives 20 points to "works on judges' own live queries".
- Users must still get real value, not a demo.

## Considered options

1. **Any goal** (the original plan).
2. **One track: Agentic product builder.** Keep the builder current on best practices. Custom tracks come later.
3. **A short list of fixed tracks** (e.g. 3–5 roles).

## Decision outcome

Chosen: **option 2, one track: Agentic product builder**, because it removes the slowest, least predictable part (Websets per goal) and lets one person make the output good.

The promise changes from "close the gaps for any role" to **"keep your agent-building skills current"**: Rei tracks what practitioners ship and publish, shows where you're behind, and sends you the best new practice.

**How the track works:**

- **Skill map:** a hand-written seed of ~10 skill areas (agent architecture and tool use, context engineering, evals, MCP and integrations, observability, guardrails and safety, cost and latency, agent UX, deployment, AI product discovery). Live evidence re-weights it every day and can add new areas when they show up.
- **Evidence:** a daily Workflow runs Exa Websets for practitioners and job posts (agent engineer, AI engineer, AI product engineer) and Context.dev extraction. It's precomputed, so no user waits on a Webset.
- **Fresh practice:** Exa Search, Podcasts and (later) Monitors per skill area, filtered to recent dates. Claude ranks the top 3.
- **Personal part:** your CV and links set your level per skill area. Your gaps and nudges come from that.
- **Live queries for judges:** "Ask Rei" answers any question inside the track ("how do teams evaluate tool-calling agents now?") with fresh, cited sources. Judges also use their own profile.
- **Built for more tracks:** a `tracks` table with one row. A custom track later is a new row plus its own seed map and Websets, not a rewrite.

### Consequences

- Good: the riskiest step (live Websets) becomes a nightly job. The latency risk is gone.
- Good: one skill map we can check by hand. Materials quality is easier to judge.
- Good: a clear pitch and audience: people building agentic products, which is also most of the room at Junction.
- Good: the ADR-0001 ranker gets a narrower task (one domain), which is easier to learn. The seed script iterates over skill areas × levels × date windows instead of ~80 goals.
- Bad: judges can't type "I want to become a chef". "Ask Rei" and their own profile have to carry the live-queries criterion.
- Bad: a smaller audience until custom tracks ship. We pitch custom tracks as the next step.
- Bad: City of Espoo (recruitment) fits even less. Fine, it was already a stretch.

### Confirmation

- At h12, three people with different profiles get visibly different gaps and nudges.
- "Ask Rei" answers 5 questions from someone outside the team, each with dated sources from the last 90 days.
- The nightly evidence job runs twice without help before submission.

## Pros and cons of the options

### 1. Any goal

- Good: the strongest fit for "works on judges' own live queries". Biggest audience.
- Bad: needs a planner and a live Webset per goal. Slow, and quality varies by goal. Too much for one person in 30h.

### 2. One track: Agentic product builder

- Good: simple, fast, checkable. Evidence is precomputed.
- Bad: narrower. Live queries happen inside one domain.

### 3. A few fixed tracks

- Good: some choice for users.
- Bad: each track needs its own seed map and checking. Costs most of option 1's work and adds little to the demo.

## Update (2026-11-13)

With [ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md), the skill input is a browser extension that scores prompts locally. That mechanism is track-agnostic: only the typed questions, the site allowlist and the content sources change per track. Rei is now framed as a personal coach for any knowledge work. This decision still holds for the hackathon: **one track ships, Agentic product builder.** What changes is that reports carry a `track` field, a local routing question drops prompts outside the user's tracks, and the job title picks the tracks. See g-browser-skill-meter.md § Vision (notes repo: `g-browser-skill-meter.md`).

## Update: first track is Product manager (2026-11-14)

The one track that ships is now **Product manager** (`product-manager`), not "Agentic product builder". The draft skill questions were product manager skills already, PMs work in AI chat tools, and there's plenty of PM data at every level. Five tracks are planned (product manager, marketing specialist, product designer, software engineer, account executive), each with junior, mid and senior levels. One track still ships for the hackathon. See job-titles-and-skills.md (notes repo: `job-titles-and-skills.md`).

## More information

- Exa rubric: `junction2026_challenges.json` (The Internet Butler / Your Personal Assistant).
- Builds on c-role-model-gap-analysis.md (notes repo: `c-role-model-gap-analysis.md`): same evidence idea, applied to one role and run nightly.
- Future: custom learning tracks set up by the user ("keep me current on X"). Same pipeline, a new seed map, and Websets run on track creation.

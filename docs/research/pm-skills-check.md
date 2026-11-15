# PM skills check with Exa

Ticket: REI-265. Run date: 2026-11-14. Track file checked: `tracks/product-manager/skill-areas.yaml`.

This report checks the 10 draft product manager skill areas against what PMs, PM leaders and employers published between 2025-11-14 and 2026-11-14. It uses Exa podcast episodes, job posts and web articles. It is input for the review ticket (REI-268). It does not change the track file. REI-273 does that after review.

## Summary

---

- Keep 9 areas. Most get new wording for one or two level descriptions.
- Change 1 area: "Working with engineering and design" becomes "Delivery with engineering and design" and takes in backlog, bug and release work.
- Drop no areas.
- Propose 1 new area: "Working with AI agents day to day". Consider a second one, "Business and commercial sense", or fold it into senior strategy.
- Podcast coverage is good for 6 areas. "Working with engineering and design" and "AI product sense" were weak with the first wording, but podcast-style queries fixed most of that. Discovery and go-to-market stay flagged. See [Podcast coverage](#podcast-coverage).
- Exa Podcasts answer for REI-248: Exa Search with `includeDomains: ["exa.ai/library/podcast"]` returns only podcast episodes, and the date filter works. Timestamps: yes. Each transcript turn has a speaker and a start and end time, but only in `text`, not in `highlights`.
- Exa calls used: 109 (69 web, 4 podcast probe, 36 podcast).

## Exa Podcasts API

---

This section answers REI-248 with what the API returned in this run.

### Probe

One query, "what separates a senior product manager from the next level", with the 12-month date window, run 4 ways:

| Option | Request change                               | Podcast episodes in 10 results |
| ------ | -------------------------------------------- | ------------------------------ |
| a      | `includeDomains: ["exa.ai/library/podcast"]` | 10                             |
| b      | `category: "podcast"`                        | 0 (all web articles)           |
| c      | both a and b                                 | 10 (the same 10 as a)          |
| d      | a, with `contents: {"text": true}`           | 10                             |

`category: "podcast"` was accepted but did nothing useful. Option a is the one to use. Category adds nothing on top of it.

### Request shape that works

```json
{
  "query": "product managers talking about stakeholder communication",
  "objective": "Find podcast episodes where product managers or product leaders discuss ...",
  "type": "auto",
  "includeDomains": ["exa.ai/library/podcast"],
  "startPublishedDate": "2025-11-14T00:00:00.000Z",
  "endPublishedDate": "2026-11-14T23:59:59.000Z",
  "contents": { "highlights": true, "text": true }
}
```

- `highlights` gives a short passage to quote.
- `text` gives the full transcript with speakers and timestamps.
- Ask for both only when you need timestamps. `text` is large: about 13,000 to 123,000 characters per episode in this run.

All 36 podcast queries returned 10 episodes each: 360 results, 238 unique episodes. All of them had publish dates inside the window.

### Result fields

Top-level keys of a result: `id`, `title`, `url`, `publishedDate`, `image`, plus `highlights` and `text` when asked for. There is no `author` field. A full sample is in `research-cache/podcast-sample.json` (not committed).

`text` is Markdown with a header and a transcript:

```text
# What great product managers do differently in the age of AI

- **Podcast:** [Insights Unlocked](https://exa.ai/library/podcast/3pjvkfjy55r)
- **Published:** 2026-10-12T07:00:00+00:00
- **Duration:** 41:36.810
- **Language:** en
- **Episode:** 244
- **Hosts:** Nathan Isaacs, Mike Mace
- **Guests:** [Julia Barham](https://exa.ai/library/person/p3dvx0wfhh3)

## Transcript

**Nathan Isaacs · 00:02.143–00:26.056**

Welcome back to Insights Unlocked. ...
```

Source: [What great product managers do differently in the age of AI](https://exa.ai/library/podcast/3pjvkfjy55r/episode/wz7jp7b0nt1) (2026-10-12).

| Field          | Where                             | Present in 166 episodes |
| -------------- | --------------------------------- | ----------------------- |
| Episode title  | `title` and the `#` heading       | 166                     |
| Publish date   | `publishedDate` and **Published** | 166                     |
| Show name      | **Podcast** in `text`             | 166                     |
| Duration       | **Duration** in `text`            | 166                     |
| Language       | **Language** in `text`            | 166                     |
| Episode number | **Episode** in `text`             | 92                      |
| Hosts          | **Hosts** in `text`               | 132                     |
| Guests         | **Guests** in `text`              | 109                     |
| Transcript     | `## Transcript` in `text`         | 166                     |

### Timestamps: yes

- Each transcript turn starts with `**Speaker name · start–end**`, in minutes, seconds and milliseconds. For example `**Yue Zhao · 00:00.031–00:23.365**` in [How to Know You’re Ready for Product Leadership - Yue Zhao](https://exa.ai/library/podcast/9dzy7h8cxdv/episode/k3mbf97cqrr) (2026-09-29).
- Minutes don't roll over into hours. A 97-minute episode has a duration of `96:52.767` ([90 minutes of unfiltered product advice from Snap and Discord’s product chief - Peter Sellis](https://exa.ai/library/podcast/hww2k2by27y/episode/2xpjn7p1dpq) (2026-09-20)).
- Timestamps are per turn, not per word. There is no separate offset field.
- `highlights` has no timestamps and no speaker labels. To get the time of a passage, find the highlight in `text` and take the turn it sits in. That worked for 257 of 260 highlights. A highlight can span turns, and then it carries the raw `**Name · time**` markers inside it.

### Speaker labels: yes, mostly named

12,939 transcript turns in 166 episodes. 831 of them (6%) are labelled "Unidentified Speaker 0", "Unidentified Speaker 1" and so on. The rest have a person's name.

### Cost

The podcast calls cost about the same per call as plain search ($0.007 each in the response's `costDollars`), with or without `text`.

## How this was done

---

### Queries

Web and job posts, run first: for each level (junior, mid-level, senior), 23 Exa Search queries, 69 in total, with `type: "auto"`, highlights, an `objective`, and the date window:

- 2 general web queries that ask about podcasts: "what separates a {level} product manager from the next level" and "how {level} product managers use AI tools in their work". These were run before the Exa podcast library was found. They now count as web results.
- 1 job post query: "{level} product manager job responsibilities 2026".
- 10 "how" and 10 "common mistakes" queries, one per area, from the `exa_queries` in the track file.

Podcasts, run second, with the podcast-only request shape above (26 calls):

- 6 level queries: "what separates a {level} product manager from the next level" and "how {level} product managers use AI tools in their work".
- 10 area queries: "product managers talking about {area}".
- 10 mistakes queries: "mistakes product managers make with {area}".
- 10 tuned queries for the two weakest areas, in podcast wording. See [Tuned queries for weak areas](#tuned-queries-for-weak-areas).

The podcast area queries don't name a level. Level counts for podcasts come from the 6 level queries only.

### Podcasts

Podcast results come only from `exa.ai/library/podcast`. That is Exa's own podcast library, served through Exa Search. I found it because the first run returned some episodes from it. The probe above shows that `includeDomains` is what limits results to podcasts, and that `category: "podcast"` does not.

### Skill extraction and counting

There was no `ANTHROPIC_API_KEY`, so I read the results and did the extraction myself:

1. I read the titles and passages and wrote a list of 19 skills: the 10 draft areas plus 9 candidates that came up.
2. For each skill I wrote a keyword pattern (`scripts/research/pm_skills_count.py`).
3. The scripts match each result's title and highlight. A result counts once per skill per level.
4. For podcasts, `scripts/research/pm_podcasts_count.py` also counts how often each area comes up in the full transcript. An episode with 5 or more matches counts as "about" the area.
5. I read the top passages per area by hand to check the matches, pick sources and write the level changes.
6. For the 10 tuned queries, I judged each result on topic or not by reading its title and passage. The labels are in `TUNED_ON_TOPIC` in `scripts/research/pm_podcasts_count.py`. Keyword hits are shown next to them, because the patterns missed many on-topic results.

Keyword counts are rough. They show how often a skill comes up, not how well. Broad patterns such as "delivery", "metric" or "owns" overcount. Treat counts as a ranking, not a measure.

### Count columns

- **Podcasts**: podcast episodes from the 2 level queries for that level that mention the skill in title or highlight, out of 20.
- **Jobs**: job posts for that level that mention the skill, out of 10.
- **Web**: unique web results for that level that mention the skill, out of about 215.
- **Web on topic**: results from the area's own web queries that match the area, out of 60.
- **Podcast coverage**: episodes from the area's two podcast queries that match the area (talking about / mistakes, out of 10 each), and episodes among all 166 with 5 or more mentions in the transcript.

### Files

- `scripts/research/pm_skills_exa.py`: web and job queries. Cache: `research-cache/pm-skills-exa.json`.
- `scripts/research/pm_podcast_probe.py`: the podcast probe. Cache: `research-cache/podcast-probe.json`.
- `scripts/research/pm_podcasts_exa.py`: podcast queries, including the tuned ones. Cache: `research-cache/pm-skills-podcasts.json`.
- `scripts/research/pm_skills_count.py` and `scripts/research/pm_podcasts_count.py`: counts.
- `research-cache/` is in `.gitignore`. Reruns skip cached queries.

### Limits

- Web area queries return many vendor blogs and SEO guides. I preferred practitioner writing, job posts and podcasts when picking sources.
- Many web pages named "for senior PMs" come from one site (ideaplan.io). They are useful but repetitive.
- Job posts are 10 per level. They are a sample, not a market survey.
- The podcast library has many product marketing (PMM) and agile shows. For some areas, the episodes are about the topic but not from PMs.

## Counts for all skills

---

| Skill                                      | Podcasts (J / M / S, of 20) | Jobs (J / M / S, of 10) | Web (J / M / S) | Web on topic (of 60) |
| ------------------------------------------ | --------------------------- | ----------------------- | --------------- | -------------------- |
| Problem discovery and user research        | 4 / 6 / 4                   | 4 / 6 / 6               | 76 / 77 / 69    | 55                   |
| Writing specs and PRDs                     | 3 / 3 / 4                   | 10 / 9 / 7              | 71 / 63 / 66    | 60                   |
| Prioritization and roadmapping             | 3 / 2 / 2                   | 10 / 9 / 10             | 108 / 121 / 109 | 60                   |
| Metrics and experiments                    | 5 / 4 / 2                   | 7 / 5 / 9               | 101 / 94 / 100  | 60                   |
| Working with engineering and design        | 4 / 3 / 3                   | 10 / 6 / 6              | 61 / 60 / 62    | 29                   |
| Stakeholder communication                  | 6 / 5 / 7                   | 9 / 7 / 10              | 108 / 113 / 113 | 60                   |
| Prototyping with AI tools                  | 8 / 7 / 6                   | 4 / 2 / 3               | 47 / 48 / 53    | 59                   |
| AI product sense                           | 1 / 3 / 3                   | 3 / 3 / 2               | 52 / 42 / 51    | 46                   |
| Go-to-market and launch                    | 2 / 3 / 2                   | 8 / 7 / 10              | 78 / 84 / 81    | 60                   |
| Strategy and vision                        | 4 / 7 / 6                   | 5 / 6 / 9               | 75 / 97 / 83    | 59                   |
| Candidate: delivery and execution          | 8 / 8 / 7                   | 10 / 7 / 9              | 123 / 119 / 109 | n/a                  |
| Candidate: ownership and agency            | 7 / 9 / 5                   | 5 / 7 / 9               | 79 / 94 / 90    | n/a                  |
| Candidate: AI agents in daily work         | 6 / 4 / 6                   | 3 / 3 / 2               | 27 / 37 / 37    | n/a                  |
| Candidate: technical fluency               | 7 / 6 / 4                   | 3 / 4 / 4               | 50 / 52 / 47    | n/a                  |
| Candidate: business and commercial sense   | 4 / 3 / 3                   | 4 / 5 / 5               | 39 / 47 / 45    | n/a                  |
| Candidate: leadership and coaching         | 0 / 1 / 0                   | 3 / 0 / 5               | 16 / 8 / 13     | n/a                  |
| Candidate: customer feedback loops         | 1 / 3 / 3                   | 2 / 4 / 3               | 50 / 39 / 34    | n/a                  |
| Candidate: AI risk, privacy and governance | 0 / 2 / 1                   | 2 / 5 / 3               | 40 / 47 / 48    | n/a                  |
| Candidate: judgment and taste              | 2 / 1 / 2                   | 2 / 2 / 3               | 41 / 49 / 46    | n/a                  |

What the counts say:

- In podcasts, AI prototyping, delivery, stakeholder communication, strategy and using AI agents for daily work come up most. Prioritization and go-to-market come up least, even though every job post names them.
- Delivery work (backlog, bugs, releases) comes up in all 10 junior job posts and in 8 of 20 junior podcast episodes. The draft has no area for it. See the change to "Working with engineering and design".
- Using AI agents for your own PM work comes up in 4 to 6 of 20 podcast episodes per level. It is separate from prototyping.
- Ownership and agency come up a lot, but as a trait, not a skill you can check in a prompt. I don't propose it as an area.
- Leadership and coaching is rare in podcasts (0 / 1 / 0). It stays out of scope for these three levels.

## Podcast coverage

---

The daily job depends on podcasts, so this table shows how much the Exa podcast library has per area. Timestamps are the start of the transcript turn that holds the passage.

| Area                                   | On topic (talking about / mistakes, of 10 each) | Episodes with 5+ mentions (of 166) | Coverage                                        | Best episodes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------- | ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem discovery and user research    | 5 / 4                                           | 31                                 | Medium                                          | Become an Epic Product Engineer, [Start with curiosity and talk to a customer - continuous discovery with Teresa Torres](https://exa.ai/library/podcast/kpdnsp33nml/episode/3sxdmn24r33) (2026-10-07), at 00:37; Product Mastery Now for Product Managers, Leaders, and Innovators, [613: Overcoming the 7 most common weaknesses in product innovation – with Chad McAllister, PhD](https://exa.ai/library/podcast/r61ld4kndgv/episode/nwdfrx0y7jz) (2026-10-12), at 00:00                                                                                                                                                                                                                                                                                                                                                                    |
| Writing specs and PRDs                 | 10 / 8                                          | 27                                 | Good                                            | Fireside Product Management, [I Tested 5 AI Tools to Write a PRD—Here's the Winner](https://exa.ai/library/podcast/smnpcql1dks/episode/lxjfl48q76k) (2025-12-15), at 00:01; Productside Stories, [How AI Is Changing Product Management](https://exa.ai/library/podcast/wgbnj6vw274/episode/zy6xyy1p0vh) (2026-09-15), at 11:32                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Prioritization and roadmapping         | 9 / 10                                          | 57                                 | Good                                            | The Product Experience, [How to fix your product roadmap — Matt Feczko (Director of Product Ops, Ocado Technology)](https://exa.ai/library/podcast/8hk5k9nqx4d/episode/l3br0d8vg0w) (2026-09-23), at 01:01; Scrum Master Toolbox Podcast: Agile storytelling from the trenches, [Great Product Owners Bring Customer Problems, Not Just Backlog Items - Joseph Osei-Kusi](https://exa.ai/library/podcast/w5s67x1b6ht/episode/7dlyk4dz7bz) (2026-10-16), at 01:36                                                                                                                                                                                                                                                                                                                                                                               |
| Metrics and experiments                | 10 / 9                                          | 64                                 | Good                                            | The Experimentation Edge, [How Preply runs close to 1,000 experiments a year](https://exa.ai/library/podcast/x0pwppbjjzz/episode/h6f1p5rb6gc) (2026-11-03), at 00:00; Product Mastery Now for Product Managers, Leaders, and Innovators, [617: Test your gut, don’t trust it –the scientific mindset for product teams – with Stefan Thomke, PhD](https://exa.ai/library/podcast/r61ld4kndgv/episode/c6lvgv1qqrj) (2026-11-09), at 02:19                                                                                                                                                                                                                                                                                                                                                                                                       |
| Working with engineering and design    | 1 / 1 (tuned: 7 of 10)                          | 22                                 | Medium with tuned queries (flag)                | Lenny's Podcast: Product - Growth - Career, [How Anthropic’s product team moves faster than anyone else - Cat Wu (Head of Product, Claude Code)](https://exa.ai/library/podcast/hww2k2by27y/episode/0k80y4r0mpl) (2026-04-23), at 16:15; Productside Stories, [Product and Design Collaboration: AI Can't Judge](https://exa.ai/library/podcast/wgbnj6vw274/episode/5gj7fns8l40) (2026-09-09), at 28:12; Product Management Tech Brief By HackerNoon, [Your PM Can Now Ship Without a Designer. Here's When That's Stupid.](https://exa.ai/library/podcast/zkqpysfq340/episode/ztwf5l1pgh1) (2026-07-01), at 00:00; World-class Designer Podcast, [A Larger Role for Product Design by Marty Cagan](https://exa.ai/library/podcast/tk4jrksv6c8/episode/ck0m3ngrkdt) (2026-09-06), at 00:56                                                     |
| Stakeholder communication              | 10 / 9                                          | 87                                 | Good                                            | Product for Product Management, [EP 161 - Stakeholder Alignment with Joy Adamson](https://exa.ai/library/podcast/gsvqzx9hx7m/episode/mq446q3yvnx) (2026-09-16), at 00:25; The Product Porch, [PM Powerskills- Communication](https://exa.ai/library/podcast/8ldnv939dp8/episode/cjts415xss9) (2026-08-18), at 03:30                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prototyping with AI tools              | 10 / 6                                          | 60                                 | Good                                            | The Growth Podcast, [How to Use Codex Like an OpenAI PM - Abhi Muchhal, PM OpenAI (ex-Meta and Nubank)](https://exa.ai/library/podcast/k785m6dvfmg/episode/g00nn1v41hv) (2026-06-03), at 03:56; How I AI, [Why Reddit built its own AI prototyping tool - Blair Metcalf](https://exa.ai/library/podcast/1s07l76pf5j/episode/4n4lqh5hc4d) (2026-10-26), at 00:00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AI product sense                       | 4 / 2 (tuned: 10 of 10)                         | 31                                 | Good with tuned queries                         | Scrum.org Community Podcast, [Can Versus Should in AI Product Delivery, with David Pereira](https://exa.ai/library/podcast/lmm7xst1lyx/episode/8zp1mdy47pr) (2026-09-10), at 02:24; Lenny's Podcast: Product - Growth - Career, [What OpenAI and Google engineers learned deploying 50+ AI products in production](https://exa.ai/library/podcast/hww2k2by27y/episode/29r319t4t81) (2026-01-11), at 00:08; The Product Experience, [What is AI product management, really? Jonathan Evens (AI Product Lead, Google DeepMind)](https://exa.ai/library/podcast/8hk5k9nqx4d/episode/s98zll8pk5j) (2026-09-16), at 11:40; AI, Product and Design Podcast, [#16 Why 85% of AI Projects Fail - And Why Most Teams Are Still Getting AI Wrong - Greg Nudelman](https://exa.ai/library/podcast/xwfbgmcnvp1/episode/00b4swxnlfy) (2026-06-23), at 12:56 |
| Go-to-market and launch                | 9 / 9                                           | 68                                 | Good, but mostly product marketing shows (flag) | Product Marketing for You, [Your Next Product Launch Could Use a Little Rolling Thunder w/April Dunford](https://exa.ai/library/podcast/7vkmksdy82n/episode/q42xzwpmvgs) (2026-09-01), at 01:34; Habit Machine: AI Product Management, [The Pre-Launch Risk Diagnostic: 6 Patterns That Activate The Launch Kill Switch — Deep Dive Episode 37](https://exa.ai/library/podcast/nbz1tdhnc7q/episode/dr9gvzygqzw) (2026-11-02), at 02:33                                                                                                                                                                                                                                                                                                                                                                                                         |
| Strategy and vision                    | 10 / 9                                          | 68                                 | Good                                            | The Growth Podcast, [How you need to think about product strategy in the age of AI](https://exa.ai/library/podcast/k785m6dvfmg/episode/00fd1yfxq13) (2026-10-14), at 00:00; Roman's Product Management Podcast, [Connecting Product Outcomes and Business Strategy](https://exa.ai/library/podcast/n5q1nqvh30l/episode/83nn4tq1pty) (2026-09-15), at 00:00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| New: working with AI agents day to day | 6 / 4 / 6 in level queries (of 20)              | n/a                                | Good                                            | How I AI, [How Figma’s PMs actually use AI every day - Ezra Mechaber (PM, Figma)](https://exa.ai/library/podcast/1s07l76pf5j/episode/brj34qfs492) (2026-11-02), at 07:13; How I AI, [Claude Code for product managers: research, writing, context libraries, custom to-do system, and more - Teresa Torres](https://exa.ai/library/podcast/1s07l76pf5j/episode/19rwv3b567x) (2026-01-19), at 04:36                                                                                                                                                                                                                                                                                                                                                                                                                                             |

For the two areas changed by tuned queries, the table shows the first-run numbers and the best tuned query. The first two episodes listed are from the tuned queries.

Flags for the daily job:

- **Working with engineering and design**: still a flag, but smaller. The first wording found 1 of 10 per query. The best tuned queries found 7 of 10. Most of those episodes are about roles merging in the AI era ("I think all of the roles are merging", Lenny's Podcast: Product - Growth - Career, [How Anthropic’s product team moves faster than anyone else - Cat Wu (Head of Product, Claude Code)](https://exa.ai/library/podcast/hww2k2by27y/episode/0k80y4r0mpl) (2026-04-23), at 16:15), not about day-to-day work between a PM, a designer and an engineer. "Product trio" found only 1 of 10. Expect enough podcast material for mid and senior checks, and less for junior delivery work.
- **AI product sense**: no longer weak. Podcast wording found 6 to 10 of 10 on topic. Many eval episodes come from engineering shows, not PM shows, so pick sources with care.
- **Go-to-market and launch**: the episodes are on topic, but most come from product marketing shows, for example "Product Marketing for You" and "Product Marketing Adventures". Few are from a PM's point of view.
- **Problem discovery and user research**: 5 and 4 of 10 on topic. Many results were about customer discovery for founders. Not retested.

### Tuned queries for weak areas

Same podcast-only request shape, 10 calls. "On topic" is judged by hand from each result's title and passage. "Keyword hits" uses the area's pattern, for comparison.

| Area                                | Query                                               | On topic (of 10) | Keyword hits (of 10) |
| ----------------------------------- | --------------------------------------------------- | ---------------- | -------------------- |
| Working with engineering and design | "product trio"                                      | 1                | 1                    |
| Working with engineering and design | "product manager and engineering lead relationship" | 7                | 0                    |
| Working with engineering and design | "how PMs work with designers"                       | 7                | 3                    |
| Working with engineering and design | "PM and tech lead trade-offs"                       | 4                | 1                    |
| Working with engineering and design | "shipping with your engineering team"               | 3                | 3                    |
| AI product sense                    | "building AI products"                              | 6                | 5                    |
| AI product sense                    | "AI product manager"                                | 6                | 6                    |
| AI product sense                    | "evals for AI features"                             | 8                | 10                   |
| AI product sense                    | "LLM product decisions"                             | 7                | 6                    |
| AI product sense                    | "when not to use AI in a product"                   | 10               | 2                    |

What this shows:

- Wording matters a lot. For both areas, the plain "product managers talking about {area}" wording did worse than the best podcast-style query.
- "Product trio" mostly matched the word "product" in unrelated shows, such as e-commerce and 3D printing. Only 1 result was about product trios.
- "Shipping with your engineering team" and "PM and tech lead trade-offs" mostly found engineering management episodes with no PM angle.
- "Evals for AI features" is on topic, but only 3 of 10 are from product shows, for example Productside Stories, [AI Evaluation for Product Managers: Why Benchmarks Lie - Productside](https://exa.ai/library/podcast/wgbnj6vw274/episode/m6qp5c1zd5z) (2026-10-20), at 03:12. The rest are engineering and research shows.
- "When not to use AI in a product" found 10 of 10 on topic, but keyword patterns caught only 2. Use hand checks or a model, not keywords, to judge these episodes.

More episodes from the tuned queries:

- Engineering: "The product engineering gap is what we allow ourselves" (The Tech Exec Podcast with Aviv Ben-Yosef, [The Eng-Product Gap](https://exa.ai/library/podcast/1bv44nbw13m/episode/9tn3yfl8p2m) (2026-11-10), at 00:05), and "this handoff between product and engineering systems" (Become an Epic Product Engineer, [Use the product yourself - empathy, architecture, and PM partnership with Rita Kozlov](https://exa.ai/library/podcast/kpdnsp33nml/episode/xzy1hgz9yqj) (2026-09-16), at 05:06).
- AI product sense: "I think the best PMs are ones who like use the model and they actually get to know the model" (The Skip Podcast, [Inside Gemini: How Google Runs Product for Its Model](https://exa.ai/library/podcast/f5355911jrn/episode/t4ynlytjsml) (2026-09-17), at 00:00).

## Area checks

---

Each area has a decision, its counts, level changes, a "Stop" item from the mistakes queries, and sources to start keel checks from. Counts are J / M / S. Podcast coverage is in the table above.

### Problem discovery and user research

| Decision            | Podcasts  | Jobs      | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | --------- | --------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, change junior | 4 / 6 / 4 | 4 / 6 / 6 | 76 / 77 / 69 | 55 / 60      | [User research for product managers: a no-bullshit field guide - Hearsay](https://hearsay.to/blog/user-research-for-product-managers) (2026-03-30); [Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15); [Common user research mistakes (and the fix for each one) - Hearsay](https://hearsay.to/blog/common-user-research-mistakes) (2026-04-11) |

- Podcast: Teresa Torres says "product discovery is just how do we make better decisions about what to build" (Become an Epic Product Engineer, [Start with curiosity and talk to a customer - continuous discovery with Teresa Torres](https://exa.ai/library/podcast/kpdnsp33nml/episode/3sxdmn24r33) (2026-10-07), at 00:37).
- Junior: change "Runs interviews from a script someone else wrote" to "Runs user interviews and reads feedback and usage data, with a senior PM checking the questions." Junior job posts ask juniors to research needs themselves "through conversations, feedback, and product usage" ([Product Manager for AI-Powered Recruiting Platform - CVZilla](https://cvzilla.io/jobs/israel/management/product-management/junior-product-manager--a8f65c782e13a4c630833b622b) (2026-11-08)) and to "Conduct user research and analyze customer feedback" ([Junior Product Manager Job Description Template (2026)](https://resources.rework.com/libraries/job-description-templates/junior-product-manager) (2026-01-01)).
- Mid and senior: keep. Senior PMs "design research programs that span multiple teams, connect discovery insights to business outcomes" ([Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15)).
- Stop: asking "would you use this" ([Common user research mistakes (and the fix for each one) - Hearsay](https://hearsay.to/blog/common-user-research-mistakes) (2026-04-11)), and "Discovery theater. Running research to confirm decisions already made." ([Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15)).

### Writing specs and PRDs

| Decision                       | Podcasts  | Jobs       | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | --------- | ---------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, change junior and senior | 3 / 3 / 4 | 10 / 9 / 7 | 71 / 63 / 66 | 60 / 60      | [Spec-Driven Development for Product Managers and Owners](https://specroot.io/notes/spec-driven-development-for-product-managers/) (2026-10-23); [Common PRD mistakes (and the check that catches each one) · Thinkr](https://usethinkr.com/blog/common-prd-mistakes) (2026-06-04); [Writing Your First PRD as an APM - Prodinja](https://www.pmsynapse.in/blog/writing-your-first-prd-as-apm) (2026-08-19) |

- Podcast: an AI-written PRD without context "it's not going to understand the context of the universe you're in" (Productside Stories, [How AI Is Changing Product Management](https://exa.ai/library/podcast/wgbnj6vw274/episode/zy6xyy1p0vh) (2026-09-15), at 11:32).
- Junior: change "Writes specs from a template, with help" to "Writes clear tickets with user stories and acceptance criteria." Junior job posts list "Writing tickets (user stories and acceptance criteria)" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)) and "well-defined stories, acceptance criteria, and priorities" ([Junior Product Manager at Thinkbrg](https://thinkbrg.wd5.myworkdayjobs.com/en-US/BRG_External_Career_Site/job/Remote---USA/Junior-Product-Manager_JR100993) (2026-08-27)).
- Mid: keep. Add that they draft with AI and then stress-test the draft, as in [How to Write a PRD With AI and Stress-Test It - Uxcel](https://uxcel.com/blog/how-to-write-a-prd-with-ai) (2026-10-07).
- Senior: add "Reviews AI-drafted specs and keeps the decisions and reasons written down." With spec-driven development "the agent drafts it" and the PM owns "the intent", "the review" and "the acceptance" ([Spec-Driven Development for Product Managers and Owners](https://specroot.io/notes/spec-driven-development-for-product-managers/) (2026-10-23)). AI "filled the gaps" with "assumptions I hadn't chosen" ([AI PRDs and prototypes: keep control of product decisions](https://blog.ravi-mehta.com/p/prd-or-prototype-which-should-you) (2026-10-16)).
- Stop: "a solution written before the problem is framed, a success metric that can't fail, acceptance criteria too vague to build" ([Common PRD mistakes (and the check that catches each one) · Thinkr](https://usethinkr.com/blog/common-prd-mistakes) (2026-06-04)).

### Prioritization and roadmapping

| Decision | Podcasts  | Jobs        | Web             | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | --------- | ----------- | --------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep     | 3 / 2 / 2 | 10 / 9 / 10 | 108 / 121 / 109 | 60 / 60      | [Why Product Roadmaps Fail: Problems and How to Fix Them](https://flagup.io/blog/why-most-product-roadmaps-fail-and-how-to-fix-them) (2026-08-21); [Prioritization for Senior Product Managers](https://www.ideaplan.io/skill-levels/prioritization-for-senior-pms) (2026-03-15); [Beyond RICE: A Strategic Framework for Annual Product Planning - Productboard](https://www.productboard.com/blog/strategic-framework-for-annual-planning/) (2025-11-26) |

- Podcast: few level episodes mention it (3 / 2 / 2), but the area queries found 19 of 20 on topic.
- Junior: keep "Keeps a backlog in order". Junior posts say "backlog hygiene" ([Junior Product Manager (remote)](https://jobboard.ph/product-manager_pasig-c355686/2026-11-joyride-superapp_i4274874327) (2026-11-03)) and "apply our prioritisation approach with discipline" ([Junior Product Manager](https://euremotejobs.com/job/junior-product-manager/) (2026-11-05)).
- Mid: keep. A mid post asks PMs to "recommend priorities, and communicate trade-offs among customer value, business impact, effort, and risk" ([Product Manager (Hybrid) – Strommen Center for Meaningful Work Augsburg University](https://careers.augsburg.edu/jobs/mtrade-llc-product-manager-hybrid/) (2026-11-10)).
- Senior: keep. Senior PMs make "investment allocation across multiple initiatives" ([Prioritization for Senior Product Managers](https://www.ideaplan.io/skill-levels/prioritization-for-senior-pms) (2026-03-15)).
- Stop: the "order take" product owner who "had become a pass-through for stakeholders' requests" (Scrum Master Toolbox Podcast: Agile storytelling from the trenches, [Great Product Owners Bring Customer Problems, Not Just Backlog Items - Joseph Osei-Kusi](https://exa.ai/library/podcast/w5s67x1b6ht/episode/7dlyk4dz7bz) (2026-10-16), at 01:36), and a roadmap that is a feature list where "Nobody can say what any of them is supposed to change" ([Why Product Roadmaps Fail: Problems and How to Fix Them](https://flagup.io/blog/why-most-product-roadmaps-fail-and-how-to-fix-them) (2026-08-21)).

### Metrics and experiments

| Decision            | Podcasts  | Jobs      | Web            | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | --------- | --------- | -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, change junior | 5 / 4 / 2 | 7 / 5 / 9 | 101 / 94 / 100 | 60 / 60      | [16 Key Data Skills for PMs in the AI Era (Second is Crucial)](https://productschool.com/blog/product-fundamentals/data-skills-for-product-managers) (2026-11-09); [The Right KPIs for Product Managers (and Why Most Teams Track the Wrong Ones)](https://pmread.org/blog/product-manager-kpi) (2026-04-26); [10 Mistakes Product Managers Make When Scaling A/B Testing](https://absmartly.framer.website/blog/10-mistakes-product-managers-make-when-scaling-a-b-testing) (2025-12-05) |

- Podcast: "The second element is the ability to articulate testable hypotheses" (Product Mastery Now for Product Managers, Leaders, and Innovators, [617: Test your gut, don’t trust it –the scientific mindset for product teams – with Stefan Thomke, PhD](https://exa.ai/library/podcast/r61ld4kndgv/episode/c6lvgv1qqrj) (2026-11-09), at 02:19).
- Junior: change "Tracks the metrics they're given" to "Reads product metrics and reports how their features perform." Junior posts ask juniors to "Analyze product metrics and user data to measure feature performance" ([Junior Product Manager Job Description Template (2026)](https://resources.rework.com/libraries/job-description-templates/junior-product-manager) (2026-01-01)) and to "Set success metrics, monitor product performance" ([Product Manager for AI-Powered Recruiting Platform - CVZilla](https://cvzilla.io/jobs/israel/management/product-management/junior-product-manager--a8f65c782e13a4c630833b622b) (2026-11-08)).
- Mid: keep. Add evaluating AI output as a data skill: the list of "core data skills for AI PMs" starts with "metric design, AI output evaluation" ([16 Key Data Skills for PMs in the AI Era (Second is Crucial)](https://productschool.com/blog/product-fundamentals/data-skills-for-product-managers) (2026-11-09)).
- Senior: keep. Senior PMs "own the metric architecture that connects product performance to business outcomes" ([Metrics & Analytics for Senior Product Managers](https://www.ideaplan.io/skill-levels/metrics-for-senior-pms) (2026-03-15)).
- Stop: an experiment program "where you are embarrassed of failure", which "is going to end up lying to you" (The Experimentation Edge, [How Preply runs close to 1,000 experiments a year](https://exa.ai/library/podcast/x0pwppbjjzz/episode/h6f1p5rb6gc) (2026-11-03), at 00:00), and tracking output as KPIs ("Features launched, bugs closed, sprints completed ... These are not KPIs", [The Right KPIs for Product Managers (and Why Most Teams Track the Wrong Ones)](https://pmread.org/blog/product-manager-kpi) (2026-04-26)).

### Working with engineering and design

| Decision                                                 | Podcasts  | Jobs       | Web          | Web on topic   | Sources                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------- | ---------- | ------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change: rename to "Delivery with engineering and design" | 4 / 3 / 3 | 10 / 6 / 6 | 61 / 60 / 62 | 29 / 60 (flag) | [Why Product Triads Break Down (And How to Fix Them) - QuestWorks](https://www.questworks.io/blog/product-triad-dynamics.html) (2026-04-17); [Cross-Functional Collaboration Survival Guide](https://ambacia.eu/careers-post/cross-functional-collaboration-survival-guide/) (2026-01-30); [Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09) |

- Why: only 29 of 60 web results and 2 of 20 podcast results from this area's own first-wording queries were about it. Tuned podcast queries found up to 7 of 10, mostly about roles merging. But delivery work came up in every junior job post and in 8 of 20 podcast episodes per level. Junior posts are full of it: "Manage and facilitate agile ceremonies" ([Junior Product Manager at Thinkbrg](https://thinkbrg.wd5.myworkdayjobs.com/en-US/BRG_External_Career_Site/job/Remote---USA/Junior-Product-Manager_JR100993) (2026-08-27)), "backlog hygiene, documentation, milestone tracking, and release readiness" ([Junior Product Manager (remote)](https://jobboard.ph/product-manager_pasig-c355686/2026-11-joyride-superapp_i4274874327) (2026-11-03)), "Triage bugs and support issues" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)). Merging delivery into this area gives it real evidence.
- Podcast: AI tools change the hand-offs. "The old model was sequential and clear. I wrote a PRD. A designer turned it into mockups over three to five days." (Product Management Tech Brief By HackerNoon, [Your PM Can Now Ship Without a Designer. Here's When That's Stupid.](https://exa.ai/library/podcast/zkqpysfq340/episode/ztwf5l1pgh1) (2026-07-01), at 00:00).
- Junior: change "Answers questions and writes tickets" to "Runs the backlog, triages bugs and checks release readiness."
- Mid: change "Breaks work into steps with the team and handles scope changes" to "Brings design and engineering in while the problem is still open, then handles scope changes." The common mistake is "defining solutions before engaging design" ([Cross-Functional Collaboration Survival Guide](https://ambacia.eu/careers-post/cross-functional-collaboration-survival-guide/) (2026-01-30)).
- Senior: keep. Senior posts ask for "strong cross-functional leadership, influencing engineering, research, and business teams" without people management ([Senior Product Manager - Job Detail - Careers Marketplace - Siemens](https://jobs.siemens.com/en_US/externaljobs/JobDetail/526716) (2026-10-21)).
- Stop: "PM dominates and the team becomes a feature factory" ([Why Product Triads Break Down (And How to Fix Them) - QuestWorks](https://www.questworks.io/blog/product-triad-dynamics.html) (2026-04-17)). Marty Cagan on feature teams: "These are called feature teams. These are very, very common." (World-class Designer Podcast, [A Larger Role for Product Design by Marty Cagan](https://exa.ai/library/podcast/tk4jrksv6c8/episode/ck0m3ngrkdt) (2026-09-06), at 00:56).

### Stakeholder communication

| Decision               | Podcasts  | Jobs       | Web             | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | --------- | ---------- | --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, small mid change | 6 / 5 / 7 | 9 / 7 / 10 | 108 / 113 / 113 | 60 / 60      | [Stakeholder Communication - IdeaPlan](https://www.ideaplan.io/blog/stakeholder-communication-for-pms) (2026-02-19); [Stakeholder Management for Product Teams: Show Your ...](https://www.producttalk.org/stakeholder-management/) (2026-03-04); [Stakeholder Management for Product Managers](https://makeitnice.de/en/guides/stakeholder-management/) (2025-12-09) |

- Podcast: the best-covered area (87 episodes with 5+ mentions). For example "I think it's so obvious for a product person to be a good communicator" (The Product Porch, [PM Powerskills- Communication](https://exa.ai/library/podcast/8ldnv939dp8/episode/cjts415xss9) (2026-08-18), at 03:30).
- Junior: keep.
- Mid: change "Writes clear updates and handles pushback" to "Writes clear updates for each audience and influences without authority." Mid-level stakeholder work is "influencing without authority" ([Stakeholder Management for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/stakeholder-management-for-mid-level-pms) (2026-03-15)).
- Senior: keep. A survey of senior PMs, Group PMs and Directors found "I struggle to communicate my impact so leadership hears it" among the top three themes ([Why Strong Directors Stall Before VP](https://elenasletters.substack.com/p/why-strong-directors-stall-before) (2025-12-12)).
- Stop: "using the same language and level of detail for every audience" ([Stakeholder Management for Product Managers](https://makeitnice.de/en/guides/stakeholder-management/) (2025-12-09)), and giving executives options instead of a recommendation ([Stakeholder Communication - IdeaPlan](https://www.ideaplan.io/blog/stakeholder-communication-for-pms) (2026-02-19)).

### Prototyping with AI tools

| Decision                    | Podcasts  | Jobs      | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | --------- | --------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, change junior and mid | 8 / 7 / 6 | 4 / 2 / 3 | 47 / 48 / 53 | 59 / 60      | [AI Prototyping for PMs - Wix Co-Founder Masterclass](https://www.news.aakashg.com/p/nadav-abrahami-podcast) (2026-02-27); [Where does a PM's prototype stop? - by Uditi Sharma](https://productwithuditi.substack.com/p/where-does-a-pms-prototype-stop) (2026-10-11); [How product managers should prototype with AI](https://farhorizons.io/writing/how-product-managers-prototype-with-ai) (2026-10-05) |

- Podcast: the top podcast skill at junior level (8 of 20). An OpenAI PM: "Engineering does not have bandwidth. I'm just gonna build it, and I'm able to take it to 80%" (The Growth Podcast, [How to Use Codex Like an OpenAI PM - Abhi Muchhal, PM OpenAI (ex-Meta and Nubank)](https://exa.ai/library/podcast/k785m6dvfmg/episode/g00nn1v41hv) (2026-06-03), at 03:56).
- Junior: change "Uses Lovable, v0 or Claude to make simple mock-ups" to "Builds clickable prototypes with AI tools so the team sees a working example." A junior post asks for this directly: "Use AI tools to prototype, spec and test ideas quickly, so the team sees working examples, not just documents" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)).
- Mid: change "Builds working prototypes to test ideas with users" to "Builds working prototypes with the real prompt and realistic data, and tests them with users." For AI features "The riskier question is usually what the model will say", so "Use the real prompt" and "Use real or realistic data" ([Where does a PM's prototype stop? - by Uditi Sharma](https://productwithuditi.substack.com/p/where-does-a-pms-prototype-stop) (2026-10-11)).
- Senior: keep. A senior post asks PMs to "build working prototypes, and write persuasive specs" ([Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05)). At team level, Reddit built a harness that "keeps all the designers and product managers on rails" (How I AI, [Why Reddit built its own AI prototyping tool - Blair Metcalf](https://exa.ai/library/podcast/1s07l76pf5j/episode/4n4lqh5hc4d) (2026-10-26), at 00:00).
- Stop: prototyping before the problem is clear. "AI prototyping tools don't replace problem space work" ([AI Prototyping for PMs - Wix Co-Founder Masterclass](https://www.news.aakashg.com/p/nadav-abrahami-podcast) (2026-02-27)). Also, tools "fill the gap with a confident default" when the spec is missing ([AI Prototyping for Product Managers: 4 Levels, 5 Inputs](https://www.rodriguezjimmy.com/blog/ai-prototyping-for-product-managers) (2026-08-11)).

### AI product sense

| Decision                                | Podcasts  | Jobs      | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | --------- | --------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keep, change junior, flag thin evidence | 1 / 3 / 3 | 3 / 3 / 2 | 52 / 42 / 51 | 46 / 60      | [AI Product Sense: A Practical, 2026 Guide for PMs](https://productschool.com/blog/ai-for-product-managers/ai-product-sense) (2026-11-06); [What Product Managers Get Wrong Building with LLMs - ProdLabs](https://prodlabs.co/what-pms-get-wrong-llms/) (2026-05-15); [How to build AI product sense - by Tal Raviv and Aman Khan](https://www.lennysnewsletter.com/p/how-to-build-ai-product-sense) (2026-02-03) |

- Flag: job posts and web queries mention it less than most areas. Podcast coverage was weak with the first wording (4 and 2 of 10 on topic) and good with podcast-style queries (6 to 10 of 10).
- Podcast: a Google DeepMind AI product lead says the AI feature PM role has "new skills that I think are needed" (The Product Experience, [What is AI product management, really? Jonathan Evens (AI Product Lead, Google DeepMind)](https://exa.ai/library/podcast/8hk5k9nqx4d/episode/s98zll8pk5j) (2026-09-16), at 11:40).
- Junior: change "Knows what LLMs can and can't do" to "Knows what LLMs can and can't do, and checks AI output instead of trusting it." The most costly AI mistakes "come from the same habit: trusting a model's output without validating it" ([Common Mistakes When Using AI as a Product Manager - Founderz](https://founderz.com/blog/common-mistakes-using-ai-product-manager/) (2026-07-16)). Junior AI PMs often "measure their AI product like a SaaS product" ([The mistake I see junior AI PMs make: - Anand Sagar](https://www.linkedin.com/posts/anandsagartech_aipm-productmanagement-ai-activity-7476857858379149312-9cH3) (2026-06-28)).
- Mid: keep. AI PMs add "model selection, eval design, cost/quality/latency triangulation, and AI-failure UX" ([What Does an AI Product Manager Do? The Real Day-to-Day Work in 2026](https://www.institutepm.com/knowledge-hub/what-does-an-ai-product-manager-do) (2026-05-12)).
- Senior: keep. Add trust: "Trust becomes a core product requirement" ([AI Product Sense: A Practical, 2026 Guide for PMs](https://productschool.com/blog/ai-for-product-managers/ai-product-sense) (2026-11-06)).
- Stop: "Treating the demo as proof the feature works" ([What Product Managers Get Wrong Building with LLMs - ProdLabs](https://prodlabs.co/what-pms-get-wrong-llms/) (2026-05-15)), and picking the wrong problem: "So number one is the wrong use case." (AI, Product and Design Podcast, [#16 Why 85% of AI Projects Fail - And Why Most Teams Are Still Getting AI Wrong - Greg Nudelman](https://exa.ai/library/podcast/xwfbgmcnvp1/episode/00b4swxnlfy) (2026-06-23), at 12:56).

### Go-to-market and launch

| Decision                                        | Podcasts  | Jobs       | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------- | ---------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep, flag thin junior and PM-specific evidence | 2 / 3 / 2 | 8 / 7 / 10 | 78 / 84 / 81 | 60 / 60      | [Go-to-market strategy for product managers](https://producthq.org/product-strategy/go-to-market-strategy-for-product-managers/) (2026-09-14); [B2B SaaS product launch framework - Zack Alami](https://zackalami.com/b2b-saas-product-launch/) (2026-02-12); [Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05) |

- Flag: the junior web query mostly found product marketing (PMM) pages, such as [Junior Product Marketing Manager Skills Framework - GTM Playbook](https://discover.gtmplaybook.co/junior-pmm-skills-framework) (2026-03-01). Podcasts have plenty on launches, but mostly from PMM shows. Junior PM posts mention launch only as support work, for example "help take products to market" ([Junior Product Manager](https://euremotejobs.com/job/junior-product-manager/) (2026-11-05)).
- Podcast: April Dunford "was in-house for 25-ish years and did a lot of product launches" (Product Marketing for You, [Your Next Product Launch Could Use a Little Rolling Thunder w/April Dunford](https://exa.ai/library/podcast/7vkmksdy82n/episode/q42xzwpmvgs) (2026-09-01), at 01:34).
- Junior: keep "Helps with launch checklists". Release readiness sits better in the delivery area.
- Mid: keep. The PM makes sure "the product story, readiness, packaging, and success criteria fit the way we plan to sell" ([Go-to-market strategy for product managers](https://producthq.org/product-strategy/go-to-market-strategy-for-product-managers/) (2026-09-14)).
- Senior: keep. A senior post says "Take what you build to market: shape positioning, pricin[g]" ([Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05)).
- Stop: "treating the launch as a marketing event instead of a business outcome" ([B2B SaaS product launch framework - Zack Alami](https://zackalami.com/b2b-saas-product-launch/) (2026-02-12)). "Products fail because the team completely misunderstood the market" (Habit Machine: AI Product Management, [The Pre-Launch Risk Diagnostic: 6 Patterns That Activate The Launch Kill Switch — Deep Dive Episode 37](https://exa.ai/library/podcast/nbz1tdhnc7q/episode/dr9gvzygqzw) (2026-11-02), at 02:33).

### Strategy and vision

| Decision                    | Podcasts  | Jobs      | Web          | Web on topic | Sources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | --------- | --------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keep, change mid and senior | 4 / 7 / 6 | 5 / 6 / 9 | 75 / 97 / 83 | 59 / 60      | [Strategy for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/strategy-for-mid-level-pms) (2026-03-15); [The 10 Product Strategy Mistakes I Keep Seeing (After 10+ Years in SaaS) - Dr. Joshua Read](https://drjoshuaread.com/10-product-strategy-mistakes/) (2026-03-03); [What Is Product Strategy Really? The Mistake Junior PMs Make in Interviews • Saro Builds](https://sarobuilds.com/what-is-product-strategy-really-the-mistake-junior-pms-make-in-interviews/) (2026-05-19) |

- Podcast: "The fundamental questions you answer in product strategy do not change." (The Growth Podcast, [How you need to think about product strategy in the age of AI](https://exa.ai/library/podcast/k785m6dvfmg/episode/00fd1yfxq13) (2026-10-14), at 00:00).
- Junior: keep "Understands the product strategy". The junior mistake is thinking strategy is the roadmap ([What Is Product Strategy Really? The Mistake Junior PMs Make in Interviews • Saro Builds](https://sarobuilds.com/what-is-product-strategy-really-the-mistake-junior-pms-make-in-interviews/) (2026-05-19)).
- Mid: change "Connects their features to the strategy" to "Writes the strategy for their own product area, tied to company goals." Mid PMs "create strategies for your product area" ([Strategy for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/strategy-for-mid-level-pms) (2026-03-15)). A mid post says "Own the strategy, roadmap, and priorities for an assigned product or product area" ([Mid-level Product Manager @ PDI Technologies - TA Associates Job Board](https://careers.ta.com/companies/pdi-technologies/jobs/97498228-mid-level-product-manager) (2026-10-20)).
- Senior: change "Writes the strategy and vision for a product area" to "Owns the strategy for a domain or several products, and ties it to commercial results." Senior PMs own "a larger, more complex, or strategic product or group of products" with "a clear view of commercial impact" ([Senior Product Manager at Thomsonreuters](https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site/job/Senior-Product-Manager_JREQ204205) (2026-10-14)). "You own a domain, not a feature" (["Path From PM to Senior PM and Group PM: The 18-36 Month Map"](https://resources.rework.com/guides/product-manager-playbooks/pm-to-senior-pm-and-gpm-path) (2026-04-28)). Roman Pichler: "products are often disconnected from the business strategy" (Roman's Product Management Podcast, [Connecting Product Outcomes and Business Strategy](https://exa.ai/library/podcast/n5q1nqvh30l/episode/83nn4tq1pty) (2026-09-15), at 00:00).
- Stop: "Confusing Activity with Progress" ([The 10 Product Strategy Mistakes I Keep Seeing (After 10+ Years in SaaS) - Dr. Joshua Read](https://drjoshuaread.com/10-product-strategy-mistakes/) (2026-03-03)).

## Proposed new areas

---

### Working with AI agents day to day

Recommended. This is how a PM uses AI agents for their own work: context files, reusable skills, automations, and checking what the agent did. It is not prototyping and not AI product sense. It is also close to what Triplekeel scores, since it is about how PMs prompt.

- Counts: 6 / 4 / 6 in podcasts (of 20), 3 / 3 / 2 in jobs, 27 / 37 / 37 on the web.
- Podcast sources: a Figma PM: "I run this skill what's up like six times a day" (How I AI, [How Figma’s PMs actually use AI every day - Ezra Mechaber (PM, Figma)](https://exa.ai/library/podcast/1s07l76pf5j/episode/brj34qfs492) (2026-11-02), at 07:13). Teresa Torres on her own Claude Code task system: "this is exactly the type of thing that you should build for yourself" (How I AI, [Claude Code for product managers: research, writing, context libraries, custom to-do system, and more - Teresa Torres](https://exa.ai/library/podcast/1s07l76pf5j/episode/19rwv3b567x) (2026-01-19), at 04:36).
- Web source: "98% of PMs use AI daily, but only 39% have role-specific training" ([EP 102 The Future-Proof PM: AI Skills & How to Develop Them](https://www.productcoalition.com/p/ep-102-the-future-proof-pm-ai-skills) (2026-05-21)).
- Draft levels:
  - Junior: uses AI assistants for drafts, notes and research, and checks the output.
  - Mid: keeps context files and reusable prompts or skills, and automates routine work.
  - Senior: builds a shared AI workflow for the team, as in LaunchPod - Product Management Podcast, [This Product Leader Built Her Own PM OS with Claude Code: LIVE Demo - Parul Goel (ex-Indeed/PayPal)](https://exa.ai/library/podcast/f9yxzsssqzn/episode/cpnrry9dzmt) (2026-08-18), at 02:58.
- Stop: trusting output without checking it ([Common Mistakes When Using AI as a Product Manager - Founderz](https://founderz.com/blog/common-mistakes-using-ai-product-manager/) (2026-07-16)).

### Business and commercial sense

Optional. Senior job posts and "next level" sources often name it. It could be its own area or part of senior strategy, as proposed above.

- Counts: 4 / 3 / 3 in podcasts, 4 / 5 / 5 in jobs, 39 / 47 / 45 on the web.
- Sources: [Senior Product Manager at Thomsonreuters](https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site/job/Senior-Product-Manager_JREQ204205) (2026-10-14) ("a clear view of commercial impact"); [Senior Product Manager at Equifax](https://equifax.wd5.myworkdayjobs.com/en-US/External/job/Senior-Product-Manager_J00179418) (2026-11-05) ("segmentation, market sizing, and competitive analysis"); Julia Barham on PMs as "managers of value" (Insights Unlocked, [What great product managers do differently in the age of AI](https://exa.ai/library/podcast/3pjvkfjy55r/episode/wz7jp7b0nt1) (2026-10-12), at 04:38).
- Recommendation: fold it into senior strategy for the MVP, and revisit if the review wants a separate area.

### Not proposed

- Ownership and agency: comes up often (7 / 9 / 5 in podcasts) but as a trait, for example "proactivity, curiosity, and resilience" ([The Three Things Great PMs Have That You Cannot Coach](https://productsthatcount.com/opentable-product-svp-on-the-three-things-great-pms-have-that-you-cannot-coach/) (2026-06-12)). It is hard to check in a prompt.
- Leadership and coaching: rare (0 / 1 / 0 in podcasts), and mostly about moving from Director to VP ([Why Strong Directors Stall Before VP](https://elenasletters.substack.com/p/why-strong-directors-stall-before) (2025-12-12)).

## Suggested Exa queries for the daily job

---

Podcasts come first. Use the podcast-only request shape from [Exa Podcasts API](#exa-podcasts-api): `includeDomains: ["exa.ai/library/podcast"]`, highlights and text, an `objective`, and a date window. For a daily job, a window of the last 7 to 30 days fits better than 12 months. Use web queries as a backup for areas with weak podcast coverage. Replace {level} with junior, mid-level or senior.

| Area                                    | Podcast queries                                                                                                                              | Web backup                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Problem discovery and user research     | "product managers talking about user interviews and continuous discovery"; "mistakes product managers make with user research"               | "how {level} product managers run user interviews now"                      |
| Writing specs and PRDs                  | "product managers talking about writing specs and PRDs"; "product managers writing PRDs with AI"                                             | "common PRD mistakes engineers complain about"                              |
| Prioritization and roadmapping          | "product managers talking about prioritization and roadmapping"; "mistakes product managers make with prioritization and roadmapping"        | "why product roadmaps fail"                                                 |
| Metrics and experiments                 | "product managers talking about metrics and experiments"; "mistakes product managers make with A/B tests"                                    | "how product managers evaluate AI feature quality"                          |
| Delivery with engineering and design    | "how PMs work with designers" (7 of 10); "product manager and engineering lead relationship" (7 of 10). Avoid "product trio" (1 of 10).      | "how junior product managers run backlog, bug triage and release readiness" |
| Stakeholder communication               | "product managers talking about stakeholder communication"; "mistakes product managers make with stakeholder communication"                  | "how {level} product managers write stakeholder updates"                    |
| Prototyping with AI tools               | "product managers talking about prototyping with AI tools"; "mistakes product managers make with prototyping with AI tools"                  | "AI prototyping mistakes product managers make"                             |
| AI product sense                        | "when not to use AI in a product" (10 of 10); "LLM product decisions" (7 of 10); "evals for AI features" (8 of 10, mostly engineering shows) | "how product managers design evals and handle LLM failure modes"            |
| Go-to-market and launch                 | "product managers talking about launching a product with marketing and sales"; "mistakes product managers make with go-to-market and launch" | "senior product manager positioning and pricing decisions"                  |
| Strategy and vision                     | "product managers talking about strategy and vision"; "mistakes product managers make with strategy and vision"                              | "how {level} product managers write a product strategy"                     |
| Working with AI agents day to day (new) | "how {level} product managers use AI tools in their work"; "product managers showing their AI workflow with Claude Code, Codex or Cursor"    | "how {level} product managers use AI agents in their daily work"            |

Notes for the job:

- The "talking about {area}" and "mistakes ... with {area}" wording worked for 7 areas. For engineering and design and for AI product sense, use the tested queries above. For discovery and go-to-market, the queries above are untested. Check their on-topic rate before relying on them.
- The daily job should not judge podcast episodes with keyword patterns alone. They missed most on-topic results for some queries.
- For go-to-market, add "from a product manager's point of view, not product marketing" to the `objective`.
- Keep `text` only when you need timestamps or speakers. Use the highlight to find the turn, then take its start time.

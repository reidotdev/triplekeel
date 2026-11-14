# PM skills check with Exa

Ticket: REI-265. Run date: 2026-11-14. Track file checked: `tracks/product-manager/skill-areas.yaml`.

This report checks the 10 draft product manager skill areas against what PMs, PM leaders and employers published between 2025-11-14 and 2026-11-14. It is input for the review ticket (REI-268). It does not change the track file. REI-273 does that after review.

## Summary

---

- Keep 9 areas. Most get new wording for one or two level descriptions.
- Change 1 area: "Working with engineering and design" becomes "Delivery with engineering and design" and takes in backlog, bug and release work.
- Drop no areas. Every area had sources in all three levels.
- Propose 1 new area: "Working with AI agents day to day". Consider a second one, "Business and commercial sense", or fold it into strategy.
- Flag thin evidence: "Working with engineering and design" (29 of 60 results on topic), "AI product sense" at mid and senior in podcasts and job posts, and "Go-to-market and launch" at junior level.
- Exa calls used: 69 of the 300 budget.

## How this was done

---

### Queries

For each level (junior, mid-level, senior) the script ran 23 Exa Search queries, 69 in total:

- 2 podcast queries: "what separates a {level} product manager from the next level" and "how {level} product managers use AI tools in their work".
- 1 job post query: "{level} product manager job responsibilities 2026".
- 10 "how" queries and 10 "common mistakes" queries, one per area. The wording comes from the `exa_queries` in the track file.

### Exa request

Each call used `POST /search` with `type: "auto"`, `contents: {"highlights": true}`, an `objective`, and a hard date window (`startPublishedDate` 2025-11-14, `endPublishedDate` 2026-11-14). No domain or category filters. Each call returned 10 results: 690 results, 450 unique URLs. Every result had a publish date.

### Podcasts

The Exa Podcasts API question (REI-248) has no answer yet. So the podcast queries use Exa Search, with "podcast:" in the query and an `objective` that ranks podcast episodes, transcripts and show notes first. Most podcast results were episode pages, transcripts or show notes. Some were newsletters and guides. Exa Search did return some podcast transcripts hosted on exa.ai itself, for example [How to Know You’re Ready for Product Leadership - Yue Zhao](https://exa.ai/library/podcast/9dzy7h8cxdv/episode/k3mbf97cqrr) (2026-09-29). That may help answer REI-248.

### Skill extraction and counting

There was no `ANTHROPIC_API_KEY`, so I read the results and did the extraction myself:

1. I read the titles and passages of all 69 queries and wrote a list of 19 skills: the 10 draft areas plus 9 candidates that came up.
2. For each skill I wrote a keyword pattern (`scripts/research/pm_skills_count.py`).
3. The script matched each result's title and passages. A result counts once per skill per level.
4. I read the top passages per area by hand to check the matches, pick sources and write the level changes.

Keyword counts are rough. They show how often a skill comes up, not how well. Broad patterns such as "delivery" or "owns" overcount. Treat counts as a ranking, not a measure.

### Count columns

- **Podcasts and jobs**: results from the podcast and job post queries for that level that mention the skill, out of 30. These queries don't name an area, so they are the fairest test of how often an area comes up.
- **All results**: unique results for that level that mention the skill, out of about 215.
- **On topic**: results from the area's own "how" and "mistakes" queries that actually match the area, out of 60. A low number means Exa found little that is about the area.

### Files

- `scripts/research/pm_skills_exa.py` runs the queries and caches raw results in `research-cache/pm-skills-exa.json`. Reruns skip cached queries.
- `scripts/research/pm_skills_count.py` counts skills and writes `research-cache/pm-skills-counts.json`.
- `research-cache/` is in `.gitignore`. The cache keeps each result's URL, title, publish date and passages.

### Limits

- Area queries return many vendor blogs and SEO guides. I preferred practitioner writing and job posts when picking sources.
- Many pages named "for senior PMs" come from one site (ideaplan.io). They are useful but repetitive.
- Job posts are 10 per level. They are a sample, not a market survey.

## Counts for all skills

---

| Skill | Podcasts and jobs (J / M / S, of 30) | All results (J / M / S) | On topic (of 60) |
| --- | --- | --- | --- |
| Problem discovery and user research | 7 / 10 / 10 | 76 / 77 / 69 | 55 |
| Writing specs and PRDs | 16 / 15 / 13 | 71 / 63 / 66 | 60 |
| Prioritization and roadmapping | 13 / 14 / 15 | 108 / 121 / 109 | 60 |
| Metrics and experiments | 9 / 10 / 15 | 101 / 94 / 100 | 60 |
| Working with engineering and design | 13 / 11 / 11 | 61 / 60 / 62 | 29 |
| Stakeholder communication | 16 / 17 / 18 | 108 / 113 / 113 | 60 |
| Prototyping with AI tools | 13 / 11 / 11 | 47 / 48 / 53 | 59 |
| AI product sense | 8 / 5 / 6 | 52 / 42 / 51 | 46 |
| Go-to-market and launch | 11 / 12 / 15 | 78 / 84 / 81 | 60 |
| Strategy and vision | 15 / 16 / 16 | 75 / 97 / 83 | 59 |
| Candidate: delivery and execution | 20 / 17 / 18 | 123 / 119 / 109 | n/a |
| Candidate: ownership and agency | 15 / 16 / 17 | 79 / 94 / 90 | n/a |
| Candidate: AI agents in daily work | 10 / 11 / 10 | 27 / 37 / 37 | n/a |
| Candidate: technical fluency | 10 / 11 / 10 | 50 / 52 / 47 | n/a |
| Candidate: business and commercial sense | 6 / 6 / 7 | 39 / 47 / 45 | n/a |
| Candidate: leadership and coaching | 6 / 2 / 7 | 16 / 8 / 13 | n/a |
| Candidate: customer feedback loops | 6 / 4 / 3 | 50 / 39 / 34 | n/a |
| Candidate: AI risk, privacy and governance | 3 / 6 / 6 | 40 / 47 / 48 | n/a |
| Candidate: judgment and taste | 4 / 5 / 5 | 41 / 49 / 46 | n/a |

What the counts say:

- Delivery work (backlog, bugs, releases) is the most common theme in junior job posts. The draft has no area for it. See the change to "Working with engineering and design".
- Ownership and agency come up a lot, but as a trait, not a skill you can check in a prompt. I don't propose it as an area.
- Using AI agents for daily PM work comes up in about a third of podcast and job results at every level. It is separate from prototyping.
- Leadership and coaching is rare and mostly about Director and VP roles. It stays out of scope for these three levels.

## Area checks

---

Each area has a decision, its counts, level changes, a "Stop" item from the mistakes queries, and 2 or 3 sources to start keel checks from. Counts are J / M / S.

### Problem discovery and user research

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change junior | 7 / 10 / 10 | 76 / 77 / 69 | 55 / 60 | [User research for product managers: a no-bullshit field guide - Hearsay](https://hearsay.to/blog/user-research-for-product-managers) (2026-03-30); [Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15); [Common user research mistakes (and the fix for each one) - Hearsay](https://hearsay.to/blog/common-user-research-mistakes) (2026-04-11) |

- Junior: change "Runs interviews from a script someone else wrote" to "Runs user interviews and reads feedback and usage data, with a senior PM checking the questions." Junior job posts ask juniors to research needs themselves "through conversations, feedback, and product usage" ([Product Manager for AI-Powered Recruiting Platform - CVZilla](https://cvzilla.io/jobs/israel/management/product-management/junior-product-manager--a8f65c782e13a4c630833b622b) (2026-11-08)) and to "Conduct user research and analyze customer feedback" ([Junior Product Manager Job Description Template (2026)](https://resources.rework.com/libraries/job-description-templates/junior-product-manager) (2026-01-01)).
- Mid and senior: keep. Senior PMs "design research programs that span multiple teams, connect discovery insights to business outcomes" ([Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15)).
- Stop: asking "would you use this" ([Common user research mistakes (and the fix for each one) - Hearsay](https://hearsay.to/blog/common-user-research-mistakes) (2026-04-11)), and "Discovery theater. Running research to confirm decisions already made." ([Discovery for Senior Product Managers](https://www.ideaplan.io/skill-levels/discovery-for-senior-pms) (2026-03-15)).

### Writing specs and PRDs

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change junior and senior | 16 / 15 / 13 | 71 / 63 / 66 | 60 / 60 | [Spec-Driven Development for Product Managers and Owners](https://specroot.io/notes/spec-driven-development-for-product-managers/) (2026-10-23); [Common PRD mistakes (and the check that catches each one) · Thinkr](https://usethinkr.com/blog/common-prd-mistakes) (2026-06-04); [Writing Your First PRD as an APM - Prodinja](https://www.pmsynapse.in/blog/writing-your-first-prd-as-apm) (2026-08-19) |

- Junior: change "Writes specs from a template, with help" to "Writes clear tickets with user stories and acceptance criteria." Junior job posts list "Writing tickets (user stories and acceptance criteria)" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)) and "well-defined stories, acceptance criteria, and priorities" ([Junior Product Manager at Thinkbrg](https://thinkbrg.wd5.myworkdayjobs.com/en-US/BRG_External_Career_Site/job/Remote---USA/Junior-Product-Manager_JR100993) (2026-08-27)).
- Mid: keep. Add that they draft with AI and then stress-test the draft, as in [How to Write a PRD With AI and Stress-Test It - Uxcel](https://uxcel.com/blog/how-to-write-a-prd-with-ai) (2026-10-07).
- Senior: add "Reviews AI-drafted specs and keeps the decisions and reasons written down." With spec-driven development "the agent drafts it" and the PM owns "the intent", "the review" and "the acceptance" ([Spec-Driven Development for Product Managers and Owners](https://specroot.io/notes/spec-driven-development-for-product-managers/) (2026-10-23)). AI "filled the gaps" with "assumptions I hadn't chosen" ([AI PRDs and prototypes: keep control of product decisions](https://blog.ravi-mehta.com/p/prd-or-prototype-which-should-you) (2026-10-16)).
- Stop: "a solution written before the problem is framed, a success metric that can't fail, acceptance criteria too vague to build" ([Common PRD mistakes (and the check that catches each one) · Thinkr](https://usethinkr.com/blog/common-prd-mistakes) (2026-06-04)).

### Prioritization and roadmapping

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep | 13 / 14 / 15 | 108 / 121 / 109 | 60 / 60 | [Why Product Roadmaps Fail: Problems and How to Fix Them](https://flagup.io/blog/why-most-product-roadmaps-fail-and-how-to-fix-them) (2026-08-21); [Prioritization for Senior Product Managers](https://www.ideaplan.io/skill-levels/prioritization-for-senior-pms) (2026-03-15); [Beyond RICE: A Strategic Framework for Annual Product Planning - Productboard](https://www.productboard.com/blog/strategic-framework-for-annual-planning/) (2025-11-26) |

- Junior: keep "Keeps a backlog in order". Junior posts say "backlog hygiene" ([Junior Product Manager (remote)](https://jobboard.ph/product-manager_pasig-c355686/2026-11-joyride-superapp_i4274874327) (2026-11-03)) and "apply our prioritisation approach with discipline" ([Junior Product Manager](https://euremotejobs.com/job/junior-product-manager/) (2026-11-05)).
- Mid: keep. A mid post asks PMs to "recommend priorities, and communicate trade-offs among customer value, business impact, effort, and risk" ([Product Manager (Hybrid) – Strommen Center for Meaningful Work Augsburg University](https://careers.augsburg.edu/jobs/mtrade-llc-product-manager-hybrid/) (2026-11-10)).
- Senior: keep. Senior PMs make "investment allocation across multiple initiatives" ([Prioritization for Senior Product Managers](https://www.ideaplan.io/skill-levels/prioritization-for-senior-pms) (2026-03-15)).
- Stop: a roadmap that is a feature list where "Nobody can say what any of them is supposed to change" ([Why Product Roadmaps Fail: Problems and How to Fix Them](https://flagup.io/blog/why-most-product-roadmaps-fail-and-how-to-fix-them) (2026-08-21)).

### Metrics and experiments

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change junior | 9 / 10 / 15 | 101 / 94 / 100 | 60 / 60 | [16 Key Data Skills for PMs in the AI Era (Second is Crucial)](https://productschool.com/blog/product-fundamentals/data-skills-for-product-managers) (2026-11-09); [The Right KPIs for Product Managers (and Why Most Teams Track the Wrong Ones)](https://pmread.org/blog/product-manager-kpi) (2026-04-26); [10 Mistakes Product Managers Make When Scaling A/B Testing](https://absmartly.framer.website/blog/10-mistakes-product-managers-make-when-scaling-a-b-testing) (2025-12-05) |

- Junior: change "Tracks the metrics they're given" to "Reads product metrics and reports how their features perform." Junior posts ask juniors to "Analyze product metrics and user data to measure feature performance" ([Junior Product Manager Job Description Template (2026)](https://resources.rework.com/libraries/job-description-templates/junior-product-manager) (2026-01-01)) and to "Set success metrics, monitor product performance" ([Product Manager for AI-Powered Recruiting Platform - CVZilla](https://cvzilla.io/jobs/israel/management/product-management/junior-product-manager--a8f65c782e13a4c630833b622b) (2026-11-08)).
- Mid: keep. Add evaluating AI output as a data skill: the list of "core data skills for AI PMs" starts with "metric design, AI output evaluation" ([16 Key Data Skills for PMs in the AI Era (Second is Crucial)](https://productschool.com/blog/product-fundamentals/data-skills-for-product-managers) (2026-11-09)).
- Senior: keep. Senior PMs "own the metric architecture that connects product performance to business outcomes" ([Metrics & Analytics for Senior Product Managers](https://www.ideaplan.io/skill-levels/metrics-for-senior-pms) (2026-03-15)).
- Stop: tracking output as KPIs ("Features launched, bugs closed, sprints completed ... These are not KPIs", [The Right KPIs for Product Managers (and Why Most Teams Track the Wrong Ones)](https://pmread.org/blog/product-manager-kpi) (2026-04-26)), and running tests "to prove ideas right" ([10 Mistakes Product Managers Make When Scaling A/B Testing](https://absmartly.framer.website/blog/10-mistakes-product-managers-make-when-scaling-a-b-testing) (2025-12-05)).

### Working with engineering and design

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Change: rename to "Delivery with engineering and design" | 13 / 11 / 11 | 61 / 60 / 62 | 29 / 60 (flag) | [Why Product Triads Break Down (And How to Fix Them) - QuestWorks](https://www.questworks.io/blog/product-triad-dynamics.html) (2026-04-17); [Cross-Functional Collaboration Survival Guide](https://ambacia.eu/careers-post/cross-functional-collaboration-survival-guide/) (2026-01-30); [Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09) |

- Why: only 29 of 60 results from this area's own queries were about it. But delivery work came up more than any other skill (20 / 17 / 18 in podcasts and jobs). Junior posts are full of it: "Manage and facilitate agile ceremonies" ([Junior Product Manager at Thinkbrg](https://thinkbrg.wd5.myworkdayjobs.com/en-US/BRG_External_Career_Site/job/Remote---USA/Junior-Product-Manager_JR100993) (2026-08-27)), "backlog hygiene, documentation, milestone tracking, and release readiness" ([Junior Product Manager (remote)](https://jobboard.ph/product-manager_pasig-c355686/2026-11-joyride-superapp_i4274874327) (2026-11-03)), "Triage bugs and support issues" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)). Merging delivery into this area gives it real evidence.
- Junior: change "Answers questions and writes tickets" to "Runs the backlog, triages bugs and checks release readiness."
- Mid: change "Breaks work into steps with the team and handles scope changes" to "Brings design and engineering in while the problem is still open, then handles scope changes." The common mistake is "defining solutions before engaging design" ([Cross-Functional Collaboration Survival Guide](https://ambacia.eu/careers-post/cross-functional-collaboration-survival-guide/) (2026-01-30)).
- Senior: keep. Senior posts ask for "strong cross-functional leadership, influencing engineering, research, and business teams" without people management ([Senior Product Manager - Job Detail - Careers Marketplace - Siemens](https://jobs.siemens.com/en_US/externaljobs/JobDetail/526716) (2026-10-21)).
- Stop: "PM dominates and the team becomes a feature factory" ([Why Product Triads Break Down (And How to Fix Them) - QuestWorks](https://www.questworks.io/blog/product-triad-dynamics.html) (2026-04-17)).

### Stakeholder communication

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, small mid change | 16 / 17 / 18 | 108 / 113 / 113 | 60 / 60 | [Stakeholder Communication - IdeaPlan](https://www.ideaplan.io/blog/stakeholder-communication-for-pms) (2026-02-19); [Stakeholder Management for Product Teams: Show Your ...](https://www.producttalk.org/stakeholder-management/) (2026-03-04); [Stakeholder Management for Product Managers](https://makeitnice.de/en/guides/stakeholder-management/) (2025-12-09) |

- Junior: keep.
- Mid: change "Writes clear updates and handles pushback" to "Writes clear updates for each audience and influences without authority." Mid-level stakeholder work is "influencing without authority" ([Stakeholder Management for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/stakeholder-management-for-mid-level-pms) (2026-03-15)).
- Senior: keep. A survey of senior PMs, Group PMs and Directors found "I struggle to communicate my impact so leadership hears it" among the top three themes ([Why Strong Directors Stall Before VP](https://elenasletters.substack.com/p/why-strong-directors-stall-before) (2025-12-12)).
- Stop: "using the same language and level of detail for every audience" ([Stakeholder Management for Product Managers](https://makeitnice.de/en/guides/stakeholder-management/) (2025-12-09)), and giving executives options instead of a recommendation ([Stakeholder Communication - IdeaPlan](https://www.ideaplan.io/blog/stakeholder-communication-for-pms) (2026-02-19)).

### Prototyping with AI tools

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change junior and mid | 13 / 11 / 11 | 47 / 48 / 53 | 59 / 60 | [AI Prototyping for PMs - Wix Co-Founder Masterclass](https://www.news.aakashg.com/p/nadav-abrahami-podcast) (2026-02-27); [Where does a PM's prototype stop? - by Uditi Sharma](https://productwithuditi.substack.com/p/where-does-a-pms-prototype-stop) (2026-10-11); [How product managers should prototype with AI](https://farhorizons.io/writing/how-product-managers-prototype-with-ai) (2026-10-05) |

- Junior: change "Uses Lovable, v0 or Claude to make simple mock-ups" to "Builds clickable prototypes with AI tools so the team sees a working example." A junior post asks for this directly: "Use AI tools to prototype, spec and test ideas quickly, so the team sees working examples, not just documents" ([Junior Product Manager (UK Based) at Kyra](https://jobs.ashbyhq.com/kyra/0478aac5-34c7-40de-9f85-484bf216a163) (2026-11-09)).
- Mid: change "Builds working prototypes to test ideas with users" to "Builds working prototypes with the real prompt and realistic data, and tests them with users." For AI features "The riskier question is usually what the model will say", so "Use the real prompt" and "Use real or realistic data" ([Where does a PM's prototype stop? - by Uditi Sharma](https://productwithuditi.substack.com/p/where-does-a-pms-prototype-stop) (2026-10-11)).
- Senior: keep. A senior post asks PMs to "build working prototypes, and write persuasive specs" ([Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05)).
- Stop: prototyping before the problem is clear. "AI prototyping tools don't replace problem space work" ([AI Prototyping for PMs - Wix Co-Founder Masterclass](https://www.news.aakashg.com/p/nadav-abrahami-podcast) (2026-02-27)). Also, tools "fill the gap with a confident default" when the spec is missing ([AI Prototyping for Product Managers: 4 Levels, 5 Inputs](https://www.rodriguezjimmy.com/blog/ai-prototyping-for-product-managers) (2026-08-11)).

### AI product sense

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change junior, flag thin level evidence | 8 / 5 / 6 | 52 / 42 / 51 | 46 / 60 | [AI Product Sense: A Practical, 2026 Guide for PMs](https://productschool.com/blog/ai-for-product-managers/ai-product-sense) (2026-11-06); [What Product Managers Get Wrong Building with LLMs - ProdLabs](https://prodlabs.co/what-pms-get-wrong-llms/) (2026-05-15); [How to build AI product sense - by Tal Raviv and Aman Khan](https://www.lennysnewsletter.com/p/how-to-build-ai-product-sense) (2026-02-03) |

- Flag: podcasts and job posts mention it less than most areas, mostly in AI product roles. The area queries found good material, but with fewer on-topic results (46 of 60).
- Junior: change "Knows what LLMs can and can't do" to "Knows what LLMs can and can't do, and checks AI output instead of trusting it." The most costly AI mistakes "come from the same habit: trusting a model's output without validating it" ([Common Mistakes When Using AI as a Product Manager - Founderz](https://founderz.com/blog/common-mistakes-using-ai-product-manager/) (2026-07-16)). Junior AI PMs often "measure their AI product like a SaaS product" ([The mistake I see junior AI PMs make: - Anand Sagar](https://www.linkedin.com/posts/anandsagartech_aipm-productmanagement-ai-activity-7476857858379149312-9cH3) (2026-06-28)).
- Mid: keep. AI PMs add "model selection, eval design, cost/quality/latency triangulation, and AI-failure UX" ([What Does an AI Product Manager Do? The Real Day-to-Day Work in 2026](https://www.institutepm.com/knowledge-hub/what-does-an-ai-product-manager-do) (2026-05-12)).
- Senior: keep. Add trust: "Trust becomes a core product requirement" ([AI Product Sense: A Practical, 2026 Guide for PMs](https://productschool.com/blog/ai-for-product-managers/ai-product-sense) (2026-11-06)).
- Stop: "Treating the demo as proof the feature works" ([What Product Managers Get Wrong Building with LLMs - ProdLabs](https://prodlabs.co/what-pms-get-wrong-llms/) (2026-05-15)).

### Go-to-market and launch

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, flag thin junior evidence | 11 / 12 / 15 | 78 / 84 / 81 | 60 / 60 | [Go-to-market strategy for product managers](https://producthq.org/product-strategy/go-to-market-strategy-for-product-managers/) (2026-09-14); [B2B SaaS product launch framework - Zack Alami](https://zackalami.com/b2b-saas-product-launch/) (2026-02-12); [Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05) |

- Flag: the junior query mostly found product marketing (PMM) pages, such as [Junior Product Marketing Manager Skills Framework - GTM Playbook](https://discover.gtmplaybook.co/junior-pmm-skills-framework) (2026-03-01). Junior PM posts mention launch only as support work, for example "help take products to market" ([Junior Product Manager](https://euremotejobs.com/job/junior-product-manager/) (2026-11-05)).
- Junior: keep "Helps with launch checklists". Release readiness sits better in the delivery area.
- Mid: keep. The PM makes sure "the product story, readiness, packaging, and success criteria fit the way we plan to sell" ([Go-to-market strategy for product managers](https://producthq.org/product-strategy/go-to-market-strategy-for-product-managers/) (2026-09-14)).
- Senior: keep. A senior post says "Take what you build to market: shape positioning, pricin[g]" ([Senior Product Manager at Usekernel](https://jobs.ashbyhq.com/usekernel/bfe58719-6d39-4f54-9664-9befa0c81f85) (2026-11-05)).
- Stop: "treating the launch as a marketing event instead of a business outcome" ([B2B SaaS product launch framework - Zack Alami](https://zackalami.com/b2b-saas-product-launch/) (2026-02-12)).

### Strategy and vision

| Decision | Podcasts and jobs | All results | On topic | Sources |
| --- | --- | --- | --- | --- |
| Keep, change mid and senior | 15 / 16 / 16 | 75 / 97 / 83 | 59 / 60 | [Strategy for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/strategy-for-mid-level-pms) (2026-03-15); [The 10 Product Strategy Mistakes I Keep Seeing (After 10+ Years in SaaS) - Dr. Joshua Read](https://drjoshuaread.com/10-product-strategy-mistakes/) (2026-03-03); [What Is Product Strategy Really? The Mistake Junior PMs Make in Interviews • Saro Builds](https://sarobuilds.com/what-is-product-strategy-really-the-mistake-junior-pms-make-in-interviews/) (2026-05-19) |

- Junior: keep "Understands the product strategy". The junior mistake is thinking strategy is the roadmap ([What Is Product Strategy Really? The Mistake Junior PMs Make in Interviews • Saro Builds](https://sarobuilds.com/what-is-product-strategy-really-the-mistake-junior-pms-make-in-interviews/) (2026-05-19)).
- Mid: change "Connects their features to the strategy" to "Writes the strategy for their own product area, tied to company goals." Mid PMs "create strategies for your product area" ([Strategy for Mid-Level Product Managers](https://www.ideaplan.io/skill-levels/strategy-for-mid-level-pms) (2026-03-15)). A mid post says "Own the strategy, roadmap, and priorities for an assigned product or product area" ([Mid-level Product Manager @ PDI Technologies - TA Associates Job Board](https://careers.ta.com/companies/pdi-technologies/jobs/97498228-mid-level-product-manager) (2026-10-20)).
- Senior: change "Writes the strategy and vision for a product area" to "Owns the strategy for a domain or several products, and ties it to commercial results." Senior PMs own "a larger, more complex, or strategic product or group of products" with "a clear view of commercial impact" ([Senior Product Manager at Thomsonreuters](https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site/job/Senior-Product-Manager_JREQ204205) (2026-10-14)). "You own a domain, not a feature" (["Path From PM to Senior PM and Group PM: The 18-36 Month Map"](https://resources.rework.com/guides/product-manager-playbooks/pm-to-senior-pm-and-gpm-path) (2026-04-28)).
- Stop: "Confusing Activity with Progress" ([The 10 Product Strategy Mistakes I Keep Seeing (After 10+ Years in SaaS) - Dr. Joshua Read](https://drjoshuaread.com/10-product-strategy-mistakes/) (2026-03-03)).

## Proposed new areas

---

### Working with AI agents day to day

Recommended. This is how a PM uses AI agents for their own work: context files, reusable skills, automations, and checking what the agent did. It is not prototyping and not AI product sense. It is also close to what TripleKeel scores, since it is about how PMs prompt.

- Counts: 10 / 11 / 10 in podcasts and jobs, 27 / 37 / 37 in all results.
- Sources: [How Figma’s PMs actually use AI every day - Ezra Mechaber (PM, Figma) - How I AI - Wave AI Podcast Notes](https://pod.wave.co/podcast/how-i-ai/how-figmas-pms-actually-use-ai-every-day-ezra-mechaber-pm-figma) (2026-11-02) (a shared kit of "terminal-based skills for finding context, tracking commitments"); [🎙️ How I AI: How this PM uses Claude to handle 70% to 80% of his workday](https://www.lennysnewsletter.com/p/how-i-ai-how-this-pm-uses-claude) (2026-08-31) (a system that "handles 70% to 80% of his workday"); [EP 102 The Future-Proof PM: AI Skills & How to Develop Them](https://www.productcoalition.com/p/ep-102-the-future-proof-pm-ai-skills) (2026-05-21) ("98% of PMs use AI daily, but only 39% have role-specific training").
- Draft levels:
  - Junior: uses AI assistants for drafts, notes and research, and checks the output.
  - Mid: keeps context files and reusable prompts or skills, and automates routine work.
  - Senior: builds a shared AI workflow for the team, as in [How to build a Team OS in Claude Code with Hannah Stulberg, PM @ DoorDash - The Growth Podcast - Wave AI Podcast Notes](https://pod.wave.co/podcast/product-growth-podcast/how-to-build-a-team-os-in-claude-code-with-hannah-stulberg-pm-doordash) (2026-04-07).
- Stop: trusting output without checking it ([Common Mistakes When Using AI as a Product Manager - Founderz](https://founderz.com/blog/common-mistakes-using-ai-product-manager/) (2026-07-16)).
- Exa queries: "how {level} product managers use AI agents in their daily work", "common mistakes product managers make using AI assistants for their own work".

### Business and commercial sense

Optional. Senior job posts and "next level" podcasts often name it. It could be its own area or part of senior strategy, as proposed above.

- Counts: 6 / 6 / 7 in podcasts and jobs, 39 / 47 / 45 in all results.
- Sources: [Senior Product Manager at Thomsonreuters](https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site/job/Senior-Product-Manager_JREQ204205) (2026-10-14) ("a clear view of commercial impact"); [Senior Product Manager at Equifax](https://equifax.wd5.myworkdayjobs.com/en-US/External/job/Senior-Product-Manager_J00179418) (2026-11-05) ("segmentation, market sizing, and competitive analysis"); [After 15 years in product, Christopher Y. learned that being the best problem-solver stops scaling. - Ahmed Khalil](https://www.linkedin.com/posts/productmanagerahmedkhalil_after-15-years-in-product-christopher-y-activity-7495120225336602624-duOq) (2026-08-17) ("how to go from owning features to owning the actual business").
- Recommendation: fold it into senior strategy for the MVP, and revisit if the review wants a separate area.

### Not proposed

- Ownership and agency: comes up often (15 / 16 / 17) but as a trait, for example "proactivity, curiosity, and resilience" ([The Three Things Great PMs Have That You Cannot Coach](https://productsthatcount.com/opentable-product-svp-on-the-three-things-great-pms-have-that-you-cannot-coach/) (2026-06-12)). It is hard to check in a prompt.
- Leadership and coaching: rare (6 / 2 / 7), and mostly about moving from Director to VP ([Why Strong Directors Stall Before VP](https://elenasletters.substack.com/p/why-strong-directors-stall-before) (2025-12-12)).

## Suggested Exa queries for the daily job

---

Use the same request shape as this run: `type: "auto"`, `contents: {"highlights": true}`, an `objective`, and a date window. For a daily job, a window of the last 7 to 30 days fits better than 12 months. Replace {level} with junior, mid-level or senior.

| Area | Queries |
| --- | --- |
| Problem discovery and user research | "how {level} product managers run user interviews now"; "common mistakes product managers make with user research" |
| Writing specs and PRDs | "how product managers write PRDs with AI agents"; "common PRD mistakes engineers complain about" |
| Prioritization and roadmapping | "how {level} product managers prioritize the roadmap now"; "why product roadmaps fail" |
| Metrics and experiments | "how product managers choose success metrics and run A/B tests now"; "how product managers evaluate AI feature quality" |
| Delivery with engineering and design | "how product managers work with engineering and design in a product trio"; "how junior product managers run backlog, bug triage and release readiness" |
| Stakeholder communication | "how {level} product managers write stakeholder updates"; "common mistakes product managers make communicating with executives" |
| Prototyping with AI tools | "how product managers prototype with AI tools like Lovable, v0, Cursor or Claude"; "AI prototyping mistakes product managers make" |
| AI product sense | "how product managers design evals and handle LLM failure modes"; "what product managers get wrong building with LLMs" |
| Go-to-market and launch | "how product managers plan a product launch with marketing and sales"; "senior product manager positioning and pricing decisions" |
| Strategy and vision | "how {level} product managers write a product strategy"; "common product strategy mistakes" |
| Working with AI agents day to day (new) | "how {level} product managers use AI agents in their daily work"; "podcast: how product managers use Claude, Codex or Cursor at work" |

Notes for the job:

- The plain area phrasing in the track file works for most areas. For "Working with engineering and design", it found little. Use the triad and delivery queries above.
- For junior go-to-market, add "product manager" and "not product marketing" to the `objective`, since the query finds PMM pages.
- Podcast queries work with Exa Search plus an `objective`. Switch to the Podcasts API if REI-248 confirms one.

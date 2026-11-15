-- Generated from tracks/ by `node scripts/sync-catalog.mts --write-seed`.
-- Do not edit by hand. A test fails when this file is out of date.
-- Production gets the same catalog from the deploy job (REI-311).
select public.sync_track_catalog($catalog${
  "tracks": [
    {
      "id": "product-manager",
      "name": "Product manager",
      "alt_titles": [
        "PM",
        "Product owner",
        "Associate product manager",
        "APM",
        "Senior PM"
      ],
      "areas": [
        {
          "id": "problem_discovery",
          "name": "Problem discovery and user research",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Runs user interviews and reads feedback and usage data, with a senior PM checking the questions.",
          "mid_description": "Plans their own research and turns it into clear problem statements.",
          "senior_description": "Sets the research agenda for a product area and spots problems before users name them.",
          "exa_queries": {
            "junior": [
              "product managers talking about user interviews and continuous discovery",
              "mistakes product managers make with user research",
              "how junior product managers run user interviews now"
            ],
            "mid": [
              "product managers talking about user interviews and continuous discovery",
              "mistakes product managers make with user research",
              "how mid-level product managers run user interviews now"
            ],
            "senior": [
              "product managers talking about user interviews and continuous discovery",
              "mistakes product managers make with user research",
              "how senior product managers run user interviews now"
            ]
          }
        },
        {
          "id": "specs",
          "name": "Writing specs and PRDs",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Writes clear tickets with user stories and acceptance criteria.",
          "mid_description": "Drafts specs with AI, then stress-tests the draft against the user, problem, success metrics, scope and acceptance criteria.",
          "senior_description": "Reviews AI-drafted specs and keeps the decisions and reasons written down.",
          "exa_queries": {
            "junior": [
              "product managers talking about writing specs and PRDs",
              "product managers writing PRDs with AI",
              "common PRD mistakes engineers complain about"
            ],
            "mid": [
              "product managers talking about writing specs and PRDs",
              "product managers writing PRDs with AI",
              "common PRD mistakes engineers complain about"
            ],
            "senior": [
              "product managers talking about writing specs and PRDs",
              "product managers writing PRDs with AI",
              "common PRD mistakes engineers complain about"
            ]
          }
        },
        {
          "id": "prioritization",
          "name": "Prioritization and roadmapping",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Keeps a backlog in order.",
          "mid_description": "Prioritizes with a clear method and explains the trade-offs.",
          "senior_description": "Owns the roadmap for an area and says no to good ideas for better ones.",
          "exa_queries": {
            "junior": [
              "product managers talking about prioritization and roadmapping",
              "mistakes product managers make with prioritization and roadmapping",
              "why product roadmaps fail"
            ],
            "mid": [
              "product managers talking about prioritization and roadmapping",
              "mistakes product managers make with prioritization and roadmapping",
              "why product roadmaps fail"
            ],
            "senior": [
              "product managers talking about prioritization and roadmapping",
              "mistakes product managers make with prioritization and roadmapping",
              "why product roadmaps fail"
            ]
          }
        },
        {
          "id": "metrics",
          "name": "Metrics and experiments",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Reads product metrics and reports how their features perform.",
          "mid_description": "Defines success metrics, designs A/B tests for their features and evaluates AI output.",
          "senior_description": "Sets the metric strategy for an area and judges trade-offs between metrics.",
          "exa_queries": {
            "junior": [
              "product managers talking about metrics and experiments",
              "mistakes product managers make with A/B tests",
              "how product managers evaluate AI feature quality"
            ],
            "mid": [
              "product managers talking about metrics and experiments",
              "mistakes product managers make with A/B tests",
              "how product managers evaluate AI feature quality"
            ],
            "senior": [
              "product managers talking about metrics and experiments",
              "mistakes product managers make with A/B tests",
              "how product managers evaluate AI feature quality"
            ]
          }
        },
        {
          "id": "eng_design_collab",
          "name": "Delivery with engineering and design",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Runs the backlog, triages bugs and checks release readiness.",
          "mid_description": "Brings design and engineering in while the problem is still open, then handles scope changes.",
          "senior_description": "Shapes how the teams work together and unblocks across teams.",
          "exa_queries": {
            "junior": [
              "how PMs work with designers",
              "product manager and engineering lead relationship",
              "how junior product managers run backlog, bug triage and release readiness"
            ],
            "mid": [
              "how PMs work with designers",
              "product manager and engineering lead relationship",
              "PM and tech lead trade-offs"
            ],
            "senior": [
              "how PMs work with designers",
              "product manager and engineering lead relationship",
              "shipping with your engineering team"
            ]
          }
        },
        {
          "id": "stakeholder_comms",
          "name": "Stakeholder communication",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Shares updates when asked.",
          "mid_description": "Writes clear updates for each audience and influences without authority.",
          "senior_description": "Aligns leaders on direction and handles conflict between teams.",
          "exa_queries": {
            "junior": [
              "product managers talking about stakeholder communication",
              "mistakes product managers make with stakeholder communication",
              "how junior product managers write stakeholder updates"
            ],
            "mid": [
              "product managers talking about stakeholder communication",
              "mistakes product managers make with stakeholder communication",
              "how mid-level product managers write stakeholder updates"
            ],
            "senior": [
              "product managers talking about stakeholder communication",
              "mistakes product managers make with stakeholder communication",
              "how senior product managers write stakeholder updates"
            ]
          }
        },
        {
          "id": "ai_prototyping",
          "name": "Prototyping with AI tools",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Builds clickable prototypes with AI tools so the team sees a working example.",
          "mid_description": "Builds working prototypes with the real prompt and realistic data, and tests them with users.",
          "senior_description": "Uses prototypes to make decisions faster and teaches the team how.",
          "exa_queries": {
            "junior": [
              "product managers talking about prototyping with AI tools",
              "mistakes product managers make with prototyping with AI tools",
              "AI prototyping mistakes product managers make"
            ],
            "mid": [
              "product managers talking about prototyping with AI tools",
              "mistakes product managers make with prototyping with AI tools",
              "AI prototyping mistakes product managers make"
            ],
            "senior": [
              "product managers talking about prototyping with AI tools",
              "mistakes product managers make with prototyping with AI tools",
              "AI prototyping mistakes product managers make"
            ]
          }
        },
        {
          "id": "ai_product_sense",
          "name": "AI product sense",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Knows what LLMs can and can’t do, and checks AI output instead of trusting it.",
          "mid_description": "Designs features with LLMs, including errors, evals and cost.",
          "senior_description": "Decides where AI belongs in the product, and treats trust as a product requirement.",
          "exa_queries": {
            "junior": [
              "when not to use AI in a product",
              "LLM product decisions",
              "evals for AI features"
            ],
            "mid": [
              "when not to use AI in a product",
              "LLM product decisions",
              "evals for AI features"
            ],
            "senior": [
              "when not to use AI in a product",
              "LLM product decisions",
              "evals for AI features"
            ]
          }
        },
        {
          "id": "go_to_market",
          "name": "Go-to-market and launch",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Helps with launch checklists.",
          "mid_description": "Plans launches with marketing and sales.",
          "senior_description": "Shapes positioning and pricing, and learns from launches.",
          "exa_queries": {
            "junior": [
              "product managers talking about launching a product with marketing and sales",
              "mistakes product managers make with go-to-market and launch",
              "how junior product managers prepare a product launch"
            ],
            "mid": [
              "product managers talking about launching a product with marketing and sales",
              "mistakes product managers make with go-to-market and launch",
              "how mid-level product managers prepare a product launch"
            ],
            "senior": [
              "product managers talking about launching a product with marketing and sales",
              "mistakes product managers make with go-to-market and launch",
              "senior product manager positioning and pricing decisions"
            ]
          }
        },
        {
          "id": "strategy",
          "name": "Strategy and vision",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Understands the product strategy.",
          "mid_description": "Writes the strategy for their own product area, tied to company goals.",
          "senior_description": "Owns the strategy for a domain or several products, and ties it to commercial results.",
          "exa_queries": {
            "junior": [
              "product managers talking about strategy and vision",
              "mistakes product managers make with strategy and vision",
              "how junior product managers write a product strategy"
            ],
            "mid": [
              "product managers talking about strategy and vision",
              "mistakes product managers make with strategy and vision",
              "how mid-level product managers write a product strategy"
            ],
            "senior": [
              "product managers talking about strategy and vision",
              "mistakes product managers make with strategy and vision",
              "how senior product managers write a product strategy"
            ]
          }
        },
        {
          "id": "ai_agents_daily",
          "name": "Working with AI agents day to day",
          "thresholds": {
            "junior": 0,
            "mid": 1,
            "senior": 2
          },
          "junior_description": "Uses AI assistants for drafts, notes and research, and checks the output.",
          "mid_description": "Keeps context files and reusable prompts or skills, and automates routine work.",
          "senior_description": "Builds a shared AI workflow for the team.",
          "exa_queries": {
            "junior": [
              "how junior product managers use AI tools in their work",
              "product managers showing their AI workflow with Claude Code, Codex or Cursor",
              "how junior product managers use AI agents in their daily work"
            ],
            "mid": [
              "how mid-level product managers use AI tools in their work",
              "product managers showing their AI workflow with Claude Code, Codex or Cursor",
              "how mid-level product managers use AI agents in their daily work"
            ],
            "senior": [
              "how senior product managers use AI tools in their work",
              "product managers showing their AI workflow with Claude Code, Codex or Cursor",
              "how senior product managers use AI agents in their daily work"
            ]
          }
        }
      ],
      "questions": [
        {
          "id": "target_user",
          "area_id": "problem_discovery",
          "question_text": "Does the prompt name a specific user or audience?",
          "card_label": "named a specific user or audience",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "problem",
          "area_id": "problem_discovery",
          "question_text": "Does it state the problem, not only the feature?",
          "card_label": "stated the problem, not just the feature",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "success_metric",
          "area_id": "metrics",
          "question_text": "Does it define what success looks like?",
          "card_label": "set a success metric",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "acceptance",
          "area_id": "specs",
          "question_text": "Does it give acceptance criteria?",
          "card_label": "gave acceptance criteria",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "scope_cut",
          "area_id": "prioritization",
          "question_text": "Does it say what's out of scope or MVP-only?",
          "card_label": "said what's out of scope",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "decomposed",
          "area_id": "eng_design_collab",
          "question_text": "Does it split the task into steps?",
          "card_label": "split the task into steps",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "context_given",
          "area_id": "ai_prototyping",
          "question_text": "Does it give examples, references or existing context?",
          "card_label": "gave examples or existing context",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "specific_feedback",
          "area_id": "ai_prototyping",
          "question_text": "When iterating, is the feedback specific?",
          "card_label": "gave specific feedback",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "asks_tests",
          "area_id": "ai_product_sense",
          "question_text": "Does it ask for a way to check the result?",
          "card_label": "asked for a way to check the result",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "cost_latency",
          "area_id": "ai_product_sense",
          "question_text": "Does it mention cost, speed or limits?",
          "card_label": "mentioned cost, speed or limits",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "edge_cases",
          "area_id": "specs",
          "question_text": "Does it mention errors, empty states or edge cases?",
          "card_label": "covered errors and edge cases",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "constraints",
          "area_id": "eng_design_collab",
          "question_text": "Does it give technical constraints?",
          "card_label": "gave technical constraints",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "no_why",
          "area_id": "problem_discovery",
          "question_text": "Does it ask for a feature with no user or reason behind it?",
          "card_label": "asked for a feature with no user or reason",
          "polarity": "bad",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "kitchen_sink",
          "area_id": "prioritization",
          "question_text": "Does it ask for a whole product in one prompt, with no steps or priorities?",
          "card_label": "asked for a whole product in one prompt",
          "polarity": "bad",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "vague_fix",
          "area_id": "ai_prototyping",
          "question_text": "Is it a follow-up that only says \"fix it\"?",
          "card_label": "asked to \"fix it\" with no detail",
          "polarity": "bad",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "blind_accept",
          "area_id": "ai_product_sense",
          "question_text": "Does it accept output without checking it?",
          "card_label": "accepted output without checking it",
          "polarity": "bad",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "metric_interpretation",
          "area_id": "metrics",
          "question_text": "Does it ask how the feature changed a product metric?",
          "card_label": "asked how a feature moved a metric",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "audience_update",
          "area_id": "stakeholder_comms",
          "question_text": "Does it name who needs the update and what they need to decide?",
          "card_label": "named who the update is for",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "stakeholder_tradeoff",
          "area_id": "stakeholder_comms",
          "question_text": "Does it state the trade-off stakeholders need to resolve?",
          "card_label": "stated the trade-off to resolve",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "launch_readiness",
          "area_id": "go_to_market",
          "question_text": "Does it name the launch audience and channel?",
          "card_label": "named the launch audience and channel",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "launch_learning",
          "area_id": "go_to_market",
          "question_text": "Does it ask how launch results will be measured?",
          "card_label": "planned how to measure the launch",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "strategic_tradeoff",
          "area_id": "strategy",
          "question_text": "Does it connect the product decision to a company goal?",
          "card_label": "tied the decision to a company goal",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "commercial_impact",
          "area_id": "strategy",
          "question_text": "Does it name a business outcome such as revenue, retention or cost?",
          "card_label": "named a business outcome",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "agent_context",
          "area_id": "ai_agents_daily",
          "question_text": "Does it provide reusable project context for an AI agent?",
          "card_label": "gave an AI agent reusable project context",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        },
        {
          "id": "agent_workflow",
          "area_id": "ai_agents_daily",
          "question_text": "Does it define a repeatable AI workflow with human review?",
          "card_label": "set up a repeatable AI workflow with review",
          "polarity": "good",
          "answers": [
            "yes",
            "partly",
            "no",
            "n/a"
          ]
        }
      ]
    }
  ]
}$catalog$::jsonb);

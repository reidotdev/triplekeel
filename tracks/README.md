# Tracks

Role track data lives here. Each track is one folder named after its ID:

```
tracks/<track-id>/
  track.yaml        # id, name, levels [junior, mid, senior], alt_titles
  skill-areas.yaml  # areas: id, name, levels {junior, mid, senior}: description, exa_queries
  questions.yaml    # questions: id, text, card_label, area, polarity (good|bad), answers
```

The schema is in `packages/schema`. CI validates every folder here on each push.

`product-manager/` is a placeholder built from the draft areas. REI-273 replaces it after the Exa skills check.

Rules:

- Question IDs must be listed in `QUESTION_IDS` in `packages/schema`.
- Every track includes all 16 v0 questions.
- Each question's `area` must be an area in the same track.
- `card_label` is optional. It is the short phrase the keel check card uses, and it completes "You \_\_\_ in 14 of your last 20 prompts". Start with a lowercase past-tense verb, keep it under 80 characters, and don't end with a period: `set a success metric`, `asked to "fix it" with no detail`.

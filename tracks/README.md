# Tracks

Role track data lives here. Each track is one folder named after its ID:

```
tracks/<track-id>/
  track.yaml        # id, name, levels [junior, mid, senior], alt_titles
  skill-areas.yaml  # areas: id, name, levels {junior, mid, senior}: description, exa_queries
  questions.yaml    # questions: id, text, area, polarity (good|bad), answers
```

The schema is in `packages/schema`. CI validates every folder here on each push.

`product-manager/` is a placeholder built from the draft areas. REI-273 replaces it after the Exa skills check.

Rules:

- Question IDs must be listed in `QUESTION_IDS` in `packages/schema`.
- Every track includes all 16 v0 questions.
- Each question's `area` must be an area in the same track.

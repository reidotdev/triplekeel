// Sample cards for the keel check tests.
import type { KeelCheckCard, KeelCheckItem } from "../../src/lib/keel-check";

export const keepItem: KeelCheckItem = {
  kind: "keep",
  status: "open",
  area_id: "pm-metrics",
  area_name: "Metrics and experiments",
  question_id: "pm_success_metric",
  card_label: "set a success metric",
  counts: { yes: 12, partly: 0, no: 6, answered: 18, window: 20 },
  level: null,
  pick_id: "00000000-0000-0000-0000-000000000101",
  pick: {
    title: "How to pick one metric",
    url: "https://example.com/metrics",
    publisher: "Lenny's Podcast",
    published_at: "2026-10-12T09:00:00+00:00",
    podcast_timestamp_seconds: 975,
    source: "podcast",
    why_line: "Shows how to tie a feature to one number.",
  },
};

export const stopItem: KeelCheckItem = {
  kind: "stop",
  status: "open",
  area_id: "pm-ai-agents",
  area_name: "Working with AI agents day to day",
  question_id: "pm_accept_unchecked",
  card_label: "accepted output without checking it",
  counts: { yes: 4, partly: 2, no: 9, answered: 15, window: 20 },
  level: null,
  pick_id: "00000000-0000-0000-0000-000000000102",
  pick: {
    title: "Review AI output in two minutes",
    url: "https://example.com/review",
    publisher: null,
    published_at: "2026-11-03T00:00:00+00:00",
    podcast_timestamp_seconds: null,
    source: "web",
    why_line: "Gives a short checklist to run before you ship.",
  },
};

export const testItem: KeelCheckItem = {
  kind: "test",
  status: "open",
  area_id: "pm-discovery",
  area_name: "Problem discovery and user research",
  question_id: null,
  card_label: null,
  counts: { prompts: 7, window: 20 },
  level: { level: "junior", target_level: "mid", gap: 1, score: 0.4 },
  pick_id: "00000000-0000-0000-0000-000000000103",
  pick: {
    title: "Five questions for every user interview",
    url: "https://example.com/discovery",
    publisher: "Product Talk",
    published_at: "2026-09-01T00:00:00+00:00",
    podcast_timestamp_seconds: 3725,
    source: "podcast",
    why_line: "Turns a vague request into a problem you can test.",
  },
};

export const fullCard: KeelCheckCard = {
  id: "7facc855-67ef-4055-bd3c-40788370f6a8",
  track_id: "product-manager",
  created_at: "2026-11-15T08:00:00+00:00",
  items: [keepItem, stopItem, testItem],
};

export const emptyCard: KeelCheckCard = {
  id: "0b8d7f8e-2c0f-4d55-9b7e-3f5b3c1d2e10",
  track_id: "product-manager",
  created_at: "2026-11-14T08:00:00+00:00",
  items: [],
};

export const olderCard: KeelCheckCard = {
  id: "5d1f3c2a-9e8b-4c7d-a6f5-1e2d3c4b5a69",
  track_id: "product-manager",
  created_at: "2026-11-10T08:00:00+00:00",
  items: [testItem],
};

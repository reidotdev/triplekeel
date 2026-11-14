// Picks the track a prompt belongs to, on the device. Prompts that match no
// track, or look personal, return "none" and are dropped without scoring.
import type { TrackId } from "@triplekeel/schema";

export type RoutableTrack = {
  id: TrackId;
  /** Lowercase words or phrases that suggest a prompt is about this track. */
  keywords: readonly string[];
};

export type RouteResult = TrackId | "none";

/** Built-in keywords per track. Can move into track.yaml later. */
export const TRACK_KEYWORDS: Record<TrackId, readonly string[]> = {
  "product-manager": [
    "product",
    "feature",
    "features",
    "user",
    "users",
    "customer",
    "customers",
    "prd",
    "spec",
    "requirements",
    "roadmap",
    "backlog",
    "mvp",
    "prioritize",
    "prioritise",
    "metric",
    "metrics",
    "kpi",
    "a/b test",
    "experiment",
    "launch",
    "onboarding",
    "stakeholder",
    "stakeholders",
    "user story",
    "acceptance criteria",
    "prototype",
    "app",
    "landing page",
    "dashboard",
    "persona",
    "churn",
    "retention",
    "conversion",
    "pricing",
    "go-to-market",
    "competitor",
    "competitors",
    // Build requests and product surfaces (REI-275).
    "build",
    "add a",
    "create a",
    "design a",
    "implement",
    "ship",
    "release notes",
    "sign-up",
    "signup",
    "checkout",
    "page",
    "screen",
    "flow",
    "form",
    "button",
    "dark mode",
    "crm",
    "tracker",
    "planner",
    "booking",
    "ticket",
    "tickets",
    "pipeline",
  ],
};

export const DEFAULT_TRACKS: readonly RoutableTrack[] = Object.entries(
  TRACK_KEYWORDS,
).map(([id, keywords]) => ({ id: id as TrackId, keywords }));

/**
 * Topics that mark a prompt as personal. These are never scored. Health words
 * are first-person ("my medication"), so a PRD for nurses still routes.
 */
export const PERSONAL_KEYWORDS: readonly string[] = [
  "my doctor",
  "my diagnosis",
  "symptoms",
  "my medication",
  "therapy",
  "therapist",
  "my depression",
  "my anxiety",
  "i feel anxious",
  "i feel depressed",
  "my boyfriend",
  "my girlfriend",
  "my husband",
  "my wife",
  "my partner",
  "divorce",
  "dating",
  "breakup",
  "pregnan",
  "my salary",
  "my debt",
  "lawsuit",
];

/** True if the prompt looks personal. Check every prompt, follow-ups too. */
export function isPersonal(prompt: string): boolean {
  const text = prompt.toLowerCase();
  return PERSONAL_KEYWORDS.some((k) => text.includes(k));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function countMatches(text: string, phrase: string): number {
  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`,
    "g",
  );
  return text.match(pattern)?.length ?? 0;
}

/**
 * Returns the track with the most keyword matches, or "none" if no keyword
 * matches or the prompt looks personal. Ties go to the first track listed.
 *
 * Route a chat by its first prompt. Follow-ups like "fix it" have no keywords
 * and return "none", so they take the track of the chat they belong to. Still
 * run isPersonal() on every prompt, because any message can be personal.
 */
export function routeTrack(
  prompt: string,
  tracks: readonly RoutableTrack[] = DEFAULT_TRACKS,
): RouteResult {
  if (isPersonal(prompt)) return "none";
  const text = prompt.toLowerCase();

  let best: RouteResult = "none";
  let bestScore = 0;
  for (const track of tracks) {
    let score = 0;
    for (const keyword of track.keywords) {
      score += countMatches(text, keyword.toLowerCase());
    }
    if (score > bestScore) {
      best = track.id;
      bestScore = score;
    }
  }
  return best;
}

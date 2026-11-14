export const QUESTIONS = [
  { id: "target_user", label: "Names a specific user or audience", kind: "good" },
  { id: "problem", label: "States the problem, not only the feature", kind: "good" },
  { id: "success_metric", label: "Defines what success looks like", kind: "good" },
  { id: "acceptance", label: "Gives acceptance criteria", kind: "good" },
  { id: "scope_cut", label: "Says what is out of scope or MVP-only", kind: "good" },
  { id: "decomposed", label: "Splits the task into steps", kind: "good" },
  { id: "context_given", label: "Gives examples, references or existing context", kind: "good" },
  { id: "specific_feedback", label: "Makes follow-up feedback specific", kind: "good" },
  { id: "asks_tests", label: "Asks for tests or a way to check the result", kind: "good" },
  { id: "cost_latency", label: "Mentions cost, speed or limits", kind: "good" },
  { id: "edge_cases", label: "Mentions errors, empty states or edge cases", kind: "good" },
  { id: "constraints", label: "Gives technical constraints", kind: "good" },
  { id: "no_why", label: "Asks for a feature with no user or reason", kind: "bad" },
  { id: "kitchen_sink", label: "Asks for many features without steps or priorities", kind: "bad" },
  { id: "vague_fix", label: "Follow-up only says fix it or similar", kind: "bad" },
  { id: "blind_accept", label: "Accepts output without asking to check it", kind: "bad" },
] as const;

export type Answer = "yes" | "partly" | "no" | "n/a";
export type Score = { q: string; a: Answer; p: number };
export type Scorer = (prompt: string) => Score[];

export function validateScores(value: unknown): Score[] {
  if (!Array.isArray(value)) return [];
  const validAnswers = new Set(["yes", "partly", "no", "n/a"]);
  const valid = new Map<string, Score>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { q, a, p } = item as Record<string, unknown>;
    if (typeof q !== "string" || !QUESTIONS.some((question) => question.id === q)) continue;
    if (typeof a !== "string" || !validAnswers.has(a)) continue;
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) continue;
    valid.set(q, { q, a: a as Answer, p });
  }
  return QUESTIONS.flatMap(({ id }) => (valid.has(id) ? [valid.get(id)!] : []));
}

export function mergeWithFallback(value: unknown, fallback: Score[]): Score[] {
  const valid = new Map(validateScores(value).map((score) => [score.q, score]));
  return QUESTIONS.map(({ id }) => valid.get(id) ?? fallback.find((score) => score.q === id)!).filter(Boolean);
}

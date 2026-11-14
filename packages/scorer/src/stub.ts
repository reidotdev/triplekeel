// A fake scorer for integration and demos. Deterministic: the same prompt
// always gets the same answers. Rough heuristics make results look sensible:
// longer, more specific prompts get more `yes`. Not a real skill check.
import type { Answer, QuestionId, TrackQuestion } from "@triplekeel/schema";
import { unitHash } from "./hash.js";
import type { ProgressCallback, ScoredAnswer, Scorer } from "./types.js";

/** Words that hint a prompt covers a question. Only for the stub. */
const CUES: Partial<Record<QuestionId, RegExp>> = {
  target_user:
    /\b(users?|customers?|audience|personas?|parents|students|teams?|managers?|developers?|for (busy|small|new|first-time))\b/,
  problem: /\b(problem|pain|struggle|frustrat\w*|because|so that|need to)\b/,
  success_metric:
    /\b(metrics?|kpis?|success|conversion|retention|churn|activation|measure\w*|%)/,
  acceptance:
    /\b(acceptance criteria|done when|must|should|given .* when .* then)\b/,
  scope_cut:
    /\b(mvp|out of scope|not in scope|only|v1|first version|skip|later)\b/,
  decomposed: /(^|\n)\s*(\d+[.)]|-|\*)\s|\b(steps?|first|then|next|finally)\b/,
  context_given:
    /\b(e\.g\.|for example|like|similar to|here is|existing|current)\b|https?:\/\//,
  specific_feedback:
    /\b(instead|change|move|rename|the (button|header|title|color|text))\b/,
  asks_tests: /\b(tests?|verify|check|validate|evals?)\b/,
  cost_latency:
    /\b(cost|price|cheap|fast|latency|speed|limits?|budget|tokens?)\b/,
  edge_cases:
    /\b(edge cases?|errors?|empty states?|offline|fails?|timeouts?|invalid)\b/,
  constraints:
    /\b(react|next\.?js|typescript|python|supabase|postgres|api|mobile|ios|android|constraints?)\b/,
};

const FALLBACK_ORDER: readonly Answer[] = ["n/a", "no", "partly", "yes"];

function wordCount(prompt: string): number {
  return prompt.trim().split(/\s+/).filter(Boolean).length;
}

/** 0 for a few words, close to 1 for a long, detailed prompt. */
function specificity(prompt: string, words: number): number {
  const lengthScore = Math.min(1, Math.log10(1 + words) / Math.log10(201));
  const hasNumbers = /\d/.test(prompt) ? 0.1 : 0;
  const hasStructure = /\n\s*(\d+[.)]|-|\*)\s/.test(prompt) ? 0.1 : 0;
  return Math.min(1, lengthScore * 0.8 + hasNumbers + hasStructure);
}

function pick(chosen: Answer, allowed: readonly Answer[]): Answer {
  if (allowed.includes(chosen)) return chosen;
  return FALLBACK_ORDER.find((a) => allowed.includes(a)) ?? allowed[0];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function answerOne(
  prompt: string,
  lower: string,
  words: number,
  spec: number,
  question: TrackQuestion,
): ScoredAnswer {
  const roll = unitHash(`${question.id}\u0000${prompt}`);
  const confidence = round2(
    0.55 + 0.4 * unitHash(`p\u0000${question.id}\u0000${prompt}`),
  );

  if (question.id === "vague_fix") {
    const vague = /\bfix it\b/.test(lower) && words < 10;
    return {
      q: question.id,
      a: pick(vague ? "yes" : "no", question.answers),
      p: vague ? 0.95 : confidence,
    };
  }

  const cue = CUES[question.id]?.test(lower) ?? false;
  let yes: number;
  if (question.polarity === "good") {
    yes = 0.1 + 0.6 * spec + (cue ? 0.3 : 0);
  } else {
    // Anti-patterns are likelier in short, vague prompts.
    yes = 0.5 * (1 - spec);
  }
  yes = Math.min(0.95, yes);

  let chosen: Answer;
  if (roll < yes) chosen = "yes";
  else if (roll < yes + 0.15) chosen = "partly";
  else chosen = "no";

  return { q: question.id, a: pick(chosen, question.answers), p: confidence };
}

export class StubScorer implements Scorer {
  readonly id = "stub" as const;

  async ready(onProgress?: ProgressCallback): Promise<void> {
    onProgress?.(1);
  }

  async score(
    prompt: string,
    questions: readonly TrackQuestion[],
  ): Promise<ScoredAnswer[]> {
    const lower = prompt.toLowerCase();
    const words = wordCount(prompt);
    const spec = specificity(prompt, words);
    return questions.map((q) => answerOne(prompt, lower, words, spec, q));
  }
}

export function createStubScorer(): Scorer {
  return new StubScorer();
}

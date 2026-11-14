import {
  type Answer,
  QUESTION_IDS_V0,
  type QuestionId,
  type TrackQuestion,
} from "@triplekeel/schema";
import { scoreKeyword } from "../src/keyword.js";
import type { LabelledPrompt } from "./holdout.js";

const BAD = new Set<QuestionId>([
  "no_why",
  "kitchen_sink",
  "vague_fix",
  "blind_accept",
]);

/** The 16 v0 questions with every answer allowed, for evaluation. */
export const V0_QUESTIONS: TrackQuestion[] = QUESTION_IDS_V0.map((id) => ({
  id,
  text: id,
  area: "eval",
  polarity: BAD.has(id) ? "bad" : "good",
  answers: ["yes", "partly", "no", "n/a"],
}));

/** Fills in the labelling guide's defaults. */
export function expectedAnswers(
  row: LabelledPrompt,
): Record<QuestionId, Answer> {
  const out = {} as Record<QuestionId, Answer>;
  for (const id of QUESTION_IDS_V0) {
    const firstOnly = id === "no_why" || id === "kitchen_sink";
    const followOnly = id === "specific_feedback" || id === "vague_fix";
    let fallback: Answer = "no";
    if (row.followUp && firstOnly) fallback = "n/a";
    if (!row.followUp && followOnly) fallback = "n/a";
    out[id] = row.labels[id] ?? fallback;
  }
  return out;
}

export type Mismatch = {
  id: string;
  q: QuestionId;
  expected: Answer;
  got: Answer;
};

export type AgreementResult = {
  correct: number;
  total: number;
  percent: number;
  perQuestion: { q: QuestionId; correct: number; total: number }[];
  mismatches: Mismatch[];
};

/**
 * Exact-match agreement. Expected "n/a" labels are left out, as in REI-247.
 * `useFollowUpFlag` passes each row's follow-up flag, as the extension does.
 * Without it, the scorer guesses from the text, as the paste page does.
 */
export function agreement(
  rows: readonly LabelledPrompt[],
  useFollowUpFlag: boolean,
): AgreementResult {
  const perQuestion = QUESTION_IDS_V0.map((q) => ({ q, correct: 0, total: 0 }));
  const mismatches: Mismatch[] = [];
  for (const row of rows) {
    const expected = expectedAnswers(row);
    const scores = scoreKeyword(
      row.text,
      V0_QUESTIONS,
      useFollowUpFlag ? { followUp: row.followUp } : undefined,
    );
    for (const [i, q] of QUESTION_IDS_V0.entries()) {
      if (expected[q] === "n/a") continue;
      const got = scores[i].a;
      perQuestion[i].total++;
      if (got === expected[q]) perQuestion[i].correct++;
      else mismatches.push({ id: row.id, q, expected: expected[q], got });
    }
  }
  const correct = perQuestion.reduce((s, x) => s + x.correct, 0);
  const total = perQuestion.reduce((s, x) => s + x.total, 0);
  return {
    correct,
    total,
    percent: total ? (correct / total) * 100 : 0,
    perQuestion,
    mismatches,
  };
}

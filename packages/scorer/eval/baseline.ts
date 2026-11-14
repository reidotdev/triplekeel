import { QUESTION_IDS_V0 } from "@triplekeel/schema";
import { scoreKeyword } from "../src/keyword.js";
import { expectedAnswers, V0_QUESTIONS } from "./agreement.js";
import type { LabelledPrompt } from "./holdout.js";

/**
 * Context for the agreement number. Most labels are "no", so a scorer that
 * always says "no" already agrees often. Recall on "yes" labels shows whether
 * the scorer finds the habits that are there.
 */
export function baselineAndRecall(rows: readonly LabelledPrompt[]): {
  alwaysNo: { correct: number; total: number };
  yes: { found: number; total: number };
  falseYes: { count: number; of: number };
} {
  let noCorrect = 0;
  let total = 0;
  let yesFound = 0;
  let yesTotal = 0;
  let falseYes = 0;
  let notYes = 0;
  for (const row of rows) {
    const expected = expectedAnswers(row);
    const scores = scoreKeyword(row.text, V0_QUESTIONS, {
      followUp: row.followUp,
    });
    for (const [i, q] of QUESTION_IDS_V0.entries()) {
      const e = expected[q];
      if (e === "n/a") continue;
      total++;
      if (e === "no") noCorrect++;
      if (e === "yes") {
        yesTotal++;
        if (scores[i].a === "yes") yesFound++;
      } else {
        notYes++;
        if (scores[i].a === "yes") falseYes++;
      }
    }
  }
  return {
    alwaysNo: { correct: noCorrect, total },
    yes: { found: yesFound, total: yesTotal },
    falseYes: { count: falseYes, of: notYes },
  };
}

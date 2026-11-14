import { buildReport, type TrackQuestion } from "@triplekeel/schema";
import { describe, expect, it } from "vitest";
import { V0_QUESTIONS } from "../eval/agreement.js";
import { DEV } from "../eval/dev.js";
import { HOLDOUT } from "../eval/holdout.js";
import { createKeywordScorer, createScorer, scoreKeyword } from "./index.js";

function answers(prompt: string, followUp?: boolean) {
  const scores = scoreKeyword(
    prompt,
    V0_QUESTIONS,
    followUp === undefined ? undefined : { followUp },
  );
  return Object.fromEntries(scores.map((s) => [s.q, s.a]));
}

describe("keyword scorer", () => {
  it("is the default scorer", async () => {
    const scorer = createScorer();
    expect(scorer.id).toBe("keyword");
    const progress: number[] = [];
    await scorer.ready((f) => progress.push(f));
    expect(progress).toEqual([1]);
  });

  it("marks a vague product request as no_why and kitchen_sink: partly", () => {
    expect(answers("Build me a CRM.")).toMatchObject({
      no_why: "yes",
      kitchen_sink: "partly",
      target_user: "no",
      vague_fix: "n/a",
      specific_feedback: "n/a",
    });
  });

  it("finds the habits in a detailed prompt", () => {
    const a = answers(
      "For first-time founders who lose track of investor updates, build a monthly update tool. Success: 50% send an update within 7 days. MVP only: no CRM sync. Steps: 1. template 2. reminders 3. send. Acceptance: a founder can send an update in under 5 minutes. Use Next.js and Supabase. Handle empty metrics and add tests for reminders.",
    );
    expect(a).toMatchObject({
      target_user: "yes",
      problem: "yes",
      success_metric: "yes",
      acceptance: "yes",
      scope_cut: "yes",
      decomposed: "yes",
      asks_tests: "yes",
      edge_cases: "yes",
      constraints: "yes",
      no_why: "no",
      kitchen_sink: "no",
    });
  });

  it("marks asking for acceptance criteria as partly", () => {
    expect(
      answers("Write a PRD for a reading list. Include acceptance criteria.")
        .acceptance,
    ).toBe("partly");
  });

  it("marks a short 'fix it' follow-up as vague_fix", () => {
    for (const text of [
      "fix it",
      "Fix it.",
      "That's wrong again, try again.",
    ]) {
      expect(answers(text, true)).toMatchObject({
        vague_fix: "yes",
        specific_feedback: "no",
        no_why: "n/a",
      });
    }
  });

  it("marks a detailed follow-up as specific_feedback", () => {
    expect(
      answers(
        "The table header is cut off at 360px. Wrap the text instead of truncating it.",
        true,
      ),
    ).toMatchObject({ specific_feedback: "yes", vague_fix: "no" });
  });

  it("guesses follow-ups from the text when the caller doesn't say", () => {
    expect(answers("fix it").vague_fix).toBe("yes");
    expect(answers("Build a booking page for dentists.").vague_fix).toBe("n/a");
  });

  it("doesn't count negated tests or edge cases", () => {
    const a = answers(
      "Generate the app. Don't bother with tests or edge cases, just ship it.",
    );
    expect(a).toMatchObject({
      asks_tests: "no",
      edge_cases: "no",
      blind_accept: "yes",
    });
  });

  it("doesn't count bare 'users' or 'people' as a target user", () => {
    expect(answers("Make an app that helps people sleep.").target_user).toBe(
      "no",
    );
    expect(answers("Let users export their data.").target_user).toBe("no");
    expect(answers("Users say the export is confusing.").target_user).toBe(
      "partly",
    );
  });

  it("only uses each question's allowed answers", () => {
    const limited: TrackQuestion[] = V0_QUESTIONS.map((q) => ({
      ...q,
      answers: ["yes", "no"],
    }));
    for (const row of [...DEV, ...HOLDOUT]) {
      for (const s of scoreKeyword(row.text, limited)) {
        expect(["yes", "no"]).toContain(s.a);
      }
    }
  });

  it("gives a low-confidence default for a question with no rule", () => {
    const extra = {
      ...V0_QUESTIONS[0],
      id: "brand_new" as TrackQuestion["id"],
    };
    expect(scoreKeyword("Build me a CRM.", [extra])).toEqual([
      { q: "brand_new", a: "n/a", p: 0.5 },
    ]);
  });

  it("returns answers that make a valid report", async () => {
    const scorer = createKeywordScorer();
    for (const row of [...DEV, ...HOLDOUT]) {
      const scored = await scorer.score(row.text, V0_QUESTIONS);
      expect(scored.map((s) => s.q)).toEqual(V0_QUESTIONS.map((q) => q.id));
      const report = buildReport({
        track: "product-manager",
        app: "claude",
        source: "live",
        scoredAt: new Date("2026-11-14T10:00:00Z"),
        promptLength: row.text.length,
        answers: scored,
      });
      expect(report.answers).toHaveLength(V0_QUESTIONS.length);
    }
  });

  it("scores 40 prompts well under a second", async () => {
    const scorer = createKeywordScorer();
    const start = performance.now();
    for (const row of [...DEV, ...HOLDOUT]) {
      await scorer.score(row.text, V0_QUESTIONS);
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

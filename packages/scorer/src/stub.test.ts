import {
  buildReport,
  QUESTION_IDS_V0,
  type TrackQuestion,
} from "@triplekeel/schema";
import { describe, expect, it } from "vitest";
import { createStubScorer, type Scorer } from "./index.js";

const BAD = new Set(["no_why", "kitchen_sink", "vague_fix", "blind_accept"]);

const questions: TrackQuestion[] = QUESTION_IDS_V0.map((id) => ({
  id,
  text: `Question ${id}?`,
  area: "area",
  polarity: BAD.has(id) ? "bad" : "good",
  answers: ["yes", "partly", "no", "n/a"],
}));

const SHORT = "make an app";
const LONG = `Write a PRD for a meal-planning app for busy parents with two kids.
Problem: parents spend 40 minutes a day deciding what to cook, because recipes ignore what's in the fridge.
Success metric: 30% of new users plan 3 meals in their first week.
MVP only: no grocery delivery, that's out of scope for v1.
Steps:
1. List the user stories.
2. Write acceptance criteria for each.
3. Cover edge cases: empty fridge, offline, invalid barcode.
Constraints: React Native and Supabase, keep API cost under $0.01 per plan.
Add a way to test each criterion.`;

async function yesCount(scorer: Scorer, prompt: string): Promise<number> {
  const answers = await scorer.score(prompt, questions);
  return answers.filter((a) => a.a === "yes" && !BAD.has(a.q)).length;
}

describe("stub scorer", () => {
  const scorer = createStubScorer();

  it("has the stub ID and is ready at once", async () => {
    expect(scorer.id).toBe("stub");
    const progress: number[] = [];
    await scorer.ready((f) => progress.push(f));
    await scorer.ready();
    expect(progress).toEqual([1]);
  });

  it("gives the same answers for the same prompt", async () => {
    const a = await scorer.score(LONG, questions);
    const b = await createStubScorer().score(LONG, questions);
    expect(b).toEqual(a);
  });

  it("gives different answers for different prompts", async () => {
    const a = await scorer.score(LONG, questions);
    const b = await scorer.score(`${LONG} Also add dark mode.`, questions);
    expect(b).not.toEqual(a);
  });

  it("returns one answer per question, in order", async () => {
    const answers = await scorer.score(LONG, questions);
    expect(answers.map((a) => a.q)).toEqual(questions.map((q) => q.id));
  });

  it("only uses each question's allowed answers", async () => {
    const limited = questions.map((q) => ({
      ...q,
      answers: ["no", "n/a"] as TrackQuestion["answers"],
    }));
    for (const prompt of [SHORT, LONG, "fix it"]) {
      for (const answer of await scorer.score(prompt, limited)) {
        expect(["no", "n/a"]).toContain(answer.a);
      }
    }
  });

  it("gives more yes to long, specific prompts", async () => {
    expect(await yesCount(scorer, LONG)).toBeGreaterThan(
      (await yesCount(scorer, SHORT)) + 4,
    );
  });

  it("marks a short 'fix it' as vague_fix: yes", async () => {
    for (const prompt of ["fix it", "pls fix it now", "It's broken, fix it!"]) {
      const answers = await scorer.score(prompt, questions);
      expect(answers.find((a) => a.q === "vague_fix")).toMatchObject({
        a: "yes",
        p: 0.95,
      });
    }
  });

  it("doesn't mark long or other prompts as vague_fix", async () => {
    const long =
      "fix it so the signup button submits the form and shows the error under the email field";
    for (const prompt of [long, LONG, "make it better"]) {
      const answers = await scorer.score(prompt, questions);
      expect(answers.find((a) => a.q === "vague_fix")?.a).toBe("no");
    }
  });

  it("returns p in 0–1 with 2 decimals, valid for a report", async () => {
    for (const prompt of ["", SHORT, LONG]) {
      const answers = await scorer.score(prompt, questions);
      for (const { p } of answers) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        expect(Math.round(p * 100) / 100).toBe(p);
      }
      const report = buildReport({
        track: "product-manager",
        app: "chatgpt",
        source: "live",
        scoredAt: new Date("2026-11-14T10:00:00Z"),
        promptLength: prompt.length,
        answers,
      });
      expect(report.answers).toHaveLength(questions.length);
    }
  });

  it("handles an empty question list", async () => {
    expect(await scorer.score(LONG, [])).toEqual([]);
  });
});

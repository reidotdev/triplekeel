import { describe, expect, it } from "vitest";
import {
  ANSWERS,
  AnswerSchema,
  QUESTION_IDS,
  QUESTION_IDS_V0,
  QuestionIdSchema,
} from "./index.js";

describe("question IDs v0", () => {
  it("are frozen", () => {
    // Never edit this list. v0 IDs never change or get removed.
    expect([...QUESTION_IDS_V0]).toEqual([
      "target_user",
      "problem",
      "success_metric",
      "acceptance",
      "scope_cut",
      "decomposed",
      "context_given",
      "specific_feedback",
      "asks_tests",
      "cost_latency",
      "edge_cases",
      "constraints",
      "no_why",
      "kitchen_sink",
      "vague_fix",
      "blind_accept",
    ]);
  });

  it("stay at the start of QUESTION_IDS, so new IDs are only appended", () => {
    expect(QUESTION_IDS.slice(0, QUESTION_IDS_V0.length)).toEqual([
      ...QUESTION_IDS_V0,
    ]);
    expect(new Set(QUESTION_IDS).size).toBe(QUESTION_IDS.length);
    expect(QUESTION_IDS.slice(QUESTION_IDS_V0.length)).toEqual([
      "metric_interpretation",
      "audience_update",
      "stakeholder_tradeoff",
      "launch_readiness",
      "launch_learning",
      "strategic_tradeoff",
      "commercial_impact",
      "agent_context",
      "agent_workflow",
    ]);
  });

  it("accepts known IDs and rejects anything else", () => {
    expect(QuestionIdSchema.parse("target_user")).toBe("target_user");
    for (const bad of ["Target_User", "unknown", "", "../target_user", 1]) {
      expect(QuestionIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("answers", () => {
  it("are the fixed set", () => {
    expect([...ANSWERS]).toEqual(["yes", "partly", "no", "n/a"]);
    expect(AnswerSchema.safeParse("maybe").success).toBe(false);
  });
});

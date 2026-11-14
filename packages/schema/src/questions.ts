import { z } from "zod";

/**
 * Question IDs v0. Frozen: these IDs never change and are never removed.
 * New questions are appended to QUESTION_IDS, never inserted here.
 */
export const QUESTION_IDS_V0 = [
  // Good
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
  // Bad (anti-patterns, feed "Stop doing")
  "no_why",
  "kitchen_sink",
  "vague_fix",
  "blind_accept",
] as const;

/** Every known question ID. Starts with v0; later IDs are appended. */
export const QUESTION_IDS = [
  ...QUESTION_IDS_V0,
  // Added for the PM track (REI-273). Keep appending; never reorder.
  "metric_interpretation",
  "audience_update",
  "stakeholder_tradeoff",
  "launch_readiness",
  "launch_learning",
  "strategic_tradeoff",
  "commercial_impact",
  "agent_context",
  "agent_workflow",
] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export const QuestionIdSchema = z.enum(QUESTION_IDS);

export const POLARITIES = ["good", "bad"] as const;
export type Polarity = (typeof POLARITIES)[number];

/** The fixed answers a typed question can have. Also the report's `a` field. */
export const ANSWERS = ["yes", "partly", "no", "n/a"] as const;
export type Answer = (typeof ANSWERS)[number];
export const AnswerSchema = z.enum(ANSWERS);

/** The levels every track uses, in order. */
export const LEVELS = ["junior", "mid", "senior"] as const;
export type Level = (typeof LEVELS)[number];

import type { ReportAnswer, TrackQuestion } from "@triplekeel/schema";

export type ScorerId = "stub" | "keyword" | "gemma";

/** One answer to one question: `{ q, a, p }`, as in the report. */
export type ScoredAnswer = ReportAnswer;

/** Called while a scorer loads. `fraction` goes from 0 to 1. */
export type ProgressCallback = (fraction: number) => void;

/**
 * Scores a prompt against a track's typed questions. Runs only in the
 * browser. The prompt text never leaves score() except as answers.
 */
export interface Scorer {
  readonly id: ScorerId;
  /** Loads the model if needed. Safe to call more than once. */
  ready(onProgress?: ProgressCallback): Promise<void>;
  /**
   * Returns one answer per question, in the same order. Each answer is one
   * of that question's allowed answers, and `p` is 0–1 with 2 decimals.
   */
  score(
    prompt: string,
    questions: readonly TrackQuestion[],
    context?: ScoreContext,
  ): Promise<ScoredAnswer[]>;
}

/** Optional facts the caller knows about the prompt. Never prompt text. */
export type ScoreContext = {
  /**
   * True if the prompt replies to the AI's earlier answer in the same chat,
   * false if it starts a task. The extension knows this from the message
   * index. If left out, the scorer guesses from the text.
   */
  followUp?: boolean;
};

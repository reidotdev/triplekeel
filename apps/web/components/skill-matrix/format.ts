// Pure text and layout helpers for the skill matrix. Kept apart from the
// component so they are easy to test.
import type {
  Level,
  LevelThresholds,
  SkillMatrixArea,
} from "../../src/lib/skill-matrix";

/** Top of the score scale. Level thresholds use the same 0–3 scale. */
export const SCORE_MAX = 3;

/**
 * Where to install the extension. There is no store listing yet, so this
 * points to the install steps in the repository for now.
 */
export const EXTENSION_INSTALL_URL =
  "https://github.com/reidotdev/triplekeel/blob/main/apps/extension/README.md#install";

/** Where a signed-in user links the extension to their account. */
export const CONNECT_PATH = "/connect";

export const NO_EVIDENCE_TEXT = "Not enough evidence yet";

/**
 * Confidence cut-offs on the 0–1 scale. Below `medium` is low, from `medium`
 * up to `high` is medium, and from `high` up is high.
 */
export const CONFIDENCE_CUTOFFS = { medium: 0.4, high: 0.7 } as const;

/**
 * The score with one decimal, rounded down, so the text never crosses a level
 * threshold the level itself has not reached. 0.96 shows as "0.9", not "1.0".
 */
export function formatScore(score: number): string {
  return (Math.floor(score * 10 + 1e-9) / 10).toFixed(1);
}

/** "1.8 · junior", or "Not enough evidence yet" below the evidence minimum. */
export function levelText(score: number | null, level: Level | null): string {
  if (score === null || level === null) return NO_EVIDENCE_TEXT;
  return `${formatScore(score)} · ${level}`;
}

/** True when the area has a level and it is below the target. */
export function isGapArea(area: SkillMatrixArea): boolean {
  return area.level !== null && area.gap !== null && area.gap > 0;
}

/** "Gap: 1 level", "Gap: 2 levels", "At target", or null with no evidence. */
export function gapText(gap: number | null): string | null {
  if (gap === null) return null;
  if (gap <= 0) return "At target";
  return `Gap: ${gap} ${gap === 1 ? "level" : "levels"}`;
}

/** "Low confidence", "Medium confidence" or "High confidence". */
export function confidenceText(confidence: number | null): string | null {
  if (confidence === null) return null;
  if (confidence >= CONFIDENCE_CUTOFFS.high) return "High confidence";
  if (confidence >= CONFIDENCE_CUTOFFS.medium) return "Medium confidence";
  return "Low confidence";
}

export function promptsText(count: number): string {
  return `${count} ${count === 1 ? "prompt" : "prompts"}`;
}

export function basedOnText(totalPrompts: number): string {
  return `Based on ${promptsText(totalPrompts)}`;
}

function toPercent(value: number): number {
  const percent = (value / SCORE_MAX) * 100;
  return Math.min(100, Math.max(0, percent));
}

/** Width of the level bar, as a percentage of the 0–3 scale. */
export function scorePercent(score: number): number {
  return toPercent(score);
}

/** Position of the target marker: where the target level starts. */
export function targetPercent(
  thresholds: LevelThresholds,
  targetLevel: Level,
): number {
  return toPercent(thresholds[targetLevel]);
}

/**
 * How to align the target label so it stays inside the bar: from its left
 * edge near the start, from its right edge near the end, centred otherwise.
 */
export function markerLabelAlign(percent: number): "start" | "center" | "end" {
  if (percent < 15) return "start";
  if (percent > 85) return "end";
  return "center";
}

/** The text a screen reader gets in place of the bar. */
export function barDescription(area: SkillMatrixArea): string {
  const target = `Target ${area.targetLevel} starts at ${formatScore(
    area.thresholds[area.targetLevel],
  )}.`;
  if (area.score === null || area.level === null) {
    return `No score yet. ${target}`;
  }
  return `Score ${formatScore(area.score)} of ${SCORE_MAX}, ${area.level}. ${target}`;
}

/** View model for the skill matrix. REI-269 renders it; REI-274 fills it from the database. */
export type Level = "junior" | "mid" | "senior";

export const LEVELS: readonly Level[] = ["junior", "mid", "senior"];

/** Score where each level starts, on the 0–3 scale. */
export type LevelThresholds = { junior: number; mid: number; senior: number };

export type SkillMatrixArea = {
  id: string;
  name: string;
  /** Null below the evidence minimum ("Not enough evidence yet"). */
  level: Level | null;
  /** 0–3 scale. Null below the evidence minimum. */
  score: number | null;
  /** 0–1. Null below the evidence minimum. */
  confidence: number | null;
  /** Prompts that touched this area. Null below the evidence minimum. */
  nPrompts: number | null;
  targetLevel: Level;
  /** Steps from level to target, never below 0. Null below the evidence minimum. */
  gap: number | null;
  thresholds: LevelThresholds;
};

export type SkillMatrixData =
  | {
      kind: "empty";
      trackName: string;
      currentLevel: Level;
      targetLevel: Level;
    }
  | {
      kind: "levels";
      trackName: string;
      currentLevel: Level;
      targetLevel: Level;
      /** All the user's scored prompts, for "Based on N prompts". */
      totalPrompts: number;
      /** In display order: biggest gap first, then lowest score. */
      areas: SkillMatrixArea[];
    };

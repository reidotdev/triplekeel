// Fake skill matrix profiles for the preview page and tests (REI-269).
// Area ids and names come from tracks/product-manager/skill-areas.yaml.
import {
  LEVELS,
  type Level,
  type LevelThresholds,
  type SkillMatrixArea,
  type SkillMatrixData,
} from "./skill-matrix";

const PM_THRESHOLDS: LevelThresholds = { junior: 0, mid: 1, senior: 2 };
const TRACK_NAME = "Product manager";

const PM_AREAS = {
  problem_discovery: "Problem discovery and user research",
  specs: "Writing specs and PRDs",
  prioritization: "Prioritization and roadmapping",
  metrics: "Metrics and experiments",
  eng_design_collab: "Delivery with engineering and design",
  stakeholder_comms: "Stakeholder communication",
  ai_prototyping: "Prototyping with AI tools",
  ai_product_sense: "AI product sense",
  go_to_market: "Go-to-market and launch",
  strategy: "Strategy and vision",
  ai_agents_daily: "Working with AI agents day to day",
} as const;

type AreaId = keyof typeof PM_AREAS;

function levelFor(score: number): Level {
  if (score >= PM_THRESHOLDS.senior) return "senior";
  if (score >= PM_THRESHOLDS.mid) return "mid";
  return "junior";
}

function scored(
  id: AreaId,
  targetLevel: Level,
  score: number,
  confidence: number,
  nPrompts: number,
): SkillMatrixArea {
  const level = levelFor(score);
  return {
    id,
    name: PM_AREAS[id],
    level,
    score,
    confidence,
    nPrompts,
    targetLevel,
    gap: Math.max(0, LEVELS.indexOf(targetLevel) - LEVELS.indexOf(level)),
    thresholds: PM_THRESHOLDS,
  };
}

/** An area below the evidence minimum. */
function unscored(id: AreaId, targetLevel: Level): SkillMatrixArea {
  return {
    id,
    name: PM_AREAS[id],
    level: null,
    score: null,
    confidence: null,
    nPrompts: null,
    targetLevel,
    gap: null,
    thresholds: PM_THRESHOLDS,
  };
}

/** A new user who hasn't scored a chat yet. */
export const newUserMatrix: SkillMatrixData = {
  kind: "empty",
  trackName: TRACK_NAME,
  currentLevel: "junior",
  targetLevel: "mid",
};

/** A junior PM with several gaps and four areas without enough evidence. */
export const juniorWithGapsMatrix: SkillMatrixData = {
  kind: "levels",
  trackName: TRACK_NAME,
  currentLevel: "junior",
  targetLevel: "mid",
  totalPrompts: 38,
  areas: [
    scored("problem_discovery", "mid", 0.42, 0.32, 5),
    scored("metrics", "mid", 0.55, 0.45, 8),
    scored("stakeholder_comms", "mid", 0.71, 0.5, 9),
    scored("specs", "mid", 0.86, 0.62, 14),
    scored("prioritization", "mid", 0.93, 0.41, 7),
    scored("ai_agents_daily", "mid", 1.12, 0.58, 11),
    scored("eng_design_collab", "mid", 1.34, 0.74, 16),
    unscored("ai_prototyping", "mid"),
    unscored("ai_product_sense", "mid"),
    unscored("go_to_market", "mid"),
    unscored("strategy", "mid"),
  ],
};

/** A junior PM who is nearly mid: two small gaps, one area above target. */
export const nearlyMidMatrix: SkillMatrixData = {
  kind: "levels",
  trackName: TRACK_NAME,
  currentLevel: "junior",
  targetLevel: "mid",
  totalPrompts: 164,
  areas: [
    scored("strategy", "mid", 0.88, 0.52, 7),
    scored("go_to_market", "mid", 0.96, 0.66, 9),
    scored("prioritization", "mid", 1.08, 0.71, 18),
    scored("problem_discovery", "mid", 1.21, 0.78, 24),
    scored("metrics", "mid", 1.37, 0.69, 15),
    scored("stakeholder_comms", "mid", 1.52, 0.82, 31),
    scored("ai_product_sense", "mid", 1.64, 0.6, 12),
    scored("specs", "mid", 1.86, 0.88, 42),
    scored("eng_design_collab", "mid", 1.95, 0.84, 37),
    scored("ai_agents_daily", "mid", 2.21, 0.91, 48),
    unscored("ai_prototyping", "mid"),
  ],
};

export const skillMatrixFixtures = [
  { id: "new-user", label: "New user", data: newUserMatrix },
  {
    id: "junior-with-gaps",
    label: "Junior with gaps",
    data: juniorWithGapsMatrix,
  },
  { id: "nearly-mid", label: "Nearly mid", data: nearlyMidMatrix },
] as const;

import { createKeywordScorer } from "./keyword.js";
import type { Scorer } from "./types.js";

export {
  createKeywordScorer,
  KeywordScorer,
  scoreKeyword,
} from "./keyword.js";
export {
  DEFAULT_TRACKS,
  isPersonal,
  PERSONAL_KEYWORDS,
  type RoutableTrack,
  type RouteResult,
  routeTrack,
  TRACK_KEYWORDS,
} from "./route.js";
export { createStubScorer, StubScorer } from "./stub.js";
export type {
  ProgressCallback,
  ScoreContext,
  ScoredAnswer,
  Scorer,
  ScorerId,
} from "./types.js";

/**
 * The scorer the extension and the paste page should use. The MVP uses the
 * keyword scorer (ADR-0012). Callers use this, so a later scorer can replace
 * it without changes elsewhere.
 */
export function createScorer(): Scorer {
  return createKeywordScorer();
}

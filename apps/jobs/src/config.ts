// Fixed settings for the daily job. Raise the caps when a track or area is
// added: the PM track needs 11 areas × 2 kinds = 22 model calls and at most
// 22 × 3 = 66 Exa calls.

/** Picks must be published in this many days before the run. */
export const WINDOW_DAYS = 90;

/** Hard cap on Exa requests per run, retries included. */
export const MAX_EXA_CALLS = 80;

/** Hard cap on Claude requests per run: one per area and kind. */
export const MAX_ANTHROPIC_CALLS = 22;

/** Picks kept per area and kind. */
export const MAX_PICKS = 3;

/** Area and kind sets processed at the same time. */
export const CONCURRENCY = 3;

export const MODEL = "claude-haiku-5-5";

/** Exa's podcast library. `category: "podcast"` does not filter (REI-248). */
export const PODCAST_DOMAIN = "exa.ai/library/podcast";

export const EXA_BASE_URL = "https://api.exa.ai";

/** Characters of each highlight shown to the model. */
export const HIGHLIGHT_CHARS = 600;

/** Candidates shown to the model per area and kind. */
export const MAX_CANDIDATES = 20;

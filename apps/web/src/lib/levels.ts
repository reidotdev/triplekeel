// The signed-in user's level and gap per skill area (REI-270). The database
// computes levels from reports (public.recompute_user_levels). This reads them
// through public.read_level_gaps(), with a Supabase client that sends the
// Clerk session token, so row level security limits it to the user's rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEVELS, type Level } from "./profile";

export type LevelGap = {
  /** 1 is the biggest gap. Ties go to the lower score. */
  rank: number;
  area_id: string;
  area_name: string;
  /** null: not enough evidence yet (under 5 prompts in the area). */
  level: Level | null;
  target_level: Level | null;
  /** Steps from the level to the target: 0, 1 or 2. null when either is unknown. */
  gap: number | null;
  /** The area score on the 0–3 scale that the track thresholds apply to. */
  score: number | null;
  /** 0 to 1. Grows with prompts, shrinks when answers disagree. */
  confidence: number | null;
  n_prompts: number | null;
};

function isLevelOrNull(value: unknown): value is Level | null {
  return value === null || LEVELS.includes(value as Level);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isLevelGap(row: unknown): row is LevelGap {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.rank === "number" &&
    typeof r.area_id === "string" &&
    typeof r.area_name === "string" &&
    isLevelOrNull(r.level) &&
    isLevelOrNull(r.target_level) &&
    isNumberOrNull(r.gap) &&
    isNumberOrNull(r.score) &&
    isNumberOrNull(r.confidence) &&
    isNumberOrNull(r.n_prompts)
  );
}

/**
 * Every skill area of the user's track, biggest gap first. Areas without
 * enough evidence come last with a null level. Returns an empty list when
 * the user has no profile or track, and null if the read fails.
 */
export async function readLevelGaps(
  supabase: SupabaseClient,
): Promise<LevelGap[] | null> {
  const { data, error } = await supabase.rpc("read_level_gaps");
  if (error) {
    console.error("Level read failed", error.code ?? "unknown");
    return null;
  }
  if (!Array.isArray(data) || !data.every(isLevelGap)) {
    console.error("Level read failed", "bad_result");
    return null;
  }
  return [...data].sort((a, b) => a.rank - b.rank);
}

/** The gaps worth working on: areas below the target, biggest first. */
export function openGaps(rows: readonly LevelGap[]): LevelGap[] {
  return rows.filter((row) => (row.gap ?? 0) > 0);
}

// Fills the skill matrix view model (./skill-matrix) from the database
// (REI-274). Every read uses the caller's Supabase client, which sends the
// Clerk session token, so row level security limits it to the user's rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readLevelGaps } from "./levels";
import type { CompleteProfile } from "./profile";
import type {
  LevelThresholds,
  SkillMatrixArea,
  SkillMatrixData,
} from "./skill-matrix";
import { getTrackCatalog, type TrackSummary } from "./tracks";

/** A complete profile on a track. Waitlisted users without a track get no matrix. */
export type SkillMatrixProfile = Pick<
  CompleteProfile,
  "user_id" | "job_title" | "current_level" | "target_level"
> & { track_id: string };

function isThresholds(value: unknown): value is LevelThresholds {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.junior === "number" &&
    typeof t.mid === "number" &&
    typeof t.senior === "number"
  );
}

/** Each skill area's thresholds for one track, by area ID. */
async function readThresholds(
  supabase: SupabaseClient,
  trackId: string,
): Promise<Map<string, LevelThresholds> | null> {
  const { data, error } = await supabase
    .from("skill_areas")
    .select("id, thresholds")
    .eq("track_id", trackId);
  if (error) {
    console.error("Threshold read failed", error.code ?? "unknown");
    return null;
  }
  if (!Array.isArray(data)) {
    console.error("Threshold read failed", "bad_result");
    return null;
  }
  const byArea = new Map<string, LevelThresholds>();
  for (const row of data as unknown[]) {
    const r = row as Record<string, unknown> | null;
    if (typeof r?.id !== "string" || !isThresholds(r.thresholds)) {
      console.error("Threshold read failed", "bad_result");
      return null;
    }
    const { junior, mid, senior } = r.thresholds;
    byArea.set(r.id, { junior, mid, senior });
  }
  return byArea;
}

/** How many reports the user has for the track. Only the count comes back. */
async function countPrompts(
  supabase: SupabaseClient,
  profile: SkillMatrixProfile,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.user_id)
    .eq("track_id", profile.track_id);
  if (error) {
    console.error("Prompt count failed", error.code ?? "unknown");
    return null;
  }
  if (typeof count !== "number") {
    console.error("Prompt count failed", "bad_result");
    return null;
  }
  return count;
}

/**
 * The signed-in user's skill matrix: the "empty" kind until they have a
 * report on their track, then every area of the track in the database's
 * order (biggest gap first, then the lowest score). Returns null if a read
 * fails. Logs only error codes, never data.
 */
export async function loadSkillMatrix(
  supabase: SupabaseClient,
  profile: SkillMatrixProfile,
  catalog: readonly TrackSummary[] = getTrackCatalog(),
): Promise<SkillMatrixData | null> {
  const [gaps, thresholds, totalPrompts] = await Promise.all([
    readLevelGaps(supabase),
    readThresholds(supabase, profile.track_id),
    countPrompts(supabase, profile),
  ]);
  if (gaps === null || thresholds === null || totalPrompts === null) {
    return null;
  }

  const base = {
    trackName:
      catalog.find((track) => track.id === profile.track_id)?.name ??
      profile.job_title,
    currentLevel: profile.current_level,
    targetLevel: profile.target_level,
  };
  if (totalPrompts === 0) return { kind: "empty", ...base };

  const areas: SkillMatrixArea[] = [];
  for (const row of gaps) {
    const areaThresholds = thresholds.get(row.area_id);
    if (!areaThresholds) {
      console.error("Skill matrix read failed", "missing_thresholds");
      return null;
    }
    areas.push({
      id: row.area_id,
      name: row.area_name,
      level: row.level,
      score: row.score,
      confidence: row.confidence,
      nPrompts: row.n_prompts,
      targetLevel: row.target_level ?? profile.target_level,
      gap: row.gap,
      thresholds: areaThresholds,
    });
  }
  return { kind: "levels", ...base, totalPrompts, areas };
}

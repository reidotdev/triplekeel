// Node-only: reads track folders from disk. Not exported from index.ts, so
// the browser extension never bundles node:fs.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { checkTrack, type Track, type TrackCheckResult } from "./track.ts";

export const TRACK_FILES = {
  track: "track.yaml",
  skillAreas: "skill-areas.yaml",
  questions: "questions.yaml",
} as const;

/** Lists the track folders directly under `tracksDir`. */
export function listTrackFolders(tracksDir: string): string[] {
  return readdirSync(tracksDir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => statSync(join(tracksDir, name)).isDirectory())
    .sort();
}

/** Reads and validates one track folder. */
export function loadTrackFolder(
  tracksDir: string,
  folder: string,
): TrackCheckResult {
  const dir = join(tracksDir, folder);
  const errors: string[] = [];
  const parsed: Record<keyof typeof TRACK_FILES, unknown> = {
    track: undefined,
    skillAreas: undefined,
    questions: undefined,
  };

  for (const [key, file] of Object.entries(TRACK_FILES) as [
    keyof typeof TRACK_FILES,
    string,
  ][]) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      errors.push(`${file}: file is missing`);
      continue;
    }
    try {
      parsed[key] = parse(readFileSync(path, "utf8"));
    } catch (error) {
      errors.push(`${file}: invalid YAML: ${(error as Error).message}`);
    }
  }

  const extra = readdirSync(dir).filter(
    (name) =>
      !name.startsWith(".") &&
      !(Object.values(TRACK_FILES) as string[]).includes(name),
  );
  for (const name of extra) {
    errors.push(`${name}: unexpected file in track folder`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return checkTrack({ folder, ...parsed });
}

/** Reads every track folder, and throws with all errors if one is invalid. */
export function loadAllTracks(tracksDir: string): Track[] {
  const tracks: Track[] = [];
  const errors: string[] = [];
  for (const folder of listTrackFolders(tracksDir)) {
    const result = loadTrackFolder(tracksDir, folder);
    if (result.ok) tracks.push(result.track);
    else errors.push(...result.errors.map((error) => `${folder}/${error}`));
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return tracks;
}

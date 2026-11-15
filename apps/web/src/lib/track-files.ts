// Node-only: reads the track files at build time and in tests. The Worker has
// no file system, so `next.config.ts` inlines the result as `TRACK_CATALOG`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { TrackSummary } from "./tracks";

export function readTrackCatalog(tracksDir: string): TrackSummary[] {
  const catalog: TrackSummary[] = [];
  for (const folder of readdirSync(tracksDir).sort()) {
    const file = join(tracksDir, folder, "track.yaml");
    if (folder.startsWith(".") || !existsSync(file)) continue;
    const track = parse(readFileSync(file, "utf8")) as {
      id?: unknown;
      name?: unknown;
      alt_titles?: unknown;
    } | null;
    if (
      !track ||
      typeof track.id !== "string" ||
      typeof track.name !== "string" ||
      !Array.isArray(track.alt_titles) ||
      !track.alt_titles.every((title) => typeof title === "string")
    ) {
      throw new Error(`${file}: id, name and alt_titles are required`);
    }
    catalog.push({
      id: track.id,
      name: track.name,
      altTitles: track.alt_titles,
    });
  }
  if (catalog.length === 0) throw new Error(`No tracks found in ${tracksDir}`);
  return catalog;
}

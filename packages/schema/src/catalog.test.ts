// CI check: supabase/seed.sql must match tracks/, and reports must fit the
// database's answer ceiling (REI-311).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCatalog, catalogSeedSql, QUESTION_IDS } from "./index.js";
import { loadAllTracks } from "./track-files.js";

const root = new URL("../../../", import.meta.url);
const catalog = buildCatalog(
  loadAllTracks(fileURLToPath(new URL("tracks", root))),
);

describe("database catalog", () => {
  it("seed.sql is generated from tracks/", () => {
    const seed = readFileSync(new URL("supabase/seed.sql", root), "utf8");
    // Run `node scripts/sync-catalog.mts --write-seed` if this fails.
    expect(seed).toBe(catalogSeedSql(catalog));
  });

  it("has every question of every track", () => {
    for (const track of catalog.tracks) {
      const areas = new Set(track.areas.map((area) => area.id));
      for (const question of track.questions) {
        expect(areas).toContain(question.area_id);
      }
    }
    expect(catalog.tracks.flatMap((t) => t.questions).length).toBeGreaterThan(
      0,
    );
  });

  it("fits the signals.answers ceiling of 100", () => {
    // parseReport() allows QUESTION_IDS.length answers. The table allows 100.
    expect(QUESTION_IDS.length).toBeLessThanOrEqual(100);
  });
});

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

  it("carries each area's level thresholds", () => {
    // public.recompute_user_levels reads them from skill_areas.thresholds.
    for (const area of catalog.tracks.flatMap((t) => t.areas)) {
      expect(Object.keys(area.thresholds)).toEqual(["junior", "mid", "senior"]);
      expect(area.thresholds.junior).toBeGreaterThanOrEqual(0);
      expect(area.thresholds.senior).toBeLessThanOrEqual(3);
    }
  });

  it("carries a card label for every product-manager question", () => {
    // public.build_keel_check copies questions.card_label into the card.
    const pm = catalog.tracks.find((track) => track.id === "product-manager");
    expect(pm?.questions.length).toBe(25);
    for (const question of pm?.questions ?? []) {
      expect(question.card_label, question.id).toMatch(/^[a-z].{0,79}$/);
    }
  });

  it("fits the signals.answers ceiling of 100", () => {
    // parseReport() allows QUESTION_IDS.length answers. The table allows 100.
    expect(QUESTION_IDS.length).toBeLessThanOrEqual(100);
  });
});

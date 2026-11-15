import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { readTrackCatalog } from "./track-files";
import {
  matchTrack,
  parseTrackCatalog,
  type TrackSummary,
  titleSuggestions,
} from "./tracks";

// The real track files, so the test follows tracks/product-manager/track.yaml.
// Walk up to the repository root, because `tsc -b` also emits this test to dist.
function findTracksDir(): string {
  let dir = import.meta.dirname;
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Repository root not found");
    dir = parent;
  }
  return join(dir, "tracks");
}

const catalog = readTrackCatalog(findTracksDir());

describe("readTrackCatalog", () => {
  it("reads the product manager track", () => {
    const track = catalog.find((item) => item.id === "product-manager");
    expect(track?.name).toBe("Product manager");
    expect(track?.altTitles.length).toBeGreaterThan(0);
  });
});

describe("matchTrack", () => {
  it("matches the track name and every alternative title in the file", () => {
    for (const track of catalog) {
      for (const title of [track.name, ...track.altTitles]) {
        expect(matchTrack(title, catalog)?.id, title).toBe(track.id);
      }
    }
  });

  it.each([
    "product manager",
    "  PRODUCT   MANAGER  ",
    "pm",
    "Product Owner",
    "apm",
    "Senior PM",
    "Senior Product Manager",
    "Product Manager, Growth",
    "Lead PM (Payments)",
    "Product-Manager",
  ])("turns on the product manager track for %j", (title) => {
    expect(matchTrack(title, catalog)?.id).toBe("product-manager");
  });

  it.each([
    "",
    "   ",
    "Designer",
    "Project manager",
    "Product marketing manager",
    "Product designer",
    "Software engineer",
    "TPM",
    "Rapment",
  ])("finds no track for %j", (title) => {
    expect(matchTrack(title, catalog)).toBeNull();
  });

  it("uses the catalog it is given, not a fixed list", () => {
    const other: TrackSummary[] = [
      { id: "designer", name: "Designer", altTitles: ["UX designer"] },
    ];
    expect(matchTrack("Senior UX Designer", other)?.id).toBe("designer");
    expect(matchTrack("Product manager", other)).toBeNull();
  });
});

describe("titleSuggestions", () => {
  it("lists each track name first, then its other titles, without repeats", () => {
    const suggestions = titleSuggestions([
      { id: "a", name: "Product manager", altTitles: ["PM", "pm", "APM"] },
    ]);
    expect(suggestions).toEqual(["Product manager", "PM", "APM"]);
  });
});

describe("parseTrackCatalog", () => {
  it("round-trips the catalog that the build inlines", () => {
    expect(parseTrackCatalog(JSON.stringify(catalog))).toEqual(catalog);
  });

  it("returns no tracks for missing or broken input", () => {
    expect(parseTrackCatalog(undefined)).toEqual([]);
    expect(parseTrackCatalog("not json")).toEqual([]);
    expect(parseTrackCatalog('{"id":"x"}')).toEqual([]);
    expect(parseTrackCatalog('[{"id":"x"}]')).toEqual([]);
  });
});

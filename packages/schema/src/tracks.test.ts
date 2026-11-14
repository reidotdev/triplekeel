// CI check: validates every folder under tracks/. Runs as part of `pnpm test`.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TRACK_IDS } from "./index.js";
import { listTrackFolders, loadTrackFolder } from "./track-files.js";

const tracksDir = fileURLToPath(new URL("../../../tracks", import.meta.url));
const folders = listTrackFolders(tracksDir);

describe("tracks/", () => {
  it("has the product-manager track", () => {
    expect(folders).toContain("product-manager");
  });

  it("matches TRACK_IDS, so reports and track data agree", () => {
    expect(folders).toEqual([...TRACK_IDS].sort());
  });

  it.each(folders)("%s is a valid track", (folder) => {
    const result = loadTrackFolder(tracksDir, folder);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

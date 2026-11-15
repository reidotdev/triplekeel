import { join } from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { readTrackCatalog } from "./src/lib/track-files";

// Next.js runs from apps/web. The track files live at the repository root.
const tracksDir = join(process.cwd(), "..", "..", "tracks");

const nextConfig: NextConfig = {
  transpilePackages: ["@triplekeel/schema"],
  env: {
    TRACK_CATALOG: JSON.stringify(readTrackCatalog(tracksDir)),
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;

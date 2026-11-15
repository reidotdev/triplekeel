import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@triplekeel/schema"],
};

initOpenNextCloudflareForDev();

export default nextConfig;

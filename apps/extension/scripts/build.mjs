import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import {
  buildManifest,
  cleanBaseUrl,
  extensionIdFromKey,
} from "./manifest.mjs";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const zip = resolve(root, "triplekeel-extension.zip");

// The API address comes from the environment, never from the source.
const apiBase = cleanBaseUrl(process.env.TRIPLEKEEL_API_BASE);
// The web app is on the same origin unless EXTENSION_APP_URL says otherwise.
const appUrl = cleanBaseUrl(process.env.EXTENSION_APP_URL) || apiBase;
if (!apiBase) {
  console.warn(
    "TRIPLEKEEL_API_BASE is not set. This build cannot connect to an account.",
  );
}

const baseManifest = JSON.parse(
  await readFile(resolve(root, "manifest.json"), "utf8"),
);
const manifest = buildManifest(baseManifest, appUrl);

await rm(dist, { recursive: true, force: true });
await rm(zip, { force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: {
    background: resolve(root, "src/background.ts"),
    content: resolve(root, "src/content.ts"),
    popup: resolve(root, "src/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  define: {
    __TRIPLEKEEL_API_BASE__: JSON.stringify(apiBase),
    __TRIPLEKEEL_APP_URL__: JSON.stringify(appUrl),
  },
  logLevel: "warning",
});
await Promise.all([
  writeFile(
    resolve(dist, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
  cp(resolve(root, "popup.html"), resolve(dist, "popup.html")),
  cp(resolve(root, "popup.css"), resolve(dist, "popup.css")),
]);
await execFileAsync("zip", ["-qr", zip, "."], { cwd: dist });
console.log(`Extension ID: ${extensionIdFromKey(manifest.key)}`);

import { execFile } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const zip = resolve(root, "triplekeel-extension.zip");

await rm(dist, { recursive: true, force: true });
await rm(zip, { force: true });
await mkdir(dist, { recursive: true });
await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(dist, "manifest.json")),
  cp(resolve(root, "popup.html"), resolve(dist, "popup.html")),
  writeFile(
    resolve(dist, "api-base.js"),
    `globalThis.TRIPLEKEEL_API_BASE = ${JSON.stringify(process.env.TRIPLEKEEL_API_BASE ?? "")};\n`,
  ),
]);
await execFileAsync("zip", ["-qr", zip, "."], { cwd: dist });

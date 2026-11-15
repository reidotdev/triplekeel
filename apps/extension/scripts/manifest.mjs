import { createHash } from "node:crypto";

const ALLOWED_HOSTS = ["https://claude.ai/*", "https://chatgpt.com/*"];

/** Removes trailing slashes. Returns "" for a missing or invalid URL. */
export function cleanBaseUrl(value) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : "";
  } catch {
    return "";
  }
}

/** The match pattern that lets the web app message the extension. */
export function connectPattern(appUrl) {
  const url = new URL(appUrl);
  // Match patterns have no port. A pattern without one matches every port.
  return `${url.protocol}//${url.hostname}/*`;
}

/** Chrome's extension ID for a manifest `key` (base64 public key). */
export function extensionIdFromKey(key) {
  const digest = createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest("hex");
  return [...digest.slice(0, 32)]
    .map((char) => String.fromCharCode(97 + Number.parseInt(char, 16)))
    .join("");
}

/**
 * Builds the shipped manifest from the checked-in one. It adds the web app
 * as the only page that may message the extension, and it refuses any host
 * permission other than claude.ai and chatgpt.com.
 */
export function buildManifest(base, appUrl) {
  const hosts = [
    ...(base.host_permissions ?? []),
    ...(base.optional_host_permissions ?? []),
    ...(base.content_scripts ?? []).flatMap((script) => script.matches ?? []),
  ];
  const extra = hosts.filter((host) => !ALLOWED_HOSTS.includes(host));
  if (extra.length) {
    throw new Error(`Host not allowed in the manifest: ${extra.join(", ")}`);
  }
  if (!appUrl) return base;
  return {
    ...base,
    externally_connectable: { matches: [connectPattern(appUrl)] },
  };
}

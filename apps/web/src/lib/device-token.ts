/**
 * SHA-256 of the full device token, `tkd_` prefix included, as lowercase hex.
 * The database stores and looks up this hash, never the token.
 */
export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Device tokens look like `tkd_` plus 43 base64url characters. */
export const DEVICE_TOKEN_PATTERN = /^tkd_[A-Za-z0-9_-]{43}$/;

/**
 * A new device token: `tkd_` plus 32 random bytes as base64url without
 * padding. Show it to the extension once. Store only its hash, never log it.
 */
export function createDeviceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `tkd_${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

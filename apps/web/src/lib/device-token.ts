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

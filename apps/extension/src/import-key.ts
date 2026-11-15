// The import_key that stops a re-scored chat from counting twice.
//
// It is an HMAC-SHA256, not a plain hash. A plain SHA-256 of a short prompt
// can be guessed by hashing common prompts, so it would leak the text. The
// HMAC key is a random secret made once per install and kept in
// chrome.storage.local. It never leaves the browser. Re-scoring the same chat
// on the same install gives the same keys. A reinstall makes a new secret, so
// a chat scored before and after a reinstall counts twice.
import type { SiteId } from "./adapters/index.js";
import type { KeyValueStore } from "./session.js";

const SECRET_KEY = "importKeySecret";
const SECRET_BYTES = 32;
const HEX_64 = /^[0-9a-f]{64}$/;

/** Domain separation, so this HMAC can't be confused with any other use. */
const LABEL = "triplekeel.import.hmac.v1";

export type MessageIdentity = {
  site: SiteId;
  /** The site's conversation ID, from the page URL. */
  conversationId: string;
  /** The message's position among the user's messages in the chat, from 0. */
  position: number;
  /** The message text, as the adapter read it. */
  text: string;
};

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Returns this install's secret, and makes it the first time. It is 32
 * random bytes as hex, stored in chrome.storage.local.
 */
export async function installSecret(
  store: KeyValueStore,
  webCrypto: Crypto = globalThis.crypto,
): Promise<string> {
  const stored = (await store.get([SECRET_KEY]))[SECRET_KEY];
  if (typeof stored === "string" && HEX_64.test(stored)) return stored;
  const secret = toHex(webCrypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
  await store.set({ [SECRET_KEY]: secret });
  return secret;
}

/**
 * Returns a function that computes a message's import_key: 64 lowercase hex
 * characters. The fields are JSON-encoded, so "1"+"23" and "12"+"3" differ.
 */
export async function createImportKeyer(
  secret: string,
  webCrypto: Crypto = globalThis.crypto,
): Promise<(identity: MessageIdentity) => Promise<string>> {
  if (!HEX_64.test(secret)) throw new Error("import key: bad secret");
  const key = await webCrypto.subtle.importKey(
    "raw",
    fromHex(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return async (identity) => {
    if (!Number.isInteger(identity.position) || identity.position < 0) {
      throw new Error("import key: bad position");
    }
    const material = `${LABEL}:${JSON.stringify([
      identity.site,
      identity.conversationId,
      identity.position,
      identity.text,
    ])}`;
    const signature = await webCrypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(material),
    );
    return toHex(signature);
  };
}

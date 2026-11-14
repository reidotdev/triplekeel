/** FNV-1a, 32-bit. Fast, stable and synchronous. Not for security. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A stable number in [0, 1) for the given text. */
export function unitHash(text: string): number {
  return fnv1a(text) / 0x1_0000_0000;
}

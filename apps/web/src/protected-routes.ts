/**
 * Pages the proxy sends to sign-in when no one is signed in. Everything else,
 * like the homepage and /privacy, is public. Pages such as /onboarding and
 * /settings check the session themselves.
 */
const PROTECTED_PREFIXES = ["/dashboard"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

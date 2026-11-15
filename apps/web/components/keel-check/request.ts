// Asks POST /api/keel-check for a new card and turns its errors into plain
// words. The card itself isn't read here: the dashboard refreshes and the
// server renders it.

export const KEEL_CHECK_PATH = "/api/keel-check";

export const ERROR_TEXT = {
  profile: "Finish your profile first.",
  limit: "You've reached today's keel checks. Try again tomorrow.",
  paused: "Paused for maintenance.",
  failed: "Couldn't build a keel check. Try again.",
} as const;

export type KeelCheckRequestResult =
  | { ok: true }
  | { ok: false; message: string };

/** The message for a failed response's status code. */
export function keelCheckErrorText(status: number): string {
  switch (status) {
    case 409:
      return ERROR_TEXT.profile;
    // The route sends Retry-After with the seconds to midnight UTC, when the
    // daily cap resets.
    case 429:
      return ERROR_TEXT.limit;
    case 503:
      return ERROR_TEXT.paused;
    default:
      return ERROR_TEXT.failed;
  }
}

export async function requestKeelCheck(
  fetchImpl: typeof fetch = fetch,
): Promise<KeelCheckRequestResult> {
  let response: Response;
  try {
    response = await fetchImpl(KEEL_CHECK_PATH, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, message: ERROR_TEXT.failed };
  }
  if (response.ok) return { ok: true };
  return { ok: false, message: keelCheckErrorText(response.status) };
}

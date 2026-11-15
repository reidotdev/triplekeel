export type Track = { id: string; name: string };

export type Me = { email: string | null; track: Track | null };

/** Same shape as `TrackQuestion` in `@triplekeel/schema`. */
export type TrackQuestion = {
  id: string;
  text: string;
  area: string;
  polarity: "good" | "bad";
  answers: string[];
};

export type QuestionSet = { track: Track | null; questions: TrackQuestion[] };

/** The server rejected the device token. The device is revoked or unknown. */
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`api_error_${status}`);
    this.name = "ApiError";
  }
}

export type ApiDeps = {
  apiBase: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 10_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  const wait =
    Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * 2 ** attempt;
  return Math.min(wait, MAX_WAIT_MS);
}

/** The server stayed busy (429) after one retry. */
export class RateLimitedError extends Error {
  constructor() {
    super("rate_limited");
    this.name = "RateLimitedError";
  }
}

/** POST /api/signals takes 1 to 50 reports per request. */
export const MAX_REPORTS_PER_REQUEST = 50;
/** Wait this long on a 429 without Retry-After (Cloudflare's 10 s window). */
const SIGNALS_DEFAULT_WAIT_MS = 10_000;
/** Longer waits aren't worth keeping the popup open for. */
const SIGNALS_MAX_WAIT_MS = 60_000;

/** Retry-After in milliseconds, as seconds or an HTTP date, or null. */
function retryAfterMs(response: Response, now: number): number | null {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export type SignalsResult = {
  /** Reports the server accepted. */
  received: number;
  /** Reports stored. Fewer than received when a chat was scored before. */
  inserted: number;
};

/**
 * Sends score reports in batches of 50. On a 429 it waits (Retry-After if
 * given) and retries once. Throws UnauthorizedError on 401,
 * RateLimitedError if still busy, and ApiError on other failures.
 */
export async function postSignals(
  deps: ApiDeps,
  token: string,
  reports: readonly unknown[],
  onWait?: (ms: number) => void,
): Promise<SignalsResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const result: SignalsResult = { received: 0, inserted: 0 };
  for (let start = 0; start < reports.length; ) {
    const batch = reports.slice(start, start + MAX_REPORTS_PER_REQUEST);
    const body = JSON.stringify({ reports: batch });
    for (let attempt = 0; ; attempt += 1) {
      const response = await deps.fetch(`${deps.apiBase}/api/signals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        credentials: "omit",
      });
      if (response.status === 401) throw new UnauthorizedError();
      if (response.status === 429) {
        const wait =
          retryAfterMs(response, Date.now()) ?? SIGNALS_DEFAULT_WAIT_MS;
        if (attempt > 0 || wait > SIGNALS_MAX_WAIT_MS) {
          throw new RateLimitedError();
        }
        onWait?.(wait);
        await sleep(wait);
        continue;
      }
      if (!response.ok) throw new ApiError(response.status);
      const reply = (await response.json().catch(() => ({}))) as {
        received?: unknown;
        inserted?: unknown;
      };
      const received =
        typeof reply.received === "number" ? reply.received : batch.length;
      result.received += received;
      result.inserted +=
        typeof reply.inserted === "number" ? reply.inserted : received;
      break;
    }
    start += batch.length;
  }
  return result;
}

/**
 * GET an API path with the device token. Waits and retries on 429, because
 * the API allows only a few requests per 10 seconds per IP.
 */
export async function apiGet<T>(
  deps: ApiDeps,
  path: string,
  token: string,
): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt += 1) {
    const response = await deps.fetch(`${deps.apiBase}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      credentials: "omit",
    });
    if (response.status === 401) throw new UnauthorizedError();
    if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(retryDelayMs(response, attempt));
      continue;
    }
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()) as T;
  }
}

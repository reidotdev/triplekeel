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

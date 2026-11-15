// Helpers for the extension's tests. Not part of the build.
import type { KeyValueStore } from "./session.js";

export const TEST_TOKEN = `tkd_${"A".repeat(43)}`;
export const TEST_API = "https://app.example";

export function memoryStore(
  initial: Record<string, unknown> = {},
): KeyValueStore & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    async get(keys) {
      return Object.fromEntries(
        keys.filter((key) => key in data).map((key) => [key, data[key]]),
      );
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
  };
}

export type RecordedRequest = {
  path: string;
  method: string;
  authorization: string | null;
  body: string;
};

/** A fetch that answers from a list of responses and records each request. */
export function scriptedFetch(responses: Array<() => Response>) {
  const requests: RecordedRequest[] = [];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      path: new URL(String(input)).pathname,
      method: init?.method ?? "GET",
      authorization: new Headers(init?.headers).get("authorization"),
      body: typeof init?.body === "string" ? init.body : "",
    });
    const next = responses[Math.min(requests.length, responses.length) - 1];
    return next ? next() : new Response(null, { status: 404 });
  }) as typeof fetch;
  return { requests, fetch: fetchFake };
}

// Helpers for the extension's tests. Not part of the build.
import type { KeyValueStore } from "./session.js";

export const TEST_TOKEN = `tkd_${"A".repeat(43)}`;
export const TEST_API = "https://app.example";

/**
 * An in-memory chrome.storage.local. Like Chrome, it stores copies, and
 * `watch` gets the changed keys, like chrome.storage.onChanged.
 */
export function memoryStore(
  initial: Record<string, unknown> = {},
): KeyValueStore & {
  data: Record<string, unknown>;
  watch(listener: (keys: string[]) => void): () => void;
} {
  const data: Record<string, unknown> = structuredClone(initial);
  const listeners = new Set<(keys: string[]) => void>();
  const notify = (keys: string[]) => {
    if (keys.length) for (const listener of listeners) listener(keys);
  };
  return {
    data,
    async get(keys) {
      return structuredClone(
        Object.fromEntries(
          keys.filter((key) => key in data).map((key) => [key, data[key]]),
        ),
      );
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
      notify(Object.keys(items));
    },
    async remove(keys) {
      const removed = keys.filter((key) => key in data);
      for (const key of removed) delete data[key];
      notify(removed);
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
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

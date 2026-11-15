import { describe, expect, it } from "vitest";
import { doneText, type PageInfo, scoreView } from "./popup-view.js";
import { type SessionState, sendReports } from "./session.js";
import {
  memoryStore,
  scriptedFetch,
  TEST_API,
  TEST_TOKEN,
} from "./test-utils.js";

// The sender treats reports as opaque JSON. Real ones are tested in
// score-chat.test.ts.
const reports = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ n: i }));

function setup(responses: Array<() => Response>) {
  const server = scriptedFetch(responses);
  const store = memoryStore({ deviceToken: TEST_TOKEN, me: { email: null } });
  const sleeps: number[] = [];
  const deps = {
    apiBase: TEST_API,
    fetch: server.fetch,
    store,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
  return { deps, server, store, sleeps };
}

const accepted =
  (count: number, inserted = count) =>
  () =>
    Response.json({ received: count, inserted });
const busy = (retryAfter?: string) => () =>
  new Response(null, {
    status: 429,
    headers: retryAfter ? { "Retry-After": retryAfter } : {},
  });

describe("sendReports", () => {
  it("sends one request with the bearer token for a chat of 20", async () => {
    const { deps, server } = setup([accepted(20)]);
    expect(await sendReports(deps, reports(20))).toEqual({
      ok: true,
      received: 20,
      inserted: 20,
    });
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]).toMatchObject({
      path: "/api/signals",
      method: "POST",
      authorization: `Bearer ${TEST_TOKEN}`,
    });
    expect(JSON.parse(server.requests[0].body).reports).toHaveLength(20);
  });

  it("splits more than 50 reports into batches of 50", async () => {
    const { deps, server } = setup([
      accepted(50),
      accepted(50, 40),
      accepted(20),
    ]);
    expect(await sendReports(deps, reports(120))).toEqual({
      ok: true,
      received: 120,
      inserted: 110,
    });
    expect(
      server.requests.map((r) => JSON.parse(r.body).reports.length),
    ).toEqual([50, 50, 20]);
    expect(JSON.parse(server.requests[2].body).reports[0]).toEqual({ n: 100 });
  });

  it("forgets the token on 401, like any other request", async () => {
    const { deps, store } = setup([() => new Response(null, { status: 401 })]);
    expect(await sendReports(deps, reports(3))).toEqual({
      ok: false,
      error: "not_connected",
    });
    expect(store.data).toEqual({});
  });

  it("waits for Retry-After on 429 and retries once", async () => {
    const { deps, server, sleeps } = setup([busy("60"), accepted(5)]);
    const waits: number[] = [];
    const sent = await sendReports(deps, reports(5), (ms) => waits.push(ms));
    expect(sent).toEqual({ ok: true, received: 5, inserted: 5 });
    expect(sleeps).toEqual([60_000]);
    expect(waits).toEqual([60_000]);
    expect(server.requests).toHaveLength(2);
    expect(server.requests[1].body).toBe(server.requests[0].body);
  });

  it("waits 10 seconds on a 429 without Retry-After", async () => {
    const { deps, sleeps } = setup([busy(), accepted(1)]);
    expect((await sendReports(deps, reports(1))).ok).toBe(true);
    expect(sleeps).toEqual([10_000]);
  });

  it("gives up after a second 429, or when the wait is too long", async () => {
    const twice = setup([busy("5"), busy("5")]);
    expect(await sendReports(twice.deps, reports(1))).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(twice.server.requests).toHaveLength(2);
    expect(twice.store.data.deviceToken).toBe(TEST_TOKEN);

    const long = setup([busy("600")]);
    expect(await sendReports(long.deps, reports(1))).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(long.sleeps).toEqual([]);
  });

  it("reports other failures without retrying", async () => {
    const { deps, server } = setup([() => new Response(null, { status: 400 })]);
    expect(await sendReports(deps, reports(1))).toEqual({
      ok: false,
      error: "failed",
    });
    expect(server.requests).toHaveLength(1);
  });

  it("doesn't call the server without a token", async () => {
    const { deps, server, store } = setup([accepted(1)]);
    await store.remove(["deviceToken"]);
    expect(await sendReports(deps, reports(1))).toEqual({
      ok: false,
      error: "not_connected",
    });
    expect(server.requests).toEqual([]);
  });
});

describe("the Score this chat button", () => {
  const connected: SessionState = {
    connected: true,
    me: { email: null, track: { id: "product-manager", name: "PM" } },
    questions: null,
    stale: false,
  };
  const chatPage = (count: number): PageInfo => ({
    kind: "page",
    status: {
      site: "claude",
      isConversationPage: true,
      userMessageCount: count,
    },
  });

  it("shows only on a chat page when connected", () => {
    expect(scoreView(connected, true, chatPage(3))).toEqual({
      showButton: true,
      note: null,
    });
    expect(scoreView({ connected: false }, true, chatPage(3)).showButton).toBe(
      false,
    );
    expect(scoreView(connected, false, chatPage(3)).showButton).toBe(false);
    expect(scoreView(connected, true, { kind: "other" })).toEqual({
      showButton: false,
      note: null,
    });
    expect(
      scoreView(connected, true, {
        kind: "page",
        status: {
          site: "chatgpt",
          isConversationPage: false,
          userMessageCount: 0,
        },
      }),
    ).toEqual({ showButton: false, note: "Open a chat to score it." });
    expect(scoreView(connected, true, chatPage(0)).note).toBe(
      "No messages found on this page.",
    );
    expect(scoreView(connected, true, { kind: "reload" }).note).toBe(
      "Reload this page to score this chat.",
    );
  });

  it("says how many prompts were scored", () => {
    expect(doneText(14, 14)).toBe("Done: 14 prompts scored.");
    expect(doneText(1, 1)).toBe("Done: 1 prompt scored.");
    expect(doneText(14, 0)).toBe(
      "Done: 14 prompts scored. You scored this chat before, so they count once.",
    );
    expect(doneText(14, 10)).toBe(
      "Done: 14 prompts scored. 4 were scored before and count once.",
    );
  });
});

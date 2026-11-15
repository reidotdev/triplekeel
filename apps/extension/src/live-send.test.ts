import { QUESTION_IDS, type Report } from "@triplekeel/schema";
import { describe, expect, it } from "vitest";
import {
  BACKOFF_BASE_MS,
  createLiveSender,
  SEND_INTERVAL_MS,
} from "./live-send.js";
import {
  addToHistory,
  FLUSH_AGE_MS,
  LIVE_REPORT_MESSAGE,
  QUEUE_CAP,
  type QueuedReport,
  readHistory,
  readQueue,
  readSendState,
} from "./live-store.js";
import { buildLiveReport } from "./reports.js";
import {
  memoryStore,
  scriptedFetch,
  TEST_API,
  TEST_TOKEN,
} from "./test-utils.js";

const START = Date.parse("2026-11-15T10:00:00Z");
const ANSWERS = QUESTION_IDS.map((q) => ({ q, a: "no" as const, p: 0.8 }));
const REPORT = buildLiveReport(
  ANSWERS,
  "product-manager",
  "claude",
  new Date(START),
  120,
);

const message = (id: string, report: unknown = REPORT) => ({
  type: LIVE_REPORT_MESSAGE,
  id,
  report,
});

const accepted = () => () => Response.json({ received: 1, inserted: 1 });
const status =
  (code: number, headers: Record<string, string> = {}) =>
  () =>
    new Response(null, { status: code, headers });

function setup(
  responses: Array<() => Response>,
  initial: Record<string, unknown> = {},
) {
  const server = scriptedFetch(responses);
  const store = memoryStore({ deviceToken: TEST_TOKEN, ...initial });
  let time = START;
  const deps = {
    apiBase: TEST_API,
    fetch: server.fetch,
    store,
    now: () => time,
    sleep: async () => {
      throw new Error("live capture never sleeps in the worker");
    },
  };
  const sent = () =>
    server.requests.map(
      (request) => (JSON.parse(request.body) as { reports: Report[] }).reports,
    );
  return {
    deps,
    server,
    store,
    sent,
    sender: createLiveSender(deps),
    advance: (ms: number) => {
      time += ms;
    },
  };
}

async function enqueueMany(
  sender: ReturnType<typeof createLiveSender>,
  count: number,
  from = 0,
) {
  let reply = { checkInMs: null as number | null };
  for (let i = from; i < from + count; i++) {
    reply = await sender.enqueue(message(`r-${i}`));
  }
  return reply;
}

const preloaded = (count: number): QueuedReport[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r-${i}`,
    queuedAt: START,
    report: REPORT,
  }));

describe("the live queue", () => {
  it("keeps reports in storage until 10 are waiting, then sends them in one request", async () => {
    const { deps, server, store, sent } = setup([accepted()]);
    const first = createLiveSender(deps);
    const reply = await enqueueMany(first, 9);
    expect(server.requests).toEqual([]);
    expect(await readQueue(store)).toHaveLength(9);
    expect(reply.checkInMs).toBe(FLUSH_AGE_MS);

    // The worker was stopped and started again: the queue is still there.
    const restarted = createLiveSender(deps);
    await restarted.enqueue(message("r-9"));
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]).toMatchObject({
      path: "/api/signals",
      authorization: `Bearer ${TEST_TOKEN}`,
    });
    expect(sent()[0]).toHaveLength(10);
    expect(await readQueue(store)).toEqual([]);
  });

  it("sends a smaller batch once the oldest report is 3 minutes old", async () => {
    const { sender, server, sent, advance } = setup([accepted()]);
    await enqueueMany(sender, 3);
    advance(FLUSH_AGE_MS - 1);
    expect((await sender.flushIfDue()).checkInMs).toBe(1);
    expect(server.requests).toEqual([]);
    advance(1);
    expect(await sender.flushIfDue()).toEqual({ checkInMs: null });
    expect(sent()).toEqual([[REPORT, REPORT, REPORT]]);
  });

  it("queues only valid live reports, so no text can get in", async () => {
    const { sender, store } = setup([accepted()]);
    const withText = { ...REPORT, text: "[PROMPT TEXT]" };
    const imported = {
      ...REPORT,
      source: "import",
      import_key: "a".repeat(64),
    };
    const keyed = { ...REPORT, import_key: "a".repeat(64) };
    await sender.enqueue(message("a", withText));
    await sender.enqueue(message("b", imported));
    await sender.enqueue(message("c", keyed));
    await sender.enqueue(message("d", "[PROMPT TEXT]"));
    await sender.enqueue(message("bad id with spaces"));
    await sender.enqueue({ type: "other", id: "e", report: REPORT });
    expect(await readQueue(store)).toEqual([]);
    await sender.enqueue(message("f"));
    await sender.enqueue(message("f"));
    expect((await readQueue(store)).map((item) => item.id)).toEqual(["f"]);
  });

  it("queues reports sent at the same moment without losing any", async () => {
    const { sender, store } = setup([accepted()]);
    await Promise.all(
      ["a", "b", "c", "d", "e"].map((id) => sender.enqueue(message(id))),
    );
    expect(await readQueue(store)).toHaveLength(5);
  });

  it("caps the queue at 200 and counts the oldest it drops", async () => {
    const { sender, store, server } = setup([accepted()], {
      liveQueue: preloaded(QUEUE_CAP - 2),
      liveSendState: { notBefore: START + 60 * 60 * 1000 },
    });
    await enqueueMany(sender, 7, QUEUE_CAP - 2);
    const queue = await readQueue(store);
    expect(queue).toHaveLength(QUEUE_CAP);
    expect(queue[0].id).toBe("r-5");
    expect((await readSendState(store)).dropped).toBe(5);
    expect(server.requests).toEqual([]);
  });

  it("doesn't queue anything when not connected", async () => {
    const { sender, store } = setup([accepted()]);
    await store.remove(["deviceToken"]);
    expect(await sender.enqueue(message("a"))).toEqual({ checkInMs: null });
    expect(store.data.liveQueue).toBeUndefined();
  });
});

describe("sending live reports", () => {
  it("sends at most 50 per request and waits a minute between sends", async () => {
    const { sender, sent, advance } = setup([accepted()], {
      liveQueue: preloaded(120),
    });
    await sender.flushIfDue();
    expect((await sender.flushIfDue()).checkInMs).toBe(SEND_INTERVAL_MS);
    advance(SEND_INTERVAL_MS);
    await sender.flushIfDue();
    advance(SEND_INTERVAL_MS);
    expect(await sender.flushIfDue()).toEqual({ checkInMs: null });
    expect(sent().map((batch) => batch.length)).toEqual([50, 50, 20]);
  });

  it("runs one send at a time", async () => {
    const { sender, server } = setup([accepted()], {
      liveQueue: preloaded(10),
    });
    await Promise.all([sender.flushIfDue(), sender.flushIfDue()]);
    expect(server.requests).toHaveLength(1);
  });

  it("keeps the reports on a 429 and waits for Retry-After", async () => {
    const { sender, server, store, advance } = setup([
      status(429, { "Retry-After": "120" }),
      accepted(),
    ]);
    const reply = await enqueueMany(sender, 10);
    expect(server.requests).toHaveLength(1);
    expect(reply.checkInMs).toBe(120_000);
    expect(await readQueue(store)).toHaveLength(10);
    expect(store.data.deviceToken).toBe(TEST_TOKEN);

    advance(119_000);
    for (let i = 0; i < 5; i++) await sender.flushIfDue();
    expect(server.requests).toHaveLength(1);
    advance(1000);
    await sender.flushIfDue();
    expect(server.requests).toHaveLength(2);
    expect(await readQueue(store)).toEqual([]);
  });

  it("backs off without Retry-After and never retries in a tight loop", async () => {
    const { sender, server, store, advance } = setup([
      status(429),
      status(503),
      accepted(),
    ]);
    expect((await enqueueMany(sender, 10)).checkInMs).toBe(BACKOFF_BASE_MS);
    for (let i = 0; i < 10; i++) await sender.flushIfDue();
    expect(server.requests).toHaveLength(1);

    advance(BACKOFF_BASE_MS);
    expect((await sender.flushIfDue()).checkInMs).toBe(2 * BACKOFF_BASE_MS);
    expect(server.requests).toHaveLength(2);
    expect(await readQueue(store)).toHaveLength(10);

    advance(2 * BACKOFF_BASE_MS);
    await sender.flushIfDue();
    expect(server.requests).toHaveLength(3);
    expect(await readQueue(store)).toEqual([]);
    expect((await readSendState(store)).failures).toBe(0);
  });

  it("disconnects on 401: the token, queue and history go", async () => {
    const { sender, server, store } = setup([status(401)], {
      me: { email: null, track: null },
    });
    await addToHistory(store, {
      id: "r-0",
      site: "claude",
      scoredAt: START,
      text: "[PROMPT TEXT]",
      report: REPORT,
    });
    expect(await enqueueMany(sender, 10)).toEqual({ checkInMs: null });
    expect(server.requests).toHaveLength(1);
    expect(store.data).toEqual({});
    await sender.enqueue(message("later"));
    await sender.flushIfDue();
    expect(server.requests).toHaveLength(1);
  });

  it("drops a batch the server refuses with a 400, and doesn't resend it", async () => {
    const { sender, server, store } = setup([status(400)]);
    await enqueueMany(sender, 10);
    expect(await readQueue(store)).toEqual([]);
    expect((await readSendState(store)).rejected).toBe(10);
    await sender.flushIfDue();
    expect(server.requests).toHaveLength(1);
  });
});

describe("the history", () => {
  it("says which prompts were sent, are waiting, or weren't sent", async () => {
    const { sender, store, advance } = setup([accepted(), status(400)]);
    const entry = (id: string) =>
      addToHistory(store, {
        id,
        site: "chatgpt",
        scoredAt: START,
        text: `[PROMPT ${id}]`,
        report: REPORT,
      });
    for (let i = 0; i < 10; i++) await entry(`r-${i}`);
    await enqueueMany(sender, 10);
    for (let i = 10; i < 20; i++) await entry(`r-${i}`);
    // Within a minute of the last send, so these wait.
    await enqueueMany(sender, 10, 10);
    const statuses = async () =>
      Object.fromEntries(
        (await readHistory(store)).map((item) => [item.id, item.status]),
      );
    expect(await statuses()).toMatchObject({ "r-0": "sent", "r-19": "queued" });

    advance(SEND_INTERVAL_MS);
    await entry("r-20");
    await sender.enqueue(message("r-20"));
    const history = await readHistory(store);
    expect(history).toHaveLength(20);
    expect(history[0]).toMatchObject({
      id: "r-20",
      site: "chatgpt",
      text: "[PROMPT r-20]",
      status: "not_sent",
    });
    expect(await statuses()).toMatchObject({
      "r-1": "sent",
      "r-10": "not_sent",
    });
    expect(history.find((item) => item.id === "r-0")).toBeUndefined();
  });
});

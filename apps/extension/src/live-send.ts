// Live capture's send queue, in the background worker. Content scripts send
// it finished reports, never prompt text. It keeps them in
// chrome.storage.local, so a browser restart loses nothing, and sends them
// to /api/signals in batches.
//
// When to send: once 10 reports are waiting, or once the oldest has waited
// 3 minutes. This is checked on each new report, when the popup opens, when
// the browser starts, and on a timer that each open claude.ai or
// chatgpt.com tab keeps while reports are waiting. No `alarms` permission.
//
// Limits: one request per send, at most 50 reports, and at least a minute
// between sends, so live capture stays under the server's 50 reports a
// minute. A 429 keeps the reports and waits for Retry-After, or backs off
// from 1 minute up to 30. A 401 disconnects, as everywhere else.
import { parseReport } from "@triplekeel/schema";
import { MAX_REPORTS_PER_REQUEST } from "./api.js";
import {
  FLUSH_AGE_MS,
  FLUSH_COUNT,
  HISTORY_CAP,
  isEntryId,
  LIVE_DATA_KEYS,
  LIVE_REPORT_MESSAGE,
  type LiveReply,
  QUEUE_CAP,
  QUEUE_KEY,
  type QueuedReport,
  readQueue,
  readSendState,
  SEND_STATE_KEY,
  type SendState,
} from "./live-store.js";
import {
  isDeviceToken,
  type SendResult,
  type SessionDeps,
  sendReports,
  TOKEN_KEY,
} from "./session.js";

/** After a send, the next one waits at least this long. */
export const SEND_INTERVAL_MS = 60 * 1000;
/** A retry never comes sooner than this, whatever Retry-After says. */
export const MIN_RETRY_MS = 10 * 1000;
/** Backoff after a failure without Retry-After: 1, 2, 4… minutes. */
export const BACKOFF_BASE_MS = 60 * 1000;
/** No wait is longer than this. */
export const BACKOFF_MAX_MS = 30 * 60 * 1000;

export type LiveSender = {
  /** Queues a report from a content script, then sends if a send is due. */
  enqueue(message: unknown): Promise<LiveReply>;
  /** Sends one batch if a send is due. */
  flushIfDue(): Promise<LiveReply>;
};

/** A valid live report message, or null. The report must pass the schema. */
function parseMessage(
  message: unknown,
): Pick<QueuedReport, "id" | "report"> | null {
  const input = message as { type?: unknown; id?: unknown; report?: unknown };
  if (input?.type !== LIVE_REPORT_MESSAGE || !isEntryId(input.id)) return null;
  const parsed = parseReport(input.report);
  if (!parsed.ok) return null;
  const { report } = parsed;
  if (report.source !== "live" || report.import_key !== undefined) return null;
  return { id: input.id, report };
}

/** When the next send may happen, or null if nothing is waiting. */
function nextSendAt(queue: QueuedReport[], state: SendState): number | null {
  if (queue.length === 0) return null;
  const ready =
    queue.length >= FLUSH_COUNT ? 0 : queue[0].queuedAt + FLUSH_AGE_MS;
  return Math.max(ready, state.notBefore);
}

function backoffMs(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
}

export function createLiveSender(deps: SessionDeps): LiveSender {
  const { store } = deps;
  const now = deps.now ?? Date.now;
  let inFlight = false;

  // Runs storage updates one at a time, so two reports can't overwrite each
  // other. The network call runs outside it.
  let chain: Promise<unknown> = Promise.resolve();
  function locked<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task);
    chain = run.catch(() => undefined);
    return run;
  }

  const reply = (at: number | null): LiveReply => ({
    checkInMs: at === null ? null : Math.max(0, at - now()),
  });

  async function tokenPresent(): Promise<boolean> {
    return isDeviceToken((await store.get([TOKEN_KEY]))[TOKEN_KEY]);
  }

  async function enqueue(message: unknown): Promise<LiveReply> {
    const item = parseMessage(message);
    if (!item) return { checkInMs: null };
    await locked(async () => {
      // Not connected: there's no account to send it to.
      if (!(await tokenPresent())) return;
      const queue = await readQueue(store);
      if (queue.some((queued) => queued.id === item.id)) return;
      queue.push({ ...item, queuedAt: now() });
      const writes: Record<string, unknown> = {
        [QUEUE_KEY]: queue.slice(-QUEUE_CAP),
      };
      const dropped = queue.length - QUEUE_CAP;
      if (dropped > 0) {
        const state = await readSendState(store);
        writes[SEND_STATE_KEY] = { ...state, dropped: state.dropped + dropped };
      }
      await store.set(writes);
    });
    return flushIfDue();
  }

  /** Updates the queue and the send state after a send. */
  async function settle(
    batch: QueuedReport[],
    result: SendResult,
  ): Promise<LiveReply> {
    if (!result.ok && result.error === "not_connected") {
      // A 401 already disconnected. Make sure nothing is left to send.
      await store.remove(LIVE_DATA_KEYS);
      return { checkInMs: null };
    }
    const time = now();
    const sentIds = new Set(batch.map((item) => item.id));
    const state = await readSendState(store);
    let queue = await readQueue(store);
    let next: SendState;
    if (result.ok || result.error === "rejected") {
      // Sent, or refused for good. Either way, don't send these again.
      queue = queue.filter((item) => !sentIds.has(item.id));
      next = {
        ...state,
        notBefore: time + SEND_INTERVAL_MS,
        failures: 0,
        rejected: state.rejected + (result.ok ? 0 : batch.length),
        sentIds: result.ok
          ? [...[...sentIds].reverse(), ...state.sentIds].slice(0, HISTORY_CAP)
          : state.sentIds,
      };
    } else {
      // Busy or unreachable. Keep the reports and wait.
      const failures = state.failures + 1;
      const wait =
        result.error === "rate_limited" && result.retryAfterMs !== null
          ? result.retryAfterMs
          : backoffMs(failures);
      next = {
        ...state,
        failures,
        notBefore:
          time + Math.min(BACKOFF_MAX_MS, Math.max(MIN_RETRY_MS, wait)),
      };
    }
    await store.set({ [QUEUE_KEY]: queue, [SEND_STATE_KEY]: next });
    return reply(nextSendAt(queue, next));
  }

  async function flushIfDue(): Promise<LiveReply> {
    const plan = await locked(
      async (): Promise<{ at: number | null } | { batch: QueuedReport[] }> => {
        if (inFlight) return { at: now() + MIN_RETRY_MS };
        const queue = await readQueue(store);
        if (queue.length === 0) return { at: null };
        if (!(await tokenPresent())) {
          await store.remove(LIVE_DATA_KEYS);
          return { at: null };
        }
        const at = nextSendAt(queue, await readSendState(store));
        if (at !== null && at > now()) return { at };
        inFlight = true;
        return { batch: queue.slice(0, MAX_REPORTS_PER_REQUEST) };
      },
    );
    if (!("batch" in plan)) return reply(plan.at);

    let result: SendResult;
    try {
      result = await sendReports(
        deps,
        plan.batch.map((item) => item.report),
        undefined,
        { wait: false },
      );
    } catch {
      result = { ok: false, error: "failed" };
    }
    return locked(async () => {
      try {
        return await settle(plan.batch, result);
      } finally {
        inFlight = false;
      }
    });
  }

  return { enqueue, flushIfDue };
}

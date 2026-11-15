// What live capture keeps in chrome.storage.local, and the messages between
// the content script and the background worker.
//
// - `liveQueue`: reports waiting to be sent. Reports only, never text.
//   Written only by the background worker.
// - `liveSendState`: when the next send may happen, failure and drop
//   counts, and the IDs of the last reports sent. No text.
// - `liveHistory`: the last 20 scored prompts with their text and report,
//   for the popup's "what was sent" view (REI-272). Written only by the
//   content script. The text stays in this browser and is never sent.
//
// All three are removed on disconnect and on a new connect.
import type { Report } from "@triplekeel/schema";
import type { SiteId } from "./adapters/index.js";
import type { KeyValueStore } from "./session.js";

export const QUEUE_KEY = "liveQueue";
export const SEND_STATE_KEY = "liveSendState";
export const HISTORY_KEY = "liveHistory";
export const LIVE_DATA_KEYS = [QUEUE_KEY, SEND_STATE_KEY, HISTORY_KEY];

/** Send when this many reports are waiting. */
export const FLUSH_COUNT = 10;
/** Or when the oldest waiting report is this old. */
export const FLUSH_AGE_MS = 3 * 60 * 1000;
/** At most this many reports wait. Past it, the oldest are dropped. */
export const QUEUE_CAP = 200;
/** The popup's history keeps this many scored prompts. */
export const HISTORY_CAP = 20;

/** Content script to background: queue this report. */
export const LIVE_REPORT_MESSAGE = "triplekeel.live.report";
/** Content script or popup to background: send now if a send is due. */
export const LIVE_FLUSH_MESSAGE = "triplekeel.live.flush";

export type LiveReportMessage = {
  type: typeof LIVE_REPORT_MESSAGE;
  id: string;
  report: Report;
};

/** The background's answer to both messages. */
export type LiveReply = {
  /** Ask again after this long, or null if nothing is waiting. */
  checkInMs: number | null;
};

export type QueuedReport = {
  /** Random ID, the same as the history entry's. */
  id: string;
  /** When it was queued, in ms since 1970. */
  queuedAt: number;
  report: Report;
};

export type SendState = {
  /** No send before this time, in ms since 1970. */
  notBefore: number;
  /** Failed sends in a row, for the backoff. */
  failures: number;
  /** Reports dropped because the queue was full. */
  dropped: number;
  /** Reports the server refused with a 400. They are not resent. */
  rejected: number;
  /** IDs of the last reports sent, newest first, at most HISTORY_CAP. */
  sentIds: string[];
};

export const EMPTY_SEND_STATE: SendState = {
  notBefore: 0,
  failures: 0,
  dropped: 0,
  rejected: 0,
  sentIds: [],
};

/** One scored prompt, as the popup's "what was sent" view shows it. */
export type HistoryEntry = {
  /** Random ID, the same as the queued report's. */
  id: string;
  site: SiteId;
  /** When it was scored, in ms since 1970. */
  scoredAt: number;
  /** The prompt as typed. Kept only in this browser. Never sent. */
  text: string;
  /** The report made from it. This is all that goes to the server. */
  report: Report;
};

export type HistoryItem = HistoryEntry & {
  /** `queued`: waiting to be sent. `not_sent`: dropped or refused. */
  status: "queued" | "sent" | "not_sent";
};

const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function isEntryId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function readQueue(store: KeyValueStore): Promise<QueuedReport[]> {
  const value = (await store.get([QUEUE_KEY]))[QUEUE_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is QueuedReport =>
      isRecord(item) &&
      isEntryId(item.id) &&
      typeof item.queuedAt === "number" &&
      isRecord(item.report),
  );
}

export async function readSendState(store: KeyValueStore): Promise<SendState> {
  const value = (await store.get([SEND_STATE_KEY]))[SEND_STATE_KEY];
  if (!isRecord(value)) return { ...EMPTY_SEND_STATE };
  const count = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) && input >= 0
      ? input
      : 0;
  return {
    notBefore: count(value.notBefore),
    failures: count(value.failures),
    dropped: count(value.dropped),
    rejected: count(value.rejected),
    sentIds: Array.isArray(value.sentIds)
      ? value.sentIds.filter(isEntryId).slice(0, HISTORY_CAP)
      : [],
  };
}

async function readHistoryEntries(
  store: KeyValueStore,
): Promise<HistoryEntry[]> {
  const value = (await store.get([HISTORY_KEY]))[HISTORY_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is HistoryEntry =>
      isRecord(item) &&
      isEntryId(item.id) &&
      typeof item.text === "string" &&
      typeof item.scoredAt === "number" &&
      isRecord(item.report),
  );
}

/** Adds a scored prompt to the history, newest first, keeping the last 20. */
export async function addToHistory(
  store: KeyValueStore,
  entry: HistoryEntry,
): Promise<void> {
  const history = await readHistoryEntries(store);
  await store.set({
    [HISTORY_KEY]: [entry, ...history].slice(0, HISTORY_CAP),
  });
}

/** The last 20 scored prompts, newest first, with whether each was sent. */
export async function readHistory(
  store: KeyValueStore,
): Promise<HistoryItem[]> {
  const [history, queue, state] = await Promise.all([
    readHistoryEntries(store),
    readQueue(store),
    readSendState(store),
  ]);
  const queued = new Set(queue.map((item) => item.id));
  const sent = new Set(state.sentIds);
  return history.map((entry) => ({
    ...entry,
    status: queued.has(entry.id)
      ? "queued"
      : sent.has(entry.id)
        ? "sent"
        : "not_sent",
  }));
}

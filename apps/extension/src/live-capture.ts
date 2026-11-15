// Live capture, the part that runs in the content script on claude.ai and
// chatgpt.com. When the user sends a prompt, it routes, scores and reports
// it here, on the page. Prompt text stays in this script and in the local
// history (`liveHistory` in chrome.storage.local). The background worker
// gets only the finished report.
//
// It listens only while capture is on: connected, with a track and its
// questions cached, and not paused or turned off for this site. It reads
// those from chrome.storage.local and again whenever they change.
import type { TrackId, TrackQuestion } from "@triplekeel/schema";
import type { Scorer } from "@triplekeel/scorer";
import type { SiteAdapter } from "./adapters/index.js";
import {
  addToHistory,
  HISTORY_KEY,
  LIVE_FLUSH_MESSAGE,
  LIVE_REPORT_MESSAGE,
  type LiveReply,
  type LiveReportMessage,
} from "./live-store.js";
import { buildLiveReport, isKnownTrack, knownQuestions } from "./reports.js";
import { keepOnTrack } from "./score-chat.js";
import {
  type KeyValueStore,
  ME_KEY,
  QUESTIONS_KEY,
  readState,
  TOKEN_KEY,
} from "./session.js";
import { captureAllowed, readSettings, SETTINGS_KEY } from "./settings.js";

/** How often to check that the site really sent the prompt. */
export const CONFIRM_POLL_MS = 250;
/** If the prompt is still in the box after this long, it wasn't sent. */
export const CONFIRM_TIMEOUT_MS = 3000;
/** The shortest wait before asking the background to send again. */
export const MIN_FLUSH_CHECK_MS = 5000;

/** Storage keys that turn capture on or off. */
const WATCHED_KEYS = [TOKEN_KEY, ME_KEY, QUESTIONS_KEY, SETTINGS_KEY];

export type LiveMessage =
  | LiveReportMessage
  | { type: typeof LIVE_FLUSH_MESSAGE };

export type LiveCaptureDeps = {
  adapter: SiteAdapter;
  store: KeyValueStore;
  /** Calls back with the changed keys when chrome.storage.local changes. */
  watchStore(listener: (keys: string[]) => void): () => void;
  /** The text now in the prompt box, or "" if there is none. */
  readEditor(): string;
  scorer: Scorer;
  /** Sends a message to the background worker. Never prompt text. */
  sendMessage(message: LiveMessage): Promise<unknown>;
  now?: () => number;
  newId?: () => string;
};

export type LiveCapture = {
  /** Resolves once the first settings check is done. */
  ready: Promise<void>;
  stop(): void;
};

type Active = { track: TrackId; questions: TrackQuestion[] };

/** What the page showed when the prompt was sent. Read before the site adds it. */
type ChatContext = { followUp: boolean; firstMessage: string };

type Pending = {
  context: ChatContext;
  polls: number;
  timer: ReturnType<typeof setTimeout>;
};

export function startLiveCapture(deps: LiveCaptureDeps): LiveCapture {
  const { adapter, store, scorer } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  let active: Active | null = null;
  let unsubscribe: (() => void) | null = null;
  let stopped = false;
  let loads = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  // Prompts sent but not yet confirmed, by text. Kept for 3 s at most.
  const pending = new Map<string, Pending>();

  async function load(): Promise<Active | null> {
    const [state, settings] = await Promise.all([
      readState(store),
      readSettings(store),
    ]);
    if (!state.connected || !captureAllowed(settings, adapter.siteId)) {
      return null;
    }
    const track = state.me?.track;
    if (!track || !isKnownTrack(track.id)) return null;
    const cached = state.questions;
    const questions =
      cached?.trackId === track.id ? knownQuestions(cached.questions) : [];
    return questions.length > 0 ? { track: track.id, questions } : null;
  }

  function cancelPending() {
    for (const entry of pending.values()) clearTimeout(entry.timer);
    pending.clear();
  }

  async function reload() {
    const run = ++loads;
    const next = await load().catch(() => null);
    if (run !== loads || stopped) return;
    const wasActive = active !== null;
    active = next;
    if (active && !unsubscribe) {
      unsubscribe = adapter.onPromptSubmit(onSubmit);
    } else if (!active && unsubscribe) {
      // Paused, turned off or disconnected: stop reading the prompt box.
      unsubscribe();
      unsubscribe = null;
      cancelPending();
    }
    // Reports may be waiting from an earlier visit.
    if (active && !wasActive) requestFlush();
  }

  function scheduleFlush(answer: unknown) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    const ms = (answer as LiveReply | null | undefined)?.checkInMs;
    if (stopped || typeof ms !== "number") return;
    flushTimer = setTimeout(requestFlush, Math.max(MIN_FLUSH_CHECK_MS, ms));
  }

  function requestFlush() {
    flushTimer = null;
    if (stopped) return;
    deps.sendMessage({ type: LIVE_FLUSH_MESSAGE }).then(scheduleFlush, stop);
  }

  async function score(text: string, context: ChatContext) {
    const on = active;
    if (!on) return;
    // Personal and off-track prompts are dropped here, before scoring. A
    // follow-up with no track words, like "fix it", takes the chat's route.
    const kept = keepOnTrack(
      {
        firstMessage: context.firstMessage,
        messages: [{ position: 0, text }],
      },
      on.track,
    );
    if (kept.length === 0) return;

    await scorer.ready();
    const answers = await scorer.score(text, on.questions, {
      followUp: context.followUp,
    });
    const scoredAt = now();
    const report = buildLiveReport(
      answers,
      on.track,
      adapter.siteId,
      new Date(scoredAt),
      text.length,
    );
    // Paused or disconnected while scoring.
    if (!active) return;
    const id = newId();
    await addToHistory(store, {
      id,
      site: adapter.siteId,
      scoredAt,
      text,
      report,
    });
    // A disconnect while this ran must not leave the text behind.
    if (!(await readState(store)).connected) {
      await store.remove([HISTORY_KEY]);
      return;
    }
    const message: LiveReportMessage = {
      type: LIVE_REPORT_MESSAGE,
      id,
      report,
    };
    // This fails only when the extension was reloaded or removed, and this
    // old copy of the script can't reach it any more.
    deps.sendMessage(message).then(scheduleFlush, stop);
  }

  function settle(text: string) {
    const entry = pending.get(text);
    if (!entry) return;
    if (deps.readEditor().trim() !== text.trim()) {
      // The box was cleared, so the site sent the prompt.
      pending.delete(text);
      // On an error, this one prompt is skipped.
      score(text, entry.context).catch(() => undefined);
      return;
    }
    entry.polls += 1;
    if (entry.polls * CONFIRM_POLL_MS >= CONFIRM_TIMEOUT_MS) {
      // Still in the box: the site didn't send it, for example while the
      // AI is still answering.
      pending.delete(text);
      return;
    }
    entry.timer = setTimeout(() => settle(text), CONFIRM_POLL_MS);
  }

  function onSubmit(text: string) {
    if (!active || adapter.isSharedChat()) return;
    const waiting = pending.get(text);
    if (waiting) {
      // Enter and a click for the same prompt, or Enter pressed again:
      // one prompt, counted once.
      waiting.polls = 0;
      return;
    }
    // The site hasn't added this prompt to the page yet.
    const earlier = adapter.getAllUserMessages();
    pending.set(text, {
      context: {
        followUp: earlier.length > 0,
        firstMessage: earlier[0] ?? text,
      },
      polls: 0,
      timer: setTimeout(() => settle(text), CONFIRM_POLL_MS),
    });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    unwatch();
    unsubscribe?.();
    unsubscribe = null;
    active = null;
    cancelPending();
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
  }

  const unwatch = deps.watchStore((keys) => {
    if (keys.some((key) => WATCHED_KEYS.includes(key))) void reload();
  });
  return { ready: reload(), stop };
}

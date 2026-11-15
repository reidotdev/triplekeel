import type { Report } from "@triplekeel/schema";
import { adapterForPage } from "./adapters/index.js";
import { API_BASE, APP_URL } from "./config.js";
import { LIVE_FLUSH_MESSAGE } from "./live-store.js";
import {
  PAGE_STATUS_MESSAGE,
  type PageStatus,
  SCORE_CHAT_PORT,
  type ScoreChatEvent,
  type ScoreChatRequest,
} from "./page-protocol.js";
import {
  doneText,
  type PageInfo,
  popupView,
  SCORE_TEXT,
  scoreView,
  scoringText,
  waitingText,
} from "./popup-view.js";
import { buildImportReports, isKnownTrack, knownQuestions } from "./reports.js";
import {
  readState,
  refresh,
  type SessionState,
  sendReports,
} from "./session.js";

const deps = {
  apiBase: API_BASE,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  store: chrome.storage.local,
};
const hasServer = Boolean(API_BASE && APP_URL);

/** The state of one "Score this chat" run. */
type Run =
  | { phase: "idle" }
  | { phase: "busy" | "done" | "error"; text: string };

let state: SessionState = { connected: false };
let page: PageInfo = { kind: "other" };
let tabId: number | null = null;
let run: Run = { phase: "idle" };

function element(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function setText(id: string, text: string | null) {
  const node = element(id);
  node.textContent = text ?? "";
  node.hidden = text === null;
}

function render() {
  const view = popupView(state, hasServer);
  setText("status", view.status);
  setText("track", view.track);
  setText("note", view.note);
  element("connect").hidden = !view.showConnect;
  element("devices").hidden = !view.showDevices;

  const score = scoreView(state, hasServer, page);
  const active = run.phase === "busy" || run.phase === "done";
  element("score").hidden = !score.showButton || active;
  setText("score-status", run.phase === "idle" ? score.note : run.text);
  element("open-skills").hidden = run.phase !== "done";
}

function show(phase: "busy" | "done" | "error", text: string) {
  run = { phase, text };
  render();
}

function openAppPage(path: string) {
  void chrome.tabs.create({ url: `${APP_URL}${path}` });
  window.close();
}

function isPageStatus(value: unknown): value is PageStatus {
  const status = value as Partial<PageStatus> | null;
  return (
    typeof status?.isConversationPage === "boolean" &&
    typeof status.isSharedChat === "boolean" &&
    typeof status.userMessageCount === "number"
  );
}

/** Asks the active tab's content script whether it shows a chat. */
async function readPage(): Promise<{ tabId: number | null; page: PageInfo }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab.url is only set on claude.ai and chatgpt.com, the host permissions.
  if (tab?.id === undefined || !tab.url) {
    return { tabId: null, page: { kind: "other" } };
  }
  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return { tabId: null, page: { kind: "other" } };
  }
  if (!adapterForPage(document, url)) {
    return { tabId: null, page: { kind: "other" } };
  }
  try {
    const status: unknown = await chrome.tabs.sendMessage(
      tab.id,
      { type: PAGE_STATUS_MESSAGE },
      { frameId: 0 },
    );
    if (isPageStatus(status)) {
      return { tabId: tab.id, page: { kind: "page", status } };
    }
  } catch {
    // No content script yet: the tab was open before the extension loaded.
  }
  return { tabId: tab.id, page: { kind: "reload" } };
}

/**
 * Asks the content script to score the chat. It answers with progress and
 * then reports. Prompt text never comes through this port.
 */
function requestScores(
  tab: number,
  request: ScoreChatRequest,
  onProgress: (done: number, total: number) => void,
): Promise<Exclude<ScoreChatEvent, { type: "progress" }>> {
  return new Promise((resolve) => {
    const port = chrome.tabs.connect(tab, {
      name: SCORE_CHAT_PORT,
      frameId: 0,
    });
    let settled = false;
    const finish = (event: Exclude<ScoreChatEvent, { type: "progress" }>) => {
      if (settled) return;
      settled = true;
      port.disconnect();
      resolve(event);
    };
    port.onMessage.addListener((event: ScoreChatEvent) => {
      if (event?.type === "progress") onProgress(event.done, event.total);
      else if (event?.type === "result" || event?.type === "error") {
        finish(event);
      }
    });
    port.onDisconnect.addListener(() => {
      // Reading lastError keeps Chrome from logging it.
      void chrome.runtime.lastError;
      finish({ type: "error", error: "failed" });
    });
    port.postMessage(request);
  });
}

async function scoreThisChat() {
  if (tabId === null || !state.connected || run.phase === "busy") return;
  const track = state.me?.track;
  if (!track) return show("error", SCORE_TEXT.no_track);
  if (!isKnownTrack(track.id)) {
    return show("error", SCORE_TEXT.unsupported_track);
  }
  const cached = state.questions;
  const questions =
    cached?.trackId === track.id ? knownQuestions(cached.questions) : [];
  if (questions.length === 0) return show("error", SCORE_TEXT.no_questions);

  show("busy", SCORE_TEXT.reading);
  const outcome = await requestScores(
    tabId,
    { type: "start", trackId: track.id, questions },
    (done, total) => show("busy", scoringText(done, total)),
  );
  if (outcome.type === "error") {
    return show("error", SCORE_TEXT[outcome.error] ?? SCORE_TEXT.failed);
  }
  if (outcome.scored.length === 0) {
    return show("error", SCORE_TEXT.none_on_track);
  }
  let reports: Report[];
  try {
    reports = buildImportReports(
      outcome.scored,
      track.id,
      outcome.site,
      new Date(),
    );
  } catch {
    return show("error", SCORE_TEXT.failed);
  }

  show("busy", SCORE_TEXT.sending);
  const sent = await sendReports(deps, reports, (ms) =>
    show("busy", waitingText(ms)),
  );
  if (!sent.ok) {
    if (sent.error === "not_connected") {
      // The device was revoked. The token is gone, as on any other 401.
      state = { connected: false };
      run = { phase: "idle" };
      return render();
    }
    return show(
      "error",
      sent.error === "rate_limited"
        ? SCORE_TEXT.rate_limited
        : SCORE_TEXT.send_failed,
    );
  }
  show("done", doneText(reports.length, sent.inserted));
}

element("connect").addEventListener("click", () => openAppPage("/connect"));
element("devices").addEventListener("click", () =>
  openAppPage("/settings/devices"),
);
element("privacy").hidden = !hasServer;
element("privacy").addEventListener("click", () => openAppPage("/privacy"));
element("score").addEventListener("click", () => void scoreThisChat());
element("open-skills").addEventListener("click", () =>
  openAppPage("/dashboard"),
);

// Show the saved state first, then check it with the server. A revoked
// device gets a 401 here and the popup goes back to "Not connected".
async function main() {
  // Live capture sends its queued reports now if a send is due.
  chrome.runtime
    .sendMessage({ type: LIVE_FLUSH_MESSAGE })
    .catch(() => undefined);
  state = await readState(deps.store);
  render();
  const [fresh, active] = await Promise.all([
    hasServer && state.connected ? refresh(deps) : state,
    readPage(),
  ]);
  state = fresh;
  ({ tabId, page } = active);
  render();
}

void main();

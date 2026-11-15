// The popup's privacy controls (REI-272): Pause all and the site toggles,
// the last 20 scored prompts next to the reports made from them, Clear
// history, and Disconnect.
//
// Prompt text comes from pages the user visits, so everything here is
// written with textContent and never parsed as HTML.
import type { Report } from "@triplekeel/schema";
import type { SiteId } from "./adapters/index.js";
import {
  HISTORY_KEY,
  type HistoryItem,
  QUEUE_KEY,
  readHistory,
  SEND_STATE_KEY,
} from "./live-store.js";
import { disconnect, type KeyValueStore } from "./session.js";
import {
  readSettings,
  SETTINGS_KEY,
  type Settings,
  saveSettings,
} from "./settings.js";

export const SITE_NAME: Record<SiteId, string> = {
  claude: "claude.ai",
  chatgpt: "chatgpt.com",
};

export const STATUS_TEXT: Record<HistoryItem["status"], string> = {
  sent: "Sent",
  queued: "Waiting to send",
  not_sent: "Not sent",
};

/** Prompts longer than this are cut short in the list. */
export const SUMMARY_LENGTH = 80;

const SITES: SiteId[] = ["claude", "chatgpt"];

/** Storage keys that change what the privacy controls show. */
const WATCHED_KEYS = [SETTINGS_KEY, HISTORY_KEY, QUEUE_KEY, SEND_STATE_KEY];

/** One line of the prompt, cut to `max` characters with an ellipsis. */
export function summarize(text: string, max = SUMMARY_LENGTH): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length <= max
    ? chars.join("")
    : `${chars.slice(0, max - 1).join("")}…`;
}

/** The report exactly as stored, pretty-printed. */
export function reportJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

/** Says in words what the toggles do together. */
export function captureText(settings: Settings): string {
  if (settings.paused) return "Paused. No prompts are captured.";
  const on = SITES.filter((site) => settings.sites[site]).map(
    (site) => SITE_NAME[site],
  );
  if (on.length === 0) return "Off on both sites. No prompts are captured.";
  if (on.length === SITES.length) {
    return `On for ${on.join(" and ")}.`;
  }
  return `On for ${on[0]} only.`;
}

/** Short local date and time, like "Nov 15, 14:05". */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The label above each report, by status. */
export const REPORT_LABEL: Record<HistoryItem["status"], string> = {
  sent: "The report that was sent",
  queued: "The report, waiting to send",
  not_sent: "The report. It wasn't sent.",
};

/** Updates an item's status in place. The prompt and report never change. */
function setStatus(details: HTMLElement, status: HistoryItem["status"]) {
  const badge = details.querySelector(".item-status");
  const label = details.querySelector(".report-label");
  if (badge) {
    badge.className = `item-status status-${status}`;
    badge.textContent = STATUS_TEXT[status];
  }
  if (label) label.textContent = REPORT_LABEL[status];
}

/** One history item: a closed <details> with the prompt and its report. */
export function historyItem(
  doc: Document,
  item: HistoryItem,
  format: (ms: number) => string = formatTime,
): HTMLLIElement {
  const li = doc.createElement("li");
  const details = make(doc, "details", "history-item");
  details.dataset.id = item.id;

  const summary = doc.createElement("summary");
  const meta = make(doc, "span", "item-meta");
  const time = make(doc, "time", "", format(item.scoredAt));
  time.dateTime = new Date(item.scoredAt).toISOString();
  meta.append(
    make(doc, "span", "item-status"),
    ` · ${SITE_NAME[item.site] ?? item.site} · `,
    time,
  );
  summary.append(meta, make(doc, "span", "item-summary", summarize(item.text)));

  const pre = make(doc, "pre", "item-report");
  // Focusable, so the keyboard can scroll a long report.
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", "Report JSON");
  pre.append(make(doc, "code", "", reportJson(item.report)));

  details.append(
    summary,
    make(doc, "p", "item-label", "Your prompt. It stays in this browser."),
    make(doc, "p", "item-prompt", item.text),
    make(doc, "p", "item-label report-label"),
    pre,
  );
  setStatus(details, item.status);
  li.append(details);
  return li;
}

export type PrivacyDeps = {
  store: KeyValueStore;
  /** Calls back with the changed keys when chrome.storage.local changes. */
  watchStore(listener: (keys: string[]) => void): () => void;
  /** Runs after Disconnect has cleared the device token. */
  onDisconnected(): void;
  formatTime?: (ms: number) => string;
};

export type PrivacyControls = {
  /** Resolves once the settings and history are shown. */
  ready: Promise<void>;
  /** Reads the settings and history again. */
  refresh(): Promise<void>;
  stop(): void;
};

/**
 * Wires the privacy controls in popup.html to chrome.storage.local. Open
 * claude.ai and chatgpt.com tabs see a toggle at once through
 * chrome.storage.onChanged.
 */
export function mountPrivacy(
  doc: Document,
  deps: PrivacyDeps,
): PrivacyControls {
  const { store } = deps;
  const byId = <T extends HTMLElement>(id: string) =>
    doc.getElementById(id) as T;

  const pause = byId<HTMLInputElement>("pause-all");
  const siteBoxes: Record<SiteId, HTMLInputElement> = {
    claude: byId("site-claude"),
    chatgpt: byId("site-chatgpt"),
  };
  const captureStatus = byId("capture-status");
  const list = byId<HTMLOListElement>("history");
  const empty = byId("history-empty");
  const clear = byId<HTMLButtonElement>("clear-history");
  const disconnectButton = byId<HTMLButtonElement>("disconnect");
  const confirmBox = byId("disconnect-confirm");
  const confirmYes = byId<HTMLButtonElement>("disconnect-yes");
  const confirmNo = byId<HTMLButtonElement>("disconnect-no");

  let loads = 0;

  function showSettings(settings: Settings) {
    pause.checked = settings.paused;
    for (const site of SITES) siteBoxes[site].checked = settings.sites[site];
    captureStatus.textContent = captureText(settings);
  }

  function showHistory(items: HistoryItem[]) {
    const newest = [...items].sort((a, b) => b.scoredAt - a.scoredAt);
    const shown = Array.from(
      list.querySelectorAll<HTMLDetailsElement>("details"),
    );
    const byItemId = new Map(shown.map((node) => [node.dataset.id, node]));
    for (const item of newest) {
      const node = byItemId.get(item.id);
      if (node) setStatus(node, item.status);
    }
    // Only a new or removed prompt redraws the list. Items already shown are
    // reused, so open ones stay open, and a status change keeps focus.
    const sameItems =
      shown.length === newest.length &&
      newest.every((item, index) => shown[index]?.dataset.id === item.id);
    if (!sameItems) {
      list.replaceChildren(
        ...newest.map(
          (item) =>
            byItemId.get(item.id)?.parentElement ??
            historyItem(doc, item, deps.formatTime),
        ),
      );
    }
    list.hidden = newest.length === 0;
    empty.hidden = newest.length > 0;
    clear.hidden = newest.length === 0;
  }

  async function refresh() {
    const run = ++loads;
    const [settings, history] = await Promise.all([
      readSettings(store),
      readHistory(store),
    ]);
    if (run !== loads) return;
    showSettings(settings);
    showHistory(history);
  }

  async function save(change: (settings: Settings) => void) {
    const settings = await readSettings(store);
    change(settings);
    let saved = true;
    try {
      await saveSettings(store, settings);
    } catch {
      saved = false;
    }
    await refresh();
    if (!saved) captureStatus.textContent = "Couldn't save. Try again.";
  }

  pause.addEventListener("change", () => {
    const paused = pause.checked;
    void save((settings) => {
      settings.paused = paused;
    });
  });
  for (const site of SITES) {
    siteBoxes[site].addEventListener("change", () => {
      const on = siteBoxes[site].checked;
      void save((settings) => {
        settings.sites[site] = on;
      });
    });
  }

  clear.addEventListener("click", async () => {
    // Only the local history. Queued reports still go.
    await store.remove([HISTORY_KEY]);
    await refresh();
    // The button is gone now. The empty-list text says what happened.
    empty.focus();
  });

  function askToDisconnect(asking: boolean) {
    disconnectButton.hidden = asking;
    confirmBox.hidden = !asking;
    (asking ? confirmNo : disconnectButton).focus();
  }

  disconnectButton.addEventListener("click", () => askToDisconnect(true));
  confirmNo.addEventListener("click", () => askToDisconnect(false));
  confirmBox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      askToDisconnect(false);
    }
  });
  confirmYes.addEventListener("click", async () => {
    confirmYes.disabled = true;
    await disconnect(store);
    confirmYes.disabled = false;
    confirmBox.hidden = true;
    disconnectButton.hidden = false;
    await refresh();
    deps.onDisconnected();
  });

  const unwatch = deps.watchStore((keys) => {
    if (keys.some((key) => WATCHED_KEYS.includes(key))) void refresh();
  });

  return {
    ready: refresh(),
    refresh,
    stop: unwatch,
  };
}

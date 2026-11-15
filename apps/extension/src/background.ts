import { API_BASE, APP_URL } from "./config.js";
import { createLiveSender } from "./live-send.js";
import { LIVE_FLUSH_MESSAGE, LIVE_REPORT_MESSAGE } from "./live-store.js";
import { handleExternalMessage } from "./messages.js";

const deps = {
  apiBase: API_BASE,
  appUrl: APP_URL,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  store: chrome.storage.local,
};

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    handleExternalMessage(deps, message, sender.url)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "not_connected" }));
    // Keep the channel open for the async reply.
    return true;
  },
);

// Live capture's queue. Content scripts send finished reports, never prompt
// text. The popup asks for a send check when it opens.
const live = createLiveSender(deps);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const type = (message as { type?: unknown } | null)?.type;
  const task =
    type === LIVE_REPORT_MESSAGE
      ? live.enqueue(message)
      : type === LIVE_FLUSH_MESSAGE
        ? live.flushIfDue()
        : null;
  if (!task) return;
  task.then(sendResponse).catch(() => sendResponse({ checkInMs: null }));
  return true;
});

// Reports queued before the browser closed go out once it starts again.
chrome.runtime.onStartup.addListener(() => {
  void live.flushIfDue().catch(() => undefined);
});

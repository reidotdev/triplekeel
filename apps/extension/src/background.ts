import { API_BASE, APP_URL } from "./config.js";
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

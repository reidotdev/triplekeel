import { adapterForPage } from "./adapters/index.js";

const PAGE_STATUS_MESSAGE = "triplekeel.page-status";

// This script only reports whether the page is a conversation and how many
// user messages it shows. It reads no prompt text yet and sends nothing to
// the server. Scoring comes in later tickets.
const adapter = adapterForPage(document, new URL(location.href));

if (adapter) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== PAGE_STATUS_MESSAGE) return;
    sendResponse({
      site: adapter.siteId,
      isConversationPage: adapter.isConversationPage(),
      userMessageCount: adapter.getUserMessages().length,
    });
  });
}

import { createScorer } from "@triplekeel/scorer";
import { adapterForPage } from "./adapters/index.js";
import { findPromptEditor, promptText } from "./adapters/shared.js";
import { createImportKeyer, installSecret } from "./import-key.js";
import { startLiveCapture } from "./live-capture.js";
import {
  PAGE_STATUS_MESSAGE,
  type PageStatus,
  SCORE_CHAT_PORT,
  type ScoreChatEvent,
  type ScoreChatRequest,
} from "./page-protocol.js";
import { ScoreChatError, scoreChat } from "./score-chat.js";

// The content script reads only what the page shows. It never calls the
// site's own APIs. Prompt text stays here: the popup gets counts, answers,
// lengths and import keys, and the background worker gets live reports.
// The only place text is kept is live capture's local history of the last
// 20 scored prompts, in chrome.storage.local. Nothing is logged.
const adapter = adapterForPage(document, new URL(location.href));

async function runScoreChat(
  request: ScoreChatRequest,
  send: (event: ScoreChatEvent) => void,
) {
  if (!adapter) return;
  try {
    const secret = await installSecret(chrome.storage.local);
    const result = await scoreChat({
      adapter,
      trackId: request.trackId,
      questions: request.questions,
      scorer: createScorer(),
      importKey: await createImportKeyer(secret),
      onProgress: (done, total) => send({ type: "progress", done, total }),
    });
    send({ type: "result", ...result });
  } catch (error) {
    send({
      type: "error",
      error: error instanceof ScoreChatError ? error.code : "failed",
    });
  }
}

if (adapter) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== PAGE_STATUS_MESSAGE) return;
    const status: PageStatus = {
      site: adapter.siteId,
      isConversationPage: adapter.isConversationPage(),
      isSharedChat: adapter.isSharedChat(),
      userMessageCount: adapter.getUserMessages().length,
    };
    sendResponse(status);
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== SCORE_CHAT_PORT) return;
    let open = true;
    port.onDisconnect.addListener(() => {
      open = false;
    });
    const send = (event: ScoreChatEvent) => {
      if (open) port.postMessage(event);
    };
    port.onMessage.addListener((message: ScoreChatRequest) => {
      if (message?.type !== "start" || !Array.isArray(message.questions)) {
        return;
      }
      void runScoreChat(message, send);
    });
  });

  // Live capture: each prompt the user sends is scored here, on the page.
  startLiveCapture({
    adapter,
    store: chrome.storage.local,
    watchStore: (listener) => {
      const onChanged = (changes: object, area: string) => {
        if (area === "local") listener(Object.keys(changes));
      };
      chrome.storage.onChanged.addListener(onChanged);
      return () => chrome.storage.onChanged.removeListener(onChanged);
    },
    readEditor: () => promptText(findPromptEditor(document)),
    scorer: createScorer(),
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  });
}

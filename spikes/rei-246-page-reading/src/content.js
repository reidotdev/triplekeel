import { createClaudeAdapter } from './adapters/claude.js';
import { createChatGPTAdapter } from './adapters/chatgpt.js';

const url = new URL(location.href);
const adapter = url.hostname === 'claude.ai'
  ? createClaudeAdapter(document, url)
  : createChatGPTAdapter(document, url);

adapter.onPromptSubmit((text) => {
  console.info(`[TripleKeel REI-246] ${adapter.siteId} submitted prompt:`, text);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'get-user-messages') return;
  const messages = adapter.getUserMessages(20);
  const isConversationPage = adapter.isConversationPage();
  const warning = isConversationPage && messages.length === 0
    ? 'No user messages found. The page may not be loaded or its selectors may have changed.'
    : null;
  if (warning) console.warn(`[TripleKeel REI-246] ${adapter.siteId}: ${warning}`);
  sendResponse({ isConversationPage, messages, warning });
});

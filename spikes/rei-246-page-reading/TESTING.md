# REI-246 manual testing

Load the unpacked extension from `.spike-builds/rei-246/extension/`:

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.spike-builds/rei-246/extension/`.
2. On `claude.ai`, submit three prompts: a short prompt, a long prompt, and a prompt containing a code block. Confirm the page console logs each exact submitted prompt.
3. Repeat on `chatgpt.com`.
4. On each site, open three past conversations: one short, one long, and one containing code. Open the extension popup and click **Score this chat**.
5. Confirm it reports only your messages, in oldest-first order, with no more than 20. Each item should show its first 80 characters. Check the page console for a warning if a conversation page returns zero user messages.
6. Note any missing, duplicated, reordered, truncated, or assistant-authored messages, and any prompt that did not match exactly.

The extension only reads the current DOM and keeps the result in the popup. It makes no network requests.

## Selector research and limits

- ChatGPT past messages use `[data-message-author-role="user"]`, a speaker attribute found in public share-page markup references. A page markup change that removes or changes the role attribute would make the adapter return zero messages. The sanitized fixture is `test/fixtures/chatgpt-share.html`.
- Claude past messages use `[data-testid="user-message"]`, a user-turn marker reported in public Claude share-page DOM research. Claude share pages can show an empty app shell when viewed logged out, so the share-page selector could not be independently confirmed from an unauthenticated session. The sanitized fixture is `test/fixtures/claude-share.html`.
- Signed-in prompt selectors are best guesses and remain **unverified** until you run the checklist. ChatGPT `#prompt-textarea`, semantic contenteditable editors, textareas, and send buttons whose accessible label or test id contains “send” or “submit” are tried. Renaming the editor or button can stop capture.

Public selector references: [ChatGPT share-page selectors](https://github.com/vbalasu/chatgpt-to-markdown/blob/main/chatgpt-to-markdown/references/selectors.md) and [Claude share-page selector notes](https://github.com/browser-use/browser-harness/blob/main/agent-workspace/domain-skills/claude-ai/share-export.md).

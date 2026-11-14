# REI-246 page-reading spike

Minimal Manifest V3 extension that reads submitted prompts and user-authored messages from the open Claude or ChatGPT page. It has no network code. See [TESTING.md](./TESTING.md) for manual Chrome checks and selector limitations.

Run `pnpm install --ignore-workspace` inside this directory, then `pnpm test` and `pnpm build`. The unpacked extension is generated at `dist/extension/`.

## Result note for Linear

- **ChatGPT:** User-message extraction is covered by a sanitized fixture using `[data-message-author-role="user"]` and the unit tests pass. Signed-in live extraction and prompt selectors remain unverified. Most likely break: OpenAI changes the role attribute or composer identifiers. The popup warns if a conversation page yields zero user messages. Recommendation: **go with caveats**, pending the manual checklist.
- **Claude:** User-message extraction is covered by a sanitized fixture using `[data-testid="user-message"]` and the unit tests pass. Signed-in live extraction and prompt selectors remain unverified; unauthenticated share pages did not expose a conversation for independent inspection. Most likely break: Anthropic changes the test id or composer labels. The popup warns if a conversation page yields zero user messages. Recommendation: **go with caveats**, pending the manual checklist.
- No content is sent off-device. Prompt capture only logs to the page console; chat previews appear only in the popup.

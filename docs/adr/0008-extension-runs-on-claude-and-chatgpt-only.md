---

status: accepted
date: 2026-11-14
decision-makers: Andrei
---

# The extension runs on claude.ai and chatgpt.com only

## Context and problem statement

[ADR-0004](0004-browser-extension-local-scoring-in-app-nudges.md) planned an allowlist of six sites: `lovable.dev`, `replit.com`, `v0.app`, `bolt.new`, `claude.ai` and `chatgpt.com`. The repo scaffold (REI-254) set the extension's host permissions to `claude.ai` and `chatgpt.com` only, and `AGENTS.md` made that a hard rule. Which sites does the extension read prompts from for the MVP?

> **Note:** the scaffold set this rule, but no reasons were written down. The drivers below are inferred from the tickets and the planning notes. Confirm or correct them.

## Decision drivers

- The first track is Product manager ([ADR-0002](0002-one-learning-track-agentic-product-builder.md)). PMs, and marketers for the next track, mostly work in ChatGPT and Claude.
- "Score this chat" (REI-266) needs past chat history. ChatGPT and Claude show it on the page.
- Each site's prompt box is different and needs its own adapter. Fewer sites, fewer adapters to fix.
- Broad host permissions get deeper Chrome Web Store review (ADR-0004), and a store listing is planned (REI-296).
- Fewer permissions are easier to explain in the privacy notice.

## Considered options

1. **Six sites,** as in ADR-0004.
2. **claude.ai and chatgpt.com only,** with more sites added later.

## Decision outcome

Chosen: **option 2.** `apps/extension/manifest.json` lists `https://claude.ai/*` and `https://chatgpt.com/*` as host permissions, never `<all_urls>`.

- The REI-246 spike built and tested adapters for these two sites only. It reads user messages with `[data-message-author-role="user"]` on ChatGPT and `[data-testid="user-message"]` on Claude. Both were tested on saved page fixtures, and the live signed-in check is still a manual step.
- `APPS` in the report schema is `chatgpt`, `claude`, and `other` for the paste page ([ADR-0010](0010-report-schema-signal-v1.md)).
- **Adding a site** needs a new ADR or an update to this one, a new adapter, a new `APPS` value and a manifest change. After the MVP freeze, it also goes behind a flag that's off by default.

### Consequences

- Good: two adapters to build and keep working.
- Good: a narrow permission list for review and for users.
- Bad: builders who prompt in Lovable, Replit, v0 or Bolt aren't covered. Walkthroughs that used Lovable have to use Claude or ChatGPT instead.
- Bad: both adapters depend on page attributes the sites can change at any time. The popup warns when a conversation page yields zero user messages.

### Confirmation

- REI-246 manual checklist: signed-in prompt capture and past-message reading work on both sites.
- The Chrome Web Store review (REI-296) accepts the two host permissions.

## Pros and cons of the options

### 1. Six sites

- Good: covers most AI builder tools.
- Bad: six adapters, wider permissions, more review risk. Lovable, Replit, v0 and Bolt have no chat history to score.

### 2. claude.ai and chatgpt.com only

- Good: matches the first two tracks' users and the spike's results.
- Bad: misses the builder tools.

## More information

- Spike: `spikes/rei-246-page-reading/` (REI-246).
- Hard rule in `AGENTS.md`: "Extension host permissions are `claude.ai` and `chatgpt.com` only."

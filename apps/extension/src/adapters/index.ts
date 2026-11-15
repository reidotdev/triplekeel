import { createChatGPTAdapter } from "./chatgpt.js";
import { createClaudeAdapter } from "./claude.js";
import type { SiteAdapter } from "./shared.js";

export type { SiteAdapter, SiteId } from "./shared.js";

/** Returns the adapter for the page, or null on any other site. */
export function adapterForPage(doc: Document, url: URL): SiteAdapter | null {
  const adapters = [
    createClaudeAdapter(doc, url),
    createChatGPTAdapter(doc, url),
  ];
  return adapters.find((adapter) => adapter.matches(url)) ?? null;
}

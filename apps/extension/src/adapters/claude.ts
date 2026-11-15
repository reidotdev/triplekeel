import {
  createAdapterBase,
  type SiteAdapter,
  onPromptSubmit as watchPromptSubmit,
} from "./shared.js";

export function createClaudeAdapter(
  doc: Document = document,
  url: URL = new URL(location.href),
): SiteAdapter {
  // data-testid=user-message identifies Claude's user-authored bubble; it breaks if the product removes or renames this test hook.
  const base = createAdapterBase(
    "claude",
    doc,
    url,
    '[data-testid="user-message"]',
    null,
  );
  return {
    ...base,
    onPromptSubmit: (callback) => watchPromptSubmit(doc, callback),
  };
}

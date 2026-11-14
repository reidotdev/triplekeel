import {
  createAdapterBase,
  onPromptSubmit as watchPromptSubmit,
} from "./shared.js";

export function createClaudeAdapter(
  doc = document,
  url = new URL(location.href),
) {
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

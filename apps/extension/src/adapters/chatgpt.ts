import {
  createAdapterBase,
  type SiteAdapter,
  onPromptSubmit as watchPromptSubmit,
} from "./shared.js";

export function createChatGPTAdapter(
  doc: Document = document,
  url: URL = new URL(location.href),
): SiteAdapter {
  // data-message-author-role is rendered on conversation turns and encodes the speaker; a site markup change removes this attribute.
  // whitespace-pre-wrap isolates the rendered user text from turn controls; a markup change may require a new text selector.
  const base = createAdapterBase(
    "chatgpt",
    doc,
    url,
    '[data-message-author-role="user"]',
    "div.whitespace-pre-wrap",
  );
  return {
    ...base,
    onPromptSubmit: (callback) => watchPromptSubmit(doc, callback),
  };
}

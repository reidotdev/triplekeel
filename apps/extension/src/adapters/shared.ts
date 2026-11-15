export type SiteId = "claude" | "chatgpt";

export type SiteAdapter = {
  siteId: SiteId;
  matches(candidate: URL): boolean;
  isConversationPage(): boolean;
  /**
   * True on a shared chat link (/share/...). Its messages may be someone
   * else's, so they are never scored as the user's own prompts.
   */
  isSharedChat(): boolean;
  /** The conversation ID from the page URL, or null if this isn't a chat. */
  conversationId(): string | null;
  /** The last `limit` user messages on the page, oldest first. */
  getUserMessages(limit?: number): string[];
  /** Every user message rendered on the page, oldest first. */
  getAllUserMessages(): string[];
  onPromptSubmit(callback: (text: string) => void): () => void;
};

type QueryRoot = {
  querySelectorAll(selector: string): Iterable<Element>;
  location?: { href?: string } | null;
};

const SITE_HOSTS: Record<SiteId, string> = {
  claude: "claude.ai",
  chatgpt: "chatgpt.com",
};

// Chat and share paths. ChatGPT also puts chats under a GPT or a project:
// /g/<gpt-or-project>/c/<id>.
const CONVERSATION_PATHS: Record<SiteId, RegExp> = {
  claude: /^\/(?:chat|share)\/([^/?#]+)/,
  chatgpt: /^\/(?:g\/[^/]+\/)?(?:c|share)\/([^/?#]+)/,
};

// Shared chat links. Reading them is fine; scoring them as the user's is not.
const SHARE_PATHS: Record<SiteId, RegExp> = {
  claude: /^\/share\//,
  chatgpt: /^\/(?:g\/[^/]+\/)?share\//,
};

export function textFromElement(element: Element | null | undefined): string {
  if (!element) return "";
  const innerText = (element as HTMLElement).innerText;
  if (innerText) return innerText.trim();

  const clone = element.cloneNode(true) as Element;
  for (const node of clone.querySelectorAll("br")) node.replaceWith("\n");
  for (const node of clone.querySelectorAll("pre, p, div, li")) {
    node.append("\n");
  }
  return (clone.textContent ?? "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function limitedOldestFirst(messages: string[], limit = 20): string[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 20;
  return messages.slice(-safeLimit || messages.length).slice(0, safeLimit);
}

export function createAdapterBase(
  siteId: SiteId,
  doc: QueryRoot,
  url: URL,
  messageSelector: string,
  messageTextSelector: string | null,
): Omit<SiteAdapter, "onPromptSubmit"> {
  const expectedHost = SITE_HOSTS[siteId];
  const currentPath = () => {
    // Chats change URL without a page load, so read the live address.
    const liveUrl = new URL(doc.location?.href || url.href);
    return (liveUrl.hostname === expectedHost ? liveUrl : url).pathname;
  };
  const conversationId = () =>
    CONVERSATION_PATHS[siteId].exec(currentPath())?.[1] ?? null;
  const getAllUserMessages = () =>
    [...doc.querySelectorAll(messageSelector)]
      .map((message) => {
        const textNode = messageTextSelector
          ? message.querySelector(messageTextSelector)
          : message;
        return textFromElement(textNode || message);
      })
      .filter(Boolean);
  return {
    siteId,
    matches(candidate) {
      return (
        candidate.protocol === "https:" && candidate.hostname === expectedHost
      );
    },
    conversationId,
    isConversationPage: () => conversationId() !== null,
    isSharedChat: () => SHARE_PATHS[siteId].test(currentPath()),
    getAllUserMessages,
    getUserMessages: (limit = 20) =>
      limitedOldestFirst(getAllUserMessages(), limit),
  };
}

const PROMPT_SELECTORS = [
  // Unverified: ChatGPT commonly uses #prompt-textarea for its Lexical editor; a site rename breaks lookup.
  "#prompt-textarea",
  // Unverified: editor role and contenteditable are semantic and avoid generated classes; a role change breaks lookup.
  '[contenteditable="true"][role="textbox"]',
  // Unverified: Claude and fallback composers expose contenteditable; broad matching can find other editors, filtered below.
  '[contenteditable="true"]',
  // Unverified: textarea is a stable native control fallback; a custom editor replacing it breaks lookup.
  "textarea",
];

export function isSafePromptEditor(element: Element): element is HTMLElement {
  const view = element.ownerDocument.defaultView;
  if (!view || !(element instanceof view.HTMLElement)) return false;
  const type = (element.getAttribute("type") || "").toLowerCase();
  const autocomplete = (
    element.getAttribute("autocomplete") || ""
  ).toLowerCase();
  const label =
    `${element.getAttribute("aria-label") || ""} ${element.getAttribute("placeholder") || ""}`.toLowerCase();
  if (["password", "email", "number"].includes(type)) return false;
  if (
    /card|cc-|payment|password|security code|cvc|cvv/.test(
      `${autocomplete} ${label}`,
    )
  )
    return false;
  if (
    element.matches(
      'input[type="password"], input[autocomplete*="cc-"], input[name*="card" i]',
    )
  )
    return false;
  return element.matches('textarea, [contenteditable="true"]');
}

export function findPromptEditor(doc: Document): HTMLElement | null {
  for (const selector of PROMPT_SELECTORS) {
    const candidate = [...doc.querySelectorAll(selector)].find(
      isSafePromptEditor,
    );
    if (candidate) return candidate;
  }
  return null;
}

export function promptText(editor: Element | null): string {
  if (!editor || !isSafePromptEditor(editor)) return "";
  const value =
    "value" in editor && typeof editor.value === "string"
      ? editor.value
      : (editor.innerText ?? textFromElement(editor));
  return value.trim() ? value : "";
}

/** Calls back with the prompt text when the user submits. The text stays in the page. */
export function onPromptSubmit(
  doc: Document,
  callback: (text: string) => void,
): () => void {
  const readPrompt = () => {
    const text = promptText(findPromptEditor(doc));
    if (text) callback(text);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    const editor = findPromptEditor(doc);
    const target = event.target as Node | null;
    if (editor && (target === editor || editor.contains(target))) {
      const text = promptText(editor);
      if (text) callback(text);
    }
  };
  const onClick = (event: MouseEvent) => {
    // Native buttons and ARIA button roles survive styling changes; a site may move its send label to an unassociated control.
    const button = (event.target as Element | null)?.closest?.(
      'button, [role="button"]',
    );
    if (!button) return;
    const label =
      `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
    if (/send|submit/.test(label)) readPrompt();
  };
  // Capture-phase listeners run before the site handler clears the editor.
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("click", onClick, true);
  return () => {
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("click", onClick, true);
  };
}

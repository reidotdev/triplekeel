export function textFromElement(element) {
  if (!element) return '';
  if (element.innerText) return element.innerText.trim();

  const clone = element.cloneNode(true);
  for (const node of clone.querySelectorAll('br')) node.replaceWith('\n');
  for (const node of clone.querySelectorAll('pre, p, div, li')) {
    node.append('\n');
  }
  return clone.textContent.replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

export function limitedOldestFirst(messages, limit = 20) {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20;
  return messages.slice(-safeLimit || messages.length).slice(0, safeLimit);
}

export function createAdapterBase(siteId, doc, url, messageSelector, messageTextSelector) {
  return {
    siteId,
    matches(candidate) {
      return candidate.protocol === 'https:' && candidate.hostname === (siteId === 'claude' ? 'claude.ai' : 'chatgpt.com');
    },
    isConversationPage() {
      const liveUrl = new URL(doc.location?.href || url.href);
      const expectedHost = siteId === 'claude' ? 'claude.ai' : 'chatgpt.com';
      const currentUrl = liveUrl.hostname === expectedHost ? liveUrl : url;
      return siteId === 'claude'
        ? /^\/(?:chat|share)\//.test(currentUrl.pathname)
        : /^\/(?:c|share)\//.test(currentUrl.pathname);
    },
    getUserMessages(limit = 20) {
      const messages = [...doc.querySelectorAll(messageSelector)].map((message) => {
        const textNode = messageTextSelector ? message.querySelector(messageTextSelector) : message;
        return textFromElement(textNode || message);
      }).filter(Boolean);
      return limitedOldestFirst(messages, limit);
    },
  };
}

const PROMPT_SELECTORS = [
  // Unverified: ChatGPT commonly uses #prompt-textarea for its Lexical editor; a site rename breaks lookup.
  '#prompt-textarea',
  // Unverified: editor role and contenteditable are semantic and avoid generated classes; a role change breaks lookup.
  '[contenteditable="true"][role="textbox"]',
  // Unverified: Claude and fallback composers expose contenteditable; broad matching can find other editors, filtered below.
  '[contenteditable="true"]',
  // Unverified: textarea is a stable native control fallback; a custom editor replacing it breaks lookup.
  'textarea',
];

export function isSafePromptEditor(element) {
  if (!(element instanceof element.ownerDocument.defaultView.HTMLElement)) return false;
  const type = (element.getAttribute('type') || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''}`.toLowerCase();
  if (['password', 'email', 'number'].includes(type)) return false;
  if (/card|cc-|payment|password|security code|cvc|cvv/.test(`${autocomplete} ${label}`)) return false;
  if (element.matches('input[type="password"], input[autocomplete*="cc-"], input[name*="card" i]')) return false;
  return element.matches('textarea, [contenteditable="true"]');
}

export function findPromptEditor(doc) {
  for (const selector of PROMPT_SELECTORS) {
    const candidate = [...doc.querySelectorAll(selector)].find(isSafePromptEditor);
    if (candidate) return candidate;
  }
  return null;
}

export function promptText(editor) {
  if (!editor || !isSafePromptEditor(editor)) return '';
  const value = 'value' in editor ? editor.value : (editor.innerText ?? textFromElement(editor));
  return value.trim() ? value : '';
}

export function onPromptSubmit(doc, callback) {
  const readPrompt = () => {
    const text = promptText(findPromptEditor(doc));
    if (text) callback(text);
  };
  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const editor = findPromptEditor(doc);
    if (editor && (event.target === editor || editor.contains(event.target))) {
      const text = promptText(editor);
      if (text) callback(text);
    }
  };
  const onClick = (event) => {
    // Native buttons and ARIA button roles survive styling changes; a site may move its send label to an unassociated control.
    const button = event.target?.closest?.('button, [role="button"]');
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`.toLowerCase();
    if (/send|submit/.test(label)) readPrompt();
  };
  // Capture-phase listeners run before the site handler clears the editor.
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('click', onClick, true);
  };
}

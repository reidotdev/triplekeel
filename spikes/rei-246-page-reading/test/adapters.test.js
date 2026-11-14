import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createChatGPTAdapter } from '../src/adapters/chatgpt.js';
import { createClaudeAdapter } from '../src/adapters/claude.js';
import { isSafePromptEditor } from '../src/adapters/shared.js';

const fixture = (name) => readFileSync(`${process.cwd()}/test/fixtures/${name}`, 'utf8');

describe('getUserMessages', () => {
  it('returns only ChatGPT user messages in oldest-first order and honors the limit', () => {
    document.body.innerHTML = fixture('chatgpt-share.html');
    expect(createChatGPTAdapter(document, new URL('https://chatgpt.com/share/example')).getUserMessages(1))
      .toEqual(['[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]']);
  });

  it('returns only Claude user messages in oldest-first order', () => {
    document.body.innerHTML = fixture('claude-share.html');
    expect(createClaudeAdapter(document, new URL('https://claude.ai/share/example')).getUserMessages())
      .toEqual(['[USER MESSAGE ONE]', '[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]']);
  });

  it('returns the last 20 messages by default', () => {
    document.body.innerHTML = Array.from({ length: 25 }, (_, index) =>
      `<div data-testid="user-message">[USER ${index}]</div>`).join('');
    const messages = createClaudeAdapter(document, new URL('https://claude.ai/chat/example')).getUserMessages();
    expect(messages).toHaveLength(20);
    expect(messages[0]).toBe('[USER 5]');
    expect(messages.at(-1)).toBe('[USER 24]');
  });

  it('recognizes conversation and share paths only on its own site', () => {
    expect(createChatGPTAdapter(document, new URL('https://chatgpt.com/c/123')).isConversationPage()).toBe(true);
    expect(createChatGPTAdapter(document, new URL('https://chatgpt.com/')).isConversationPage()).toBe(false);
    expect(createClaudeAdapter(document, new URL('https://claude.ai/share/123')).isConversationPage()).toBe(true);
    expect(createClaudeAdapter(document, new URL('https://claude.ai/')).isConversationPage()).toBe(false);
  });

  it('rejects password and payment fields as prompt editors', () => {
    document.body.innerHTML = '<input type="password"><textarea autocomplete="cc-number"></textarea><textarea></textarea>';
    const [password, payment, safePrompt] = document.body.children;
    expect(isSafePromptEditor(password)).toBe(false);
    expect(isSafePromptEditor(payment)).toBe(false);
    expect(isSafePromptEditor(safePrompt)).toBe(true);
  });

  it('captures Enter without Shift before the site clears the editor and keeps normal key handling', () => {
    document.body.innerHTML = '<textarea>Prompt with exact text</textarea>';
    const adapter = createChatGPTAdapter(document, new URL('https://chatgpt.com/'));
    const captured = [];
    const unsubscribe = adapter.onPromptSubmit((text) => captured.push(text));
    const editor = document.querySelector('textarea');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    editor.dispatchEvent(enter);
    expect(captured).toEqual(['Prompt with exact text']);
    expect(enter.defaultPrevented).toBe(false);
    const shifted = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
    editor.dispatchEvent(shifted);
    expect(captured).toHaveLength(1);
    unsubscribe();
  });

  it('captures send-button clicks from rich editors and supports unsubscribe', () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox">Rich prompt <code>block</code></div><button aria-label="Send message">Send</button>';
    const adapter = createClaudeAdapter(document, new URL('https://claude.ai/new'));
    const captured = [];
    const unsubscribe = adapter.onPromptSubmit((text) => captured.push(text));
    document.querySelector('button').click();
    expect(captured).toEqual(['Rich prompt block']);
    unsubscribe();
    document.querySelector('button').click();
    expect(captured).toHaveLength(1);
  });

  it('does not capture Enter from another field and captures nested rich-editor targets', () => {
    document.body.innerHTML = '<textarea>Page field</textarea><div contenteditable="true" role="textbox">Prompt <span>nested</span></div>';
    const adapter = createClaudeAdapter(document, new URL('https://claude.ai/new'));
    const captured = [];
    adapter.onPromptSubmit((text) => captured.push(text));
    document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.querySelector('[contenteditable] span').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(captured).toEqual(['Prompt nested']);
    const editor = document.querySelector('[contenteditable]');
    editor.replaceChildren();
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(captured).toHaveLength(1);
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createChatGPTAdapter } from "./chatgpt.js";
import { createClaudeAdapter } from "./claude.js";
import { adapterForPage } from "./index.js";
import { isSafePromptEditor } from "./shared.js";

function loadFixture(name: string) {
  document.body.innerHTML = readFileSync(
    join(import.meta.dirname, "fixtures", name),
    "utf8",
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("getUserMessages with sanitized page fixtures", () => {
  it("returns only the last ChatGPT user message with code", () => {
    loadFixture("chatgpt-share.html");
    const adapter = createChatGPTAdapter(
      document,
      new URL("https://chatgpt.com/share/example"),
    );
    expect(adapter.getUserMessages(1)).toEqual([
      "[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]",
    ]);
  });

  it("returns Claude user messages oldest first and excludes the assistant", () => {
    loadFixture("claude-share.html");
    const adapter = createClaudeAdapter(
      document,
      new URL("https://claude.ai/share/example"),
    );
    expect(adapter.getUserMessages()).toEqual([
      "[USER MESSAGE ONE]",
      "[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]",
    ]);
  });

  it("defaults to the last 20 messages in oldest-first order", () => {
    document.body.innerHTML = Array.from(
      { length: 25 },
      (_, index) => `<div data-testid="user-message">[USER ${index}]</div>`,
    ).join("");
    const adapter = createClaudeAdapter(
      document,
      new URL("https://claude.ai/chat/example"),
    );
    const messages = adapter.getUserMessages();
    expect(messages).toHaveLength(20);
    expect(messages[0]).toBe("[USER 5]");
    expect(messages.at(-1)).toBe("[USER 24]");
  });
});

describe("adapterForPage", () => {
  it("picks the adapter by host and ignores other sites", () => {
    expect(
      adapterForPage(document, new URL("https://claude.ai/new"))?.siteId,
    ).toBe("claude");
    expect(
      adapterForPage(document, new URL("https://chatgpt.com/"))?.siteId,
    ).toBe("chatgpt");
    expect(adapterForPage(document, new URL("https://example.com/"))).toBe(
      null,
    );
    expect(adapterForPage(document, new URL("http://claude.ai/"))).toBe(null);
  });
});

describe("browser DOM interactions", () => {
  it("recognizes conversation and share paths only on its own site", () => {
    expect(
      createChatGPTAdapter(
        document,
        new URL("https://chatgpt.com/c/123"),
      ).isConversationPage(),
    ).toBe(true);
    expect(
      createChatGPTAdapter(
        document,
        new URL("https://chatgpt.com/"),
      ).isConversationPage(),
    ).toBe(false);
    expect(
      createClaudeAdapter(
        document,
        new URL("https://claude.ai/share/123"),
      ).isConversationPage(),
    ).toBe(true);
    expect(
      createClaudeAdapter(
        document,
        new URL("https://claude.ai/"),
      ).isConversationPage(),
    ).toBe(false);
  });

  it("rejects password and payment fields as prompt editors", () => {
    document.body.innerHTML =
      '<input type="password"><textarea autocomplete="cc-number"></textarea><textarea></textarea>';
    const [password, payment, safePrompt] = document.body.children;
    expect(isSafePromptEditor(password)).toBe(false);
    expect(isSafePromptEditor(payment)).toBe(false);
    expect(isSafePromptEditor(safePrompt)).toBe(true);
  });

  it("captures Enter without Shift and preserves normal key handling", () => {
    document.body.innerHTML = "<textarea>Prompt with exact text</textarea>";
    const adapter = createChatGPTAdapter(
      document,
      new URL("https://chatgpt.com/"),
    );
    const captured: string[] = [];
    const unsubscribe = adapter.onPromptSubmit((text) => captured.push(text));
    const editor = document.querySelector("textarea");
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    editor?.dispatchEvent(enter);
    expect(captured).toEqual(["Prompt with exact text"]);
    expect(enter.defaultPrevented).toBe(false);
    editor?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(captured).toHaveLength(1);
    unsubscribe();
  });

  it("captures send-button clicks from rich editors and supports unsubscribe", () => {
    document.body.innerHTML =
      '<div contenteditable="true" role="textbox">Rich prompt <code>block</code></div><button aria-label="Send message">Send</button>';
    const adapter = createClaudeAdapter(
      document,
      new URL("https://claude.ai/new"),
    );
    const captured: string[] = [];
    const unsubscribe = adapter.onPromptSubmit((text) => captured.push(text));
    document.querySelector("button")?.click();
    expect(captured).toEqual(["Rich prompt block"]);
    unsubscribe();
    document.querySelector("button")?.click();
    expect(captured).toHaveLength(1);
  });

  it("ignores unrelated fields and captures nested editor targets", () => {
    document.body.innerHTML =
      '<textarea>Page field</textarea><div contenteditable="true" role="textbox">Prompt <span>nested</span></div>';
    const adapter = createClaudeAdapter(
      document,
      new URL("https://claude.ai/new"),
    );
    const captured: string[] = [];
    const unsubscribe = adapter.onPromptSubmit((text) => captured.push(text));
    document
      .querySelector("textarea")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    document
      .querySelector("[contenteditable] span")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    expect(captured).toEqual(["Prompt nested"]);
    const editor = document.querySelector("[contenteditable]");
    editor?.replaceChildren();
    editor?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(captured).toHaveLength(1);
    unsubscribe();
  });
});

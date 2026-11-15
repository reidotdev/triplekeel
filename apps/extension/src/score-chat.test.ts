// @vitest-environment jsdom
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QUESTION_IDS, type TrackQuestion } from "@triplekeel/schema";
import {
  createScorer,
  type ScoreContext,
  type Scorer,
} from "@triplekeel/scorer";
import { beforeEach, describe, expect, it } from "vitest";
import { createChatGPTAdapter } from "./adapters/chatgpt.js";
import { createClaudeAdapter } from "./adapters/claude.js";
import type { SiteAdapter } from "./adapters/index.js";
import type { TrackQuestion as ApiQuestion } from "./api.js";
import { createImportKeyer, installSecret } from "./import-key.js";
import { buildImportReports, knownQuestions } from "./reports.js";
import {
  collectUserMessages,
  keepOnTrack,
  MAX_CHAT_MESSAGES,
  ScoreChatError,
  scoreChat,
} from "./score-chat.js";
import { sendReports } from "./session.js";
import {
  memoryStore,
  scriptedFetch,
  TEST_API,
  TEST_TOKEN,
} from "./test-utils.js";

const crypto = webcrypto as unknown as Crypto;
const TRACK = "product-manager";
const CLAUDE_URL =
  "https://claude.ai/chat/1b2c3d4e-0000-4000-8000-000000000001";
const CHATGPT_URL =
  "https://chatgpt.com/c/6650aa00-0000-4000-8000-000000000002";
const SECRET = "ab".repeat(32);
const NOW = new Date("2026-11-15T10:42:00Z");

const API_QUESTIONS: ApiQuestion[] = QUESTION_IDS.map((id) => ({
  id,
  text: `Question ${id}`,
  area: "problem_discovery",
  polarity: "good",
  answers: ["yes", "partly", "no", "n/a"],
}));
const QUESTIONS: TrackQuestion[] = knownQuestions(API_QUESTIONS);

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "adapters/fixtures", name), {
    encoding: "utf8",
  });
}

function claudeChat(url = CLAUDE_URL): SiteAdapter {
  document.body.innerHTML = fixture("claude-chat.html");
  return createClaudeAdapter(document, new URL(url));
}

function chatgptChat(url = CHATGPT_URL): SiteAdapter {
  document.body.innerHTML = fixture("chatgpt-chat.html");
  return createChatGPTAdapter(document, new URL(url));
}

/** Every user message in a fixture, as the adapter reads it. */
function promptTexts(adapter: SiteAdapter): string[] {
  return adapter.getAllUserMessages();
}

/** createScorer(), recording each call's context. */
function recordingScorer() {
  const real = createScorer();
  const contexts: Array<ScoreContext | undefined> = [];
  const scorer: Scorer = {
    id: real.id,
    ready: (onProgress) => real.ready(onProgress),
    score: (prompt, questions, context) => {
      contexts.push(context);
      return real.score(prompt, questions, context);
    },
  };
  return { scorer, contexts };
}

async function score(adapter: SiteAdapter, secret = SECRET) {
  const progress: string[] = [];
  const result = await scoreChat({
    adapter,
    trackId: TRACK,
    questions: QUESTIONS,
    scorer: createScorer(),
    importKey: await createImportKeyer(secret, crypto),
    onProgress: (done, total) => progress.push(`${done}/${total}`),
  });
  return { ...result, progress };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("collecting the user's messages", () => {
  it("keeps the last 20 user messages in order, with their place in the chat", () => {
    const chat = collectUserMessages(claudeChat());
    expect(chat.messages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(chat.messages.map((m) => m.position)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 3),
    );
    expect(chat.messages[0].text).toMatch(/^Break it into steps/);
    expect(chat.messages.at(-1)?.text).toBe("Thanks, that is great.");
    expect(chat.firstMessage).toMatch(/^Write a PRD/);
    expect(chat.messages.some((m) => m.text.includes("ASSISTANT"))).toBe(false);
  });

  it("reads both sites' share fixtures without the assistant's replies", () => {
    document.body.innerHTML = fixture("claude-share.html");
    const claude = collectUserMessages(
      createClaudeAdapter(document, new URL("https://claude.ai/share/abc")),
    );
    expect(claude.messages).toEqual([
      { position: 0, text: "[USER MESSAGE ONE]" },
      {
        position: 1,
        text: "[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]",
      },
    ]);
    document.body.innerHTML = fixture("chatgpt-share.html");
    const chatgpt = collectUserMessages(
      createChatGPTAdapter(document, new URL("https://chatgpt.com/share/abc")),
    );
    expect(chatgpt.messages.map((m) => m.text)).toEqual([
      "[USER MESSAGE ONE]",
      "[USER MESSAGE TWO WITH CODE]\n[CODE PLACEHOLDER]",
    ]);
  });

  it("finds the conversation ID in chat, share, GPT and project URLs", () => {
    const claude = (url: string) =>
      createClaudeAdapter(document, new URL(url)).conversationId();
    const chatgpt = (url: string) =>
      createChatGPTAdapter(document, new URL(url)).conversationId();
    expect(claude("https://claude.ai/chat/abc-1")).toBe("abc-1");
    expect(claude("https://claude.ai/share/abc-2")).toBe("abc-2");
    expect(claude("https://claude.ai/new")).toBeNull();
    expect(chatgpt("https://chatgpt.com/c/abc-3?model=x")).toBe("abc-3");
    expect(chatgpt("https://chatgpt.com/g/g-p-123-notes/c/abc-4")).toBe(
      "abc-4",
    );
    expect(chatgpt("https://chatgpt.com/g/g-123-gpt")).toBeNull();
  });
});

describe("routing", () => {
  it("drops personal messages from an on-track chat", () => {
    const kept = keepOnTrack(collectUserMessages(claudeChat()), TRACK);
    expect(kept).toHaveLength(18);
    const texts = kept.map((m) => m.text);
    expect(texts.some((t) => t.includes("therapist"))).toBe(false);
    expect(texts.some((t) => t.includes("divorce"))).toBe(false);
    // Short follow-ups take the chat's track from its first message.
    expect(texts).toContain("Make the tone shorter.");
  });

  it("drops off-track messages and keeps only the ones about the track", () => {
    const kept = keepOnTrack(collectUserMessages(chatgptChat()), TRACK);
    expect(kept).toEqual([
      {
        position: 2,
        text: "Now build a landing page for my poetry newsletter with a signup form.",
      },
    ]);
  });

  it("drops everything when the user's track is another one", () => {
    const chat = collectUserMessages(claudeChat());
    expect(keepOnTrack(chat, "marketer")).toEqual([]);
  });
});

describe("scoring a chat", () => {
  it("scores each kept message with createScorer() and reports progress", async () => {
    const { scorer, contexts } = recordingScorer();
    const progress: string[] = [];
    const result = await scoreChat({
      adapter: claudeChat(),
      trackId: TRACK,
      questions: QUESTIONS,
      scorer,
      importKey: await createImportKeyer(SECRET, crypto),
      onProgress: (done, total) => progress.push(`${done} of ${total}`),
    });
    expect(result.found).toBe(20);
    expect(result.site).toBe("claude");
    expect(result.scored).toHaveLength(18);
    expect(progress[0]).toBe("0 of 18");
    expect(progress[7]).toBe("7 of 18");
    expect(progress.at(-1)).toBe("18 of 18");
    // Positions 3+ are all follow-ups.
    expect(contexts.every((c) => c?.followUp === true)).toBe(true);
    for (const message of result.scored) {
      expect(message.answers.map((a) => a.q)).toEqual(
        QUESTIONS.map((q) => q.id),
      );
      expect(Object.keys(message).sort()).toEqual([
        "answers",
        "importKey",
        "promptLength",
      ]);
    }
  });

  it("marks only the chat's first message as not a follow-up", async () => {
    const { scorer, contexts } = recordingScorer();
    document.body.innerHTML = [
      "Write a PRD for a booking app for dentists.",
      "fix it",
    ]
      .map((text) => `<div data-testid="user-message">${text}</div>`)
      .join("");
    await scoreChat({
      adapter: createClaudeAdapter(document, new URL(CLAUDE_URL)),
      trackId: TRACK,
      questions: QUESTIONS,
      scorer,
      importKey: async () => "0".repeat(64),
    });
    expect(contexts).toEqual([{ followUp: false }, { followUp: true }]);
  });

  it("refuses a page that isn't a chat, or shows no messages", async () => {
    const notChat = createClaudeAdapter(
      document,
      new URL("https://claude.ai/new"),
    );
    await expect(score(notChat)).rejects.toEqual(
      new ScoreChatError("not_conversation"),
    );
    const empty = createClaudeAdapter(document, new URL(CLAUDE_URL));
    await expect(score(empty)).rejects.toEqual(
      new ScoreChatError("no_messages"),
    );
  });
});

describe("reports", () => {
  it("builds valid import reports with a 64-hex import_key", async () => {
    const { scored } = await score(claudeChat());
    const reports = buildImportReports(scored, TRACK, "claude", NOW);
    expect(reports).toHaveLength(18);
    for (const report of reports) {
      expect(report).toMatchObject({
        schema: "triplekeel.signal.v1",
        track: TRACK,
        app: "claude",
        source: "import",
        hour: "2026-11-15T10:00Z",
      });
      expect(report.import_key).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Set(reports.map((r) => r.import_key)).size).toBe(18);
  });

  it("gives the same keys when the same chat is scored again", async () => {
    const first = await score(claudeChat());
    const second = await score(claudeChat());
    expect(second.scored.map((m) => m.importKey)).toEqual(
      first.scored.map((m) => m.importKey),
    );
  });

  it("gives different keys for another chat, another site or another install", async () => {
    const keys = (result: Awaited<ReturnType<typeof score>>) =>
      new Set(result.scored.map((m) => m.importKey));
    const base = keys(await score(claudeChat()));
    const otherChat = keys(
      await score(claudeChat("https://claude.ai/chat/another-chat")),
    );
    const otherInstall = keys(await score(claudeChat(), "cd".repeat(32)));
    for (const other of [otherChat, otherInstall]) {
      expect([...other].some((key) => base.has(key))).toBe(false);
    }
    const keyer = await createImportKeyer(SECRET, crypto);
    const identity = { conversationId: "x", position: 0, text: "fix it" };
    expect(await keyer({ ...identity, site: "claude" })).not.toBe(
      await keyer({ ...identity, site: "chatgpt" }),
    );
    expect(await keyer({ ...identity, site: "claude" })).not.toBe(
      await keyer({ ...identity, site: "claude", position: 1 }),
    );
  });

  it("is not a plain SHA-256 of the prompt text", async () => {
    const keyer = await createImportKeyer(SECRET, crypto);
    const key = await keyer({
      site: "claude",
      conversationId: "x",
      position: 0,
      text: "fix it",
    });
    const plain = createHash("sha256").update("fix it").digest("hex");
    expect(key).not.toBe(plain);
  });

  it("makes the install secret once and reuses it", async () => {
    const store = memoryStore();
    const secret = await installSecret(store, crypto);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(await installSecret(store, crypto)).toBe(secret);
    expect(await installSecret(memoryStore(), crypto)).not.toBe(secret);
    // A broken value is replaced.
    const broken = memoryStore({ importKeySecret: "nope" });
    expect(await installSecret(broken, crypto)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("leaves out questions this build doesn't know", () => {
    const known = knownQuestions([
      ...API_QUESTIONS.slice(0, 2),
      { ...API_QUESTIONS[0] },
      { ...API_QUESTIONS[0], id: "future_question" },
      { ...API_QUESTIONS[2], answers: ["yes", "maybe"] },
    ]);
    expect(known.map((q) => q.id)).toEqual(QUESTION_IDS.slice(0, 2));
  });
});

describe("privacy", () => {
  it("sends reports to /api/signals with no prompt text in the body", async () => {
    const server = scriptedFetch([
      () => Response.json({ received: 18, inserted: 18 }),
      () => Response.json({ received: 1, inserted: 1 }),
    ]);
    const store = memoryStore({ deviceToken: TEST_TOKEN });
    const deps = { apiBase: TEST_API, fetch: server.fetch, store };

    const texts: string[] = [];
    for (const [load, app] of [
      [claudeChat, "claude"],
      [chatgptChat, "chatgpt"],
    ] as const) {
      const adapter = load();
      texts.push(...promptTexts(adapter));
      const { scored } = await score(adapter);
      const sent = await sendReports(
        deps,
        buildImportReports(scored, TRACK, app, NOW),
      );
      expect(sent.ok).toBe(true);
    }

    expect(server.requests).toHaveLength(2);
    expect(texts).toHaveLength(27);
    for (const request of server.requests) {
      expect(request).toMatchObject({
        path: "/api/signals",
        method: "POST",
        authorization: `Bearer ${TEST_TOKEN}`,
      });
      expect(Object.keys(JSON.parse(request.body))).toEqual(["reports"]);
      for (const text of texts) {
        expect(request.body).not.toContain(text);
        // The same text as it would look inside a JSON string.
        expect(request.body).not.toContain(JSON.stringify(text).slice(1, -1));
      }
    }
  });
});

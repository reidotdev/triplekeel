// @vitest-environment jsdom
import { QUESTION_IDS, type Report } from "@triplekeel/schema";
import {
  createScorer,
  type ScoreContext,
  type Scorer,
} from "@triplekeel/scorer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChatGPTAdapter } from "./adapters/chatgpt.js";
import { createClaudeAdapter } from "./adapters/claude.js";
import type { SiteAdapter } from "./adapters/index.js";
import { findPromptEditor, promptText } from "./adapters/shared.js";
import {
  CONFIRM_POLL_MS,
  CONFIRM_TIMEOUT_MS,
  type LiveMessage,
  startLiveCapture,
} from "./live-capture.js";
import { createLiveSender } from "./live-send.js";
import {
  FLUSH_AGE_MS,
  HISTORY_CAP,
  LIVE_FLUSH_MESSAGE,
  LIVE_REPORT_MESSAGE,
  type LiveReportMessage,
  readHistory,
} from "./live-store.js";
import { disconnect } from "./session.js";
import { DEFAULT_SETTINGS, parseSettings, saveSettings } from "./settings.js";
import {
  memoryStore,
  scriptedFetch,
  TEST_API,
  TEST_TOKEN,
} from "./test-utils.js";

const TRACK = { id: "product-manager", name: "Product manager" };
const QUESTIONS = {
  trackId: TRACK.id,
  questions: QUESTION_IDS.map((id) => ({
    id,
    text: `Question ${id}`,
    area: "problem_discovery",
    polarity: "good",
    answers: ["yes", "partly", "no", "n/a"],
  })),
  fetchedAt: 0,
};

// Distinct words, so a leak of any prompt into a request is easy to find.
const PRODUCT_PROMPT =
  "Write a PRD for the zebrafinch checkout page for busy parents.";
const FOLLOW_UP = "fix it";
const PERSONAL_PROMPT =
  "Build a page to track my medication and my doctor visits.";
const OFF_TOPIC = "What is the capital of Mongolia?";

const CLAUDE_CHAT =
  "https://claude.ai/chat/1b2c3d4e-0000-4000-8000-000000000001";
const CHATGPT_HOME = "https://chatgpt.com/";

function connectedStore(extra: Record<string, unknown> = {}) {
  return memoryStore({
    deviceToken: TEST_TOKEN,
    me: { email: null, track: TRACK },
    questions: QUESTIONS,
    ...extra,
  });
}

type Site = "claude" | "chatgpt";
type Store = ReturnType<typeof connectedStore>;

/**
 * A minimal chat page. Like the real sites, its own handlers run after the
 * extension's capture listeners: they clear the box and show the message.
 */
function chatPage(site: Site, url: string, earlier: string[] = []) {
  const message = (text: string) =>
    site === "claude"
      ? `<div data-testid="user-message">${text}</div>`
      : `<div data-message-author-role="user"><div class="whitespace-pre-wrap">${text}</div></div>`;
  document.body.innerHTML = `<main>${earlier.map(message).join("")}</main>
    <textarea id="prompt-textarea"></textarea>
    <button aria-label="Send prompt" data-testid="send-button">Send</button>
    <input type="password" aria-label="Password">`;
  const editor = document.querySelector("textarea") as HTMLTextAreaElement;
  let accepting = true;
  const send = () => {
    if (!accepting || !editor.value.trim()) return;
    document
      .querySelector("main")
      ?.insertAdjacentHTML("beforeend", message(editor.value));
    editor.value = "";
  };
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) send();
  });
  document.querySelector("button")?.addEventListener("click", send);
  const adapter: SiteAdapter =
    site === "claude"
      ? createClaudeAdapter(document, new URL(url))
      : createChatGPTAdapter(document, new URL(url));
  return {
    adapter,
    editor,
    type(text: string) {
      editor.value = text;
    },
    enter(shiftKey = false) {
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey, bubbles: true }),
      );
    },
    click() {
      (document.querySelector("button") as HTMLButtonElement).click();
    },
    /** While the AI answers, the site doesn't send. */
    busy(value: boolean) {
      accepting = !value;
    },
  };
}

async function start(
  page: ReturnType<typeof chatPage>,
  store: Store,
  sendMessage?: (message: LiveMessage) => Promise<unknown>,
) {
  const messages: LiveMessage[] = [];
  const contexts: Array<ScoreContext | undefined> = [];
  const scored: string[] = [];
  const real = createScorer();
  const scorer: Scorer = {
    id: real.id,
    ready: () => real.ready(),
    async score(prompt, questions, context) {
      scored.push(prompt);
      contexts.push(context);
      return real.score(prompt, questions, context);
    },
  };
  const capture = startLiveCapture({
    adapter: page.adapter,
    store,
    watchStore: store.watch,
    readEditor: () => promptText(findPromptEditor(document)),
    scorer,
    sendMessage: async (message) => {
      messages.push(message);
      return sendMessage ? sendMessage(message) : { checkInMs: null };
    },
    newId: () => `id-${++ids}`,
  });
  await capture.ready;
  const reports = () =>
    messages
      .filter((m): m is LiveReportMessage => m.type === LIVE_REPORT_MESSAGE)
      .map((m) => m.report);
  return { capture, messages, contexts, scored, reports };
}

/** Lets the confirm check run and the scoring finish. */
const settle = () => vi.advanceTimersByTimeAsync(CONFIRM_POLL_MS * 2);

async function send(page: ReturnType<typeof chatPage>, text: string) {
  page.type(text);
  page.enter();
  await settle();
}

let ids = 0;

beforeEach(() => {
  ids = 0;
  vi.useFakeTimers({ now: new Date("2026-11-15T10:42:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("live capture: submit detection", () => {
  it("scores a prompt sent with Enter, but not a Shift+Enter new line", async () => {
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, connectedStore());
    page.type(PRODUCT_PROMPT);
    page.enter(true);
    await settle();
    expect(live.reports()).toEqual([]);

    page.enter();
    await settle();
    expect(live.reports()).toHaveLength(1);
    const [report] = live.reports();
    expect(report).toMatchObject({
      schema: "triplekeel.signal.v1",
      track: "product-manager",
      app: "claude",
      source: "live",
      hour: "2026-11-15T10:00Z",
      length_bucket: "50-200",
    });
    expect(report).not.toHaveProperty("import_key");
    live.capture.stop();
  });

  it("scores a prompt sent with the send button", async () => {
    const page = chatPage("chatgpt", CHATGPT_HOME);
    const live = await start(page, connectedStore());
    page.type(PRODUCT_PROMPT);
    page.click();
    await settle();
    expect(live.reports()).toHaveLength(1);
    expect(live.reports()[0].app).toBe("chatgpt");
    live.capture.stop();
  });

  it("counts Enter and a click for the same prompt once", async () => {
    const page = chatPage("chatgpt", CHATGPT_HOME);
    const live = await start(page, connectedStore());
    // Some sites click their own send button when Enter is pressed.
    page.editor.addEventListener(
      "keydown",
      () => (document.querySelector("button") as HTMLButtonElement).click(),
      true,
    );
    page.type(PRODUCT_PROMPT);
    page.enter();
    page.click();
    await settle();
    expect(live.reports()).toHaveLength(1);
    live.capture.stop();
  });

  it("doesn't count a prompt the site didn't send", async () => {
    const page = chatPage("chatgpt", CHATGPT_HOME);
    const live = await start(page, connectedStore());
    page.busy(true);
    page.type(PRODUCT_PROMPT);
    page.enter();
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS + CONFIRM_POLL_MS);
    expect(live.reports()).toEqual([]);

    // Pressed again while the first is still waiting, then really sent.
    page.enter();
    await vi.advanceTimersByTimeAsync(CONFIRM_POLL_MS);
    page.enter();
    page.busy(false);
    page.enter();
    await settle();
    expect(live.reports()).toHaveLength(1);
    live.capture.stop();
  });

  it("never reads password or payment fields", async () => {
    document.body.innerHTML =
      '<input type="password" value="hunter2-product-page"><textarea autocomplete="cc-number">4111 checkout page</textarea>';
    const adapter = createChatGPTAdapter(document, new URL(CHATGPT_HOME));
    const store = connectedStore();
    const live = await start({ adapter } as ReturnType<typeof chatPage>, store);
    for (const field of document.querySelectorAll("input, textarea")) {
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    }
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);
    expect(live.scored).toEqual([]);
    expect(live.reports()).toEqual([]);
    live.capture.stop();
  });

  it("ignores shared chat links", async () => {
    const page = chatPage("claude", "https://claude.ai/share/abc");
    const live = await start(page, connectedStore());
    await send(page, PRODUCT_PROMPT);
    expect(live.scored).toEqual([]);
    live.capture.stop();
  });
});

describe("live capture: routing", () => {
  it("drops personal and off-track prompts before scoring", async () => {
    const page = chatPage("claude", "https://claude.ai/new");
    const store = connectedStore();
    const live = await start(page, store);
    await send(page, PERSONAL_PROMPT);
    await send(page, OFF_TOPIC);
    expect(live.scored).toEqual([]);
    expect(live.messages.filter((m) => m.type === LIVE_REPORT_MESSAGE)).toEqual(
      [],
    );
    expect(store.data.liveHistory).toBeUndefined();
    live.capture.stop();
  });

  it("treats the chat's first prompt as new and later ones as follow-ups", async () => {
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, connectedStore());
    await send(page, PRODUCT_PROMPT);
    // "fix it" has no track words. It takes the chat's route.
    await send(page, FOLLOW_UP);
    expect(live.scored).toEqual([PRODUCT_PROMPT, FOLLOW_UP]);
    expect(live.contexts).toEqual([{ followUp: false }, { followUp: true }]);
    live.capture.stop();
  });

  it("routes a follow-up by the chat's first prompt on an open chat", async () => {
    const offTrack = chatPage("claude", CLAUDE_CHAT, [OFF_TOPIC]);
    const first = await start(offTrack, connectedStore());
    await send(offTrack, FOLLOW_UP);
    expect(first.scored).toEqual([]);
    first.capture.stop();

    const onTrack = chatPage("claude", CLAUDE_CHAT, [PRODUCT_PROMPT]);
    const second = await start(onTrack, connectedStore());
    await send(onTrack, FOLLOW_UP);
    expect(second.contexts).toEqual([{ followUp: true }]);
    // A personal follow-up is dropped even in a product chat.
    await send(onTrack, "Also, what should I tell my therapist?");
    expect(second.scored).toEqual([FOLLOW_UP]);
    second.capture.stop();
  });
});

describe("live capture: when it runs", () => {
  it("captures only when connected with a track and its questions", async () => {
    const cases = [
      memoryStore({ me: { email: null, track: TRACK }, questions: QUESTIONS }),
      connectedStore({ me: { email: null, track: null } }),
      connectedStore({ questions: undefined }),
      connectedStore({ questions: { ...QUESTIONS, trackId: "marketer" } }),
      connectedStore({
        me: { email: null, track: { id: "marketer", name: "Marketer" } },
      }),
    ];
    for (const store of cases) {
      const page = chatPage("claude", "https://claude.ai/new");
      const live = await start(page, store);
      await send(page, PRODUCT_PROMPT);
      expect(live.scored).toEqual([]);
      live.capture.stop();
    }
  });

  it("respects pause and the per-site toggles, also when changed while open", async () => {
    const store = connectedStore({
      settings: { ...DEFAULT_SETTINGS, paused: true },
    });
    const page = chatPage("chatgpt", CHATGPT_HOME);
    const live = await start(page, store);
    await send(page, PRODUCT_PROMPT);
    expect(live.scored).toHaveLength(0);

    await saveSettings(store, DEFAULT_SETTINGS);
    await settle();
    await send(page, PRODUCT_PROMPT);
    expect(live.scored).toHaveLength(1);

    await saveSettings(store, {
      paused: false,
      sites: { claude: true, chatgpt: false },
    });
    await settle();
    await send(page, `${PRODUCT_PROMPT} Again.`);
    expect(live.scored).toHaveLength(1);

    // Turning ChatGPT off leaves Claude on.
    live.capture.stop();
    const claude = chatPage("claude", "https://claude.ai/new");
    const other = await start(claude, store);
    await send(claude, PRODUCT_PROMPT);
    expect(other.scored).toHaveLength(1);
    other.capture.stop();
  });

  it("drops a prompt that was waiting when capture was paused", async () => {
    const store = connectedStore();
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, store);
    page.busy(true);
    page.type(PRODUCT_PROMPT);
    page.enter();
    await saveSettings(store, { ...DEFAULT_SETTINGS, paused: true });
    page.busy(false);
    page.click();
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);
    expect(live.scored).toEqual([]);
    live.capture.stop();
  });

  it("reads missing or bad settings as capture on", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ paused: "yes", sites: { claude: false } })).toEqual({
      paused: false,
      sites: { claude: false, chatgpt: true },
    });
  });
});

describe("live capture: history", () => {
  it("keeps the last 20 scored prompts with their text, only in the browser", async () => {
    const store = connectedStore();
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, store);
    for (let i = 0; i < HISTORY_CAP + 3; i++) {
      await send(page, `${PRODUCT_PROMPT} Version ${i}.`);
    }
    const history = await readHistory(store);
    expect(history).toHaveLength(HISTORY_CAP);
    expect(history[0]).toMatchObject({
      id: "id-23",
      site: "claude",
      text: `${PRODUCT_PROMPT} Version 22.`,
      report: { source: "live" },
    });
    expect(history.at(-1)?.text).toBe(`${PRODUCT_PROMPT} Version 3.`);
    // The messages to the background worker carry reports, never text.
    for (const message of live.messages) {
      expect(JSON.stringify(message)).not.toContain("zebrafinch");
    }

    await disconnect(store);
    expect(store.data.liveHistory).toBeUndefined();
    live.capture.stop();
  });
});

describe("live capture end to end", () => {
  function withSender(responses: Array<() => Response>, store: Store) {
    const server = scriptedFetch(responses);
    const sender = createLiveSender({
      apiBase: TEST_API,
      fetch: server.fetch,
      store,
    });
    const route = (message: LiveMessage) =>
      message.type === LIVE_FLUSH_MESSAGE
        ? sender.flushIfDue()
        : sender.enqueue(message);
    const bodies = () =>
      server.requests.map(
        (request) => JSON.parse(request.body) as { reports: Report[] },
      );
    return { server, route, bodies };
  }

  it("sends 5 prompts from each site as reports only, with no prompt text", async () => {
    const store = connectedStore();
    const { server, route, bodies } = withSender(
      [() => Response.json({ received: 10, inserted: 10 })],
      store,
    );
    const prompts: string[] = [];
    for (const site of ["claude", "chatgpt"] as const) {
      const page = chatPage(
        site,
        site === "claude" ? "https://claude.ai/new" : CHATGPT_HOME,
      );
      const live = await start(page, store, route);
      for (let i = 0; i < 5; i++) {
        const text = `${PRODUCT_PROMPT} Step ${site}-${i} for the onboarding flow.`;
        prompts.push(text);
        await send(page, text);
      }
      live.capture.stop();
    }
    await vi.waitFor(() => expect(server.requests).toHaveLength(1));
    const [body] = bodies();
    expect(Object.keys(body)).toEqual(["reports"]);
    expect(body.reports).toHaveLength(10);
    expect(body.reports.map((report) => report.app)).toEqual([
      ...Array(5).fill("claude"),
      ...Array(5).fill("chatgpt"),
    ]);
    for (const report of body.reports) {
      expect(report.source).toBe("live");
      expect(report).not.toHaveProperty("import_key");
    }
    const raw = server.requests[0].body;
    for (const word of ["zebrafinch", "parents", "onboarding", "Step"]) {
      expect(raw).not.toContain(word);
    }
    for (const text of prompts) expect(raw).not.toContain(text);
  });

  it("sends a few prompts on the tab's timer once they are 3 minutes old", async () => {
    const store = connectedStore();
    const { server, route } = withSender(
      [() => Response.json({ received: 2, inserted: 2 })],
      store,
    );
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, store, route);
    await send(page, PRODUCT_PROMPT);
    await send(page, FOLLOW_UP);
    expect(server.requests).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(FLUSH_AGE_MS);
    expect(server.requests).toHaveLength(1);
    expect(store.data.liveQueue).toEqual([]);
    live.capture.stop();
  });

  it("stops capturing after a 401 and clears the history", async () => {
    const store = connectedStore();
    const { server, route } = withSender(
      [() => new Response(null, { status: 401 })],
      store,
    );
    const page = chatPage("chatgpt", CHATGPT_HOME);
    const live = await start(page, store, route);
    for (let i = 0; i < 10; i++) await send(page, `${PRODUCT_PROMPT} ${i}`);
    await vi.waitFor(() => expect(server.requests).toHaveLength(1));
    expect(store.data.deviceToken).toBeUndefined();
    expect(store.data.liveHistory).toBeUndefined();
    expect(store.data.liveQueue).toBeUndefined();

    await settle();
    await send(page, `${PRODUCT_PROMPT} After.`);
    expect(live.scored).toHaveLength(10);
    expect(server.requests).toHaveLength(1);
    live.capture.stop();
  });

  it("keeps the reports queued on a 429", async () => {
    const store = connectedStore();
    const { server, route } = withSender(
      [
        () =>
          new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
      ],
      store,
    );
    const page = chatPage("claude", "https://claude.ai/new");
    const live = await start(page, store, route);
    for (let i = 0; i < 10; i++) await send(page, `${PRODUCT_PROMPT} ${i}`);
    await vi.waitFor(() => expect(server.requests).toHaveLength(1));
    expect(store.data.liveQueue).toHaveLength(10);
    expect(store.data.deviceToken).toBe(TEST_TOKEN);
    live.capture.stop();
  });
});

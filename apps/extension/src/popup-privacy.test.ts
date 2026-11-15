// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { QUESTION_IDS, type Report } from "@triplekeel/schema";
import { createScorer } from "@triplekeel/scorer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteId } from "./adapters/index.js";
import {
  HISTORY_KEY,
  type HistoryEntry,
  QUEUE_KEY,
  SEND_STATE_KEY,
} from "./live-store.js";
import {
  captureText,
  mountPrivacy,
  SUMMARY_LENGTH,
  summarize,
} from "./popup-privacy.js";
import { buildLiveReport, knownQuestions } from "./reports.js";
import { readState, TOKEN_KEY } from "./session.js";
import {
  captureAllowed,
  DEFAULT_SETTINGS,
  readSettings,
  SETTINGS_KEY,
} from "./settings.js";
import { memoryStore, TEST_TOKEN } from "./test-utils.js";

// The real popup.html, so the test checks the IDs the code relies on.
const POPUP_HTML = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../popup.html"),
  "utf8",
);

const QUESTIONS = knownQuestions(
  QUESTION_IDS.map((id) => ({
    id,
    text: `Question ${id}`,
    area: "problem_discovery",
    polarity: "good" as const,
    answers: ["yes", "partly", "no", "n/a"],
  })),
);

// Distinct words, so a leak of a prompt into a report is easy to find.
const PROMPTS = {
  older: "Write a PRD for the zebrafinch checkout page for busy parents.",
  newer:
    "List the riskiest assumptions behind the marmoset onboarding flow, then plan an interview script to test each one with ten users.",
  html: "<img src=x onerror=alert(1)> Draft user stories for the <b>quokka</b> invoice screen.",
};

/** A real live report, made by the same scorer and builder as live capture. */
async function reportFor(text: string, site: SiteId, at: number) {
  const scorer = createScorer();
  await scorer.ready();
  const answers = await scorer.score(text, QUESTIONS, { followUp: false });
  return buildLiveReport(
    answers,
    "product-manager",
    site,
    new Date(at),
    text.length,
  );
}

async function entry(
  id: string,
  text: string,
  site: SiteId,
  scoredAt: number,
): Promise<HistoryEntry> {
  return {
    id,
    site,
    scoredAt,
    text,
    report: await reportFor(text, site, scoredAt),
  };
}

async function fixtures() {
  // Stored newest first, as addToHistory() keeps them.
  const history = [
    await entry(
      "id-html",
      PROMPTS.html,
      "claude",
      Date.UTC(2026, 10, 15, 9, 30),
    ),
    await entry(
      "id-newer",
      PROMPTS.newer,
      "chatgpt",
      Date.UTC(2026, 10, 15, 9, 0),
    ),
    await entry(
      "id-older",
      PROMPTS.older,
      "claude",
      Date.UTC(2026, 10, 14, 17, 0),
    ),
  ];
  const queue = [
    { id: "id-html", queuedAt: history[0].scoredAt, report: history[0].report },
  ];
  const sendState = {
    notBefore: 0,
    failures: 0,
    dropped: 0,
    rejected: 0,
    sentIds: ["id-newer"],
  };
  return { history, queue, sendState };
}

function connectedStore(extra: Record<string, unknown> = {}) {
  return memoryStore({
    [TOKEN_KEY]: TEST_TOKEN,
    me: { email: "user@example.com", track: null },
    ...extra,
  });
}

function mount(store: ReturnType<typeof memoryStore>) {
  const onDisconnected = vi.fn();
  const controls = mountPrivacy(document, {
    store,
    watchStore: store.watch,
    onDisconnected,
    formatTime: (ms) => new Date(ms).toISOString(),
  });
  return { controls, onDisconnected };
}

const byId = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

/** Lets storage callbacks and the redraw they cause finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function click(id: string) {
  byId(id).click();
  return settle();
}

beforeEach(() => {
  const parsed = new DOMParser().parseFromString(POPUP_HTML, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
});

describe("capture toggles", () => {
  it("show the default settings when nothing is stored", async () => {
    const { controls } = mount(connectedStore());
    await controls.ready;
    expect(byId<HTMLInputElement>("pause-all").checked).toBe(false);
    expect(byId<HTMLInputElement>("site-claude").checked).toBe(true);
    expect(byId<HTMLInputElement>("site-chatgpt").checked).toBe(true);
    expect(byId("capture-status").textContent).toBe(
      "On for claude.ai and chatgpt.com.",
    );
  });

  it("reflect stored settings", async () => {
    const store = connectedStore({
      [SETTINGS_KEY]: { paused: true, sites: { claude: false, chatgpt: true } },
    });
    const { controls } = mount(store);
    await controls.ready;
    expect(byId<HTMLInputElement>("pause-all").checked).toBe(true);
    expect(byId<HTMLInputElement>("site-claude").checked).toBe(false);
    expect(byId<HTMLInputElement>("site-chatgpt").checked).toBe(true);
    expect(byId("capture-status").textContent).toBe(
      "Paused. No prompts are captured.",
    );
  });

  it("follow a change made elsewhere", async () => {
    const store = connectedStore();
    const { controls } = mount(store);
    await controls.ready;
    await store.set({
      [SETTINGS_KEY]: {
        paused: false,
        sites: { claude: true, chatgpt: false },
      },
    });
    await settle();
    expect(byId<HTMLInputElement>("site-chatgpt").checked).toBe(false);
    expect(byId("capture-status").textContent).toBe("On for claude.ai only.");
  });

  it("Pause all saves the setting and stops capture on every site", async () => {
    const store = connectedStore();
    const changed: string[][] = [];
    store.watch((keys) => changed.push(keys));
    const { controls } = mount(store);
    await controls.ready;

    await click("pause-all");
    const paused = await readSettings(store);
    expect(paused).toEqual({ ...DEFAULT_SETTINGS, paused: true });
    expect(captureAllowed(paused, "claude")).toBe(false);
    expect(captureAllowed(paused, "chatgpt")).toBe(false);
    // Open tabs watch this key and stop capture when it changes.
    expect(changed).toContainEqual([SETTINGS_KEY]);

    await click("pause-all");
    const resumed = await readSettings(store);
    expect(captureAllowed(resumed, "claude")).toBe(true);
    expect(captureAllowed(resumed, "chatgpt")).toBe(true);
  });

  it("a site toggle turns capture off on that site only", async () => {
    const store = connectedStore();
    const { controls } = mount(store);
    await controls.ready;

    await click("site-claude");
    const settings = await readSettings(store);
    expect(settings).toEqual({
      paused: false,
      sites: { claude: false, chatgpt: true },
    });
    expect(captureAllowed(settings, "claude")).toBe(false);
    expect(captureAllowed(settings, "chatgpt")).toBe(true);
    expect(byId("capture-status").textContent).toBe("On for chatgpt.com only.");

    await click("site-chatgpt");
    expect((await readSettings(store)).sites).toEqual({
      claude: false,
      chatgpt: false,
    });
    expect(byId("capture-status").textContent).toBe(
      "Off on both sites. No prompts are captured.",
    );
  });

  it("are labelled checkboxes", () => {
    for (const id of ["pause-all", "site-claude", "site-chatgpt"]) {
      const input = byId<HTMLInputElement>(id);
      expect(input.type).toBe("checkbox");
      expect(input.labels?.[0]?.textContent?.trim()).toBeTruthy();
    }
  });
});

describe("what was sent", () => {
  async function mountWithHistory() {
    const data = await fixtures();
    const store = connectedStore({
      [HISTORY_KEY]: data.history,
      [QUEUE_KEY]: data.queue,
      [SEND_STATE_KEY]: data.sendState,
    });
    const { controls } = mount(store);
    await controls.ready;
    const items = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("#history > li > details"),
    );
    return { ...data, store, items };
  }

  it("shows a short explanation when nothing was scored", async () => {
    const { controls } = mount(connectedStore());
    await controls.ready;
    expect(byId("history").hidden).toBe(true);
    expect(byId("history").children).toHaveLength(0);
    expect(byId("history-empty").hidden).toBe(false);
    expect(byId("history-empty").textContent).toContain("Nothing scored yet.");
    expect(byId("clear-history").hidden).toBe(true);
  });

  it("says that only reports leave the browser", () => {
    expect(byId("sent").textContent).toContain(
      "Your prompt text never leaves this browser.",
    );
  });

  it("lists prompts newest first, with status, site and time in words", async () => {
    const { items, history } = await mountWithHistory();
    expect(byId("history-empty").hidden).toBe(true);
    expect(items.map((item) => item.dataset.id)).toEqual([
      "id-html",
      "id-newer",
      "id-older",
    ]);
    const meta = items.map(
      (item) => item.querySelector(".item-meta")?.textContent,
    );
    expect(meta).toEqual([
      `Waiting to send · claude.ai · ${new Date(history[0].scoredAt).toISOString()}`,
      `Sent · chatgpt.com · ${new Date(history[1].scoredAt).toISOString()}`,
      `Not sent · claude.ai · ${new Date(history[2].scoredAt).toISOString()}`,
    ]);
    expect(items[0].querySelector("time")?.dateTime).toBe(
      new Date(history[0].scoredAt).toISOString(),
    );
    // Closed by default, so the list stays short.
    expect(items.every((item) => !item.open)).toBe(true);
  });

  it("sorts by time even if the stored order is off", async () => {
    const data = await fixtures();
    const store = connectedStore({
      [HISTORY_KEY]: [...data.history].reverse(),
    });
    const { controls } = mount(store);
    await controls.ready;
    const ids = Array.from(
      document.querySelectorAll<HTMLDetailsElement>("#history details"),
      (item) => item.dataset.id,
    );
    expect(ids).toEqual(["id-html", "id-newer", "id-older"]);
  });

  it("cuts long prompts short in the summary and shows them in full inside", async () => {
    const { items } = await mountWithHistory();
    const newer = items[1];
    const summary = newer.querySelector(".item-summary")?.textContent ?? "";
    expect(PROMPTS.newer.length).toBeGreaterThan(SUMMARY_LENGTH);
    expect(summary.endsWith("…")).toBe(true);
    expect(Array.from(summary)).toHaveLength(SUMMARY_LENGTH);
    expect(newer.querySelector(".item-prompt")?.textContent).toBe(
      PROMPTS.newer,
    );
  });

  it("renders prompt text with HTML in it as text, not markup", async () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const { items } = await mountWithHistory();
    const html = items[0];
    expect(document.querySelector("#history img")).toBeNull();
    expect(document.querySelector("#history b")).toBeNull();
    expect(html.querySelector(".item-prompt")?.textContent).toBe(PROMPTS.html);
    expect(html.querySelector(".item-prompt")?.children).toHaveLength(0);
    expect(html.querySelector(".item-summary")?.textContent).toBe(
      summarize(PROMPTS.html),
    );
    await settle();
    expect(alert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows each report exactly as stored, and the report has no prompt text", async () => {
    const { items, history } = await mountWithHistory();
    for (const [index, item] of items.entries()) {
      const pre = item.querySelector("pre.item-report");
      const json = pre?.textContent ?? "";
      const stored = history[index];
      expect(json).toBe(JSON.stringify(stored.report, null, 2));
      expect(JSON.parse(json) as Report).toEqual(stored.report);
      // The privacy promise: nothing of the prompt is in what is sent.
      expect(json).not.toContain(stored.text);
      for (const word of ["zebrafinch", "marmoset", "quokka", "onerror"]) {
        expect(json).not.toContain(word);
      }
      expect(pre?.getAttribute("tabindex")).toBe("0");
    }
  });

  it("updates a status in place and keeps an open item open", async () => {
    const { store, items, sendState } = await mountWithHistory();
    items[0].open = true;
    await store.set({
      [QUEUE_KEY]: [],
      [SEND_STATE_KEY]: { ...sendState, sentIds: ["id-html", "id-newer"] },
    });
    await settle();
    const first =
      document.querySelector<HTMLDetailsElement>("#history details");
    expect(first).toBe(items[0]);
    expect(first?.open).toBe(true);
    expect(first?.querySelector(".item-status")?.textContent).toBe("Sent");
    expect(first?.querySelector(".report-label")?.textContent).toBe(
      "The report that was sent",
    );
  });

  it("Clear history deletes the history but not the queued reports", async () => {
    const { store, queue } = await mountWithHistory();
    await click("clear-history");
    expect(store.data[HISTORY_KEY]).toBeUndefined();
    expect(store.data[QUEUE_KEY]).toEqual(queue);
    expect(byId("history").children).toHaveLength(0);
    expect(byId("history-empty").hidden).toBe(false);
    expect(byId("clear-history").hidden).toBe(true);
  });
});

describe("Disconnect", () => {
  async function mountConnected() {
    const data = await fixtures();
    const store = connectedStore({
      [HISTORY_KEY]: data.history,
      [QUEUE_KEY]: data.queue,
      [SEND_STATE_KEY]: data.sendState,
      [SETTINGS_KEY]: { paused: true, sites: { claude: true, chatgpt: true } },
    });
    const mounted = mount(store);
    await mounted.controls.ready;
    return { store, ...mounted };
  }

  it("asks first, inline, and Cancel keeps everything", async () => {
    const { store, onDisconnected } = await mountConnected();
    expect(byId("disconnect-confirm").hidden).toBe(true);

    await click("disconnect");
    expect(byId("disconnect-confirm").hidden).toBe(false);
    expect(byId("disconnect").hidden).toBe(true);
    expect(document.activeElement).toBe(byId("disconnect-no"));
    expect(store.data[TOKEN_KEY]).toBe(TEST_TOKEN);

    await click("disconnect-no");
    expect(byId("disconnect-confirm").hidden).toBe(true);
    expect(byId("disconnect").hidden).toBe(false);
    expect(document.activeElement).toBe(byId("disconnect"));
    expect(store.data[TOKEN_KEY]).toBe(TEST_TOKEN);
    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it("Escape cancels the question", async () => {
    const { store } = await mountConnected();
    await click("disconnect");
    byId("disconnect-no").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(byId("disconnect-confirm").hidden).toBe(true);
    expect(store.data[TOKEN_KEY]).toBe(TEST_TOKEN);
  });

  it("clears the token, queue, history and send state once confirmed", async () => {
    const { store, onDisconnected } = await mountConnected();
    await click("disconnect");
    await click("disconnect-yes");

    expect(await readState(store)).toEqual({ connected: false });
    for (const key of [TOKEN_KEY, HISTORY_KEY, QUEUE_KEY, SEND_STATE_KEY]) {
      expect(store.data[key]).toBeUndefined();
    }
    // The user's capture choices stay for the next connect.
    expect((await readSettings(store)).paused).toBe(true);
    expect(onDisconnected).toHaveBeenCalledOnce();
    expect(byId("history").children).toHaveLength(0);
    expect(byId("disconnect-confirm").hidden).toBe(true);
  });
});

describe("helpers", () => {
  it("summarize keeps short text and collapses whitespace", () => {
    expect(summarize("  fix\n\nit  ")).toBe("fix it");
    expect(summarize("abcdef", 4)).toBe("abc…");
  });

  it("captureText says what the toggles do", () => {
    expect(captureText(DEFAULT_SETTINGS)).toBe(
      "On for claude.ai and chatgpt.com.",
    );
    expect(
      captureText({ paused: true, sites: { claude: false, chatgpt: false } }),
    ).toBe("Paused. No prompts are captured.");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyCard, fullCard, keepItem, olderCard } from "./fixtures";
import { EMPTY_TEXT } from "./format";
import { BUTTON_TEXT } from "./get-keel-check-button";
import { KeelCheckCardView, SourceLine } from "./keel-check-card";
import { KeelCheckHistory } from "./keel-check-history";
import {
  INTRO_TEXT,
  KeelCheckPanel,
  LOAD_FAILED_TEXT,
} from "./keel-check-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/** The visible and screen reader text, with tags removed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const count = (html: string, pattern: RegExp) =>
  [...html.matchAll(pattern)].length;

describe("KeelCheckCardView", () => {
  const html = renderToStaticMarkup(<KeelCheckCardView card={fullCard} />);
  const text = textOf(html);

  it("labels the items in words, in order", () => {
    const labels = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map(
      (match) => match[1],
    );
    expect(labels).toEqual(["Keep doing", "Stop doing", "Test"]);
  });

  it("phrases each item from its counts", () => {
    expect(text).toContain(
      "You set a success metric in 12 of your last 18 prompts.",
    );
    expect(text).toContain(
      "You accepted output without checking it in 4 of your last 15 prompts, and partly in 2 more.",
    );
    expect(text).toContain(
      "Your biggest gap: Problem discovery and user research (junior → to mid). Try this:",
    );
  });

  it("shows each why line and source", () => {
    expect(text).toContain("Shows how to tie a feature to one number.");
    expect(text).toContain(
      "Lenny's Podcast · How to pick one metric (opens in a new tab) · 12 Oct 2026 · Podcast at 16:15",
    );
    expect(text).toContain(
      "Review AI output in two minutes (opens in a new tab) · 3 Nov 2026 · Article",
    );
    expect(text).toContain("1 Sep 2026 · Podcast at 1:02:05");
  });

  it("renders no reply buttons yet", () => {
    expect(html).not.toContain("<button");
    expect(html).not.toContain("keel-check-replies");
  });

  it("renders replies in the slot when given", () => {
    const withReplies = renderToStaticMarkup(
      <KeelCheckCardView
        card={fullCard}
        renderReplies={(item) => <span>Reply to {item.kind}</span>}
      />,
    );
    expect(count(withReplies, /data-slot="keel-check-replies"/g)).toBe(3);
    expect(textOf(withReplies)).toContain("Reply to stop");
  });

  it("shows the empty state for a card without items", () => {
    const empty = renderToStaticMarkup(<KeelCheckCardView card={emptyCard} />);
    expect(textOf(empty)).toBe(EMPTY_TEXT);
  });
});

describe("SourceLine", () => {
  it("opens the source in a new tab without an opener", () => {
    const html = renderToStaticMarkup(<SourceLine pick={keepItem.pick} />);
    const link = html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="https://example.com/metrics"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
  });

  it("doesn't link a URL that isn't a web page", () => {
    const html = renderToStaticMarkup(
      <SourceLine pick={{ ...keepItem.pick, url: "javascript:alert(1)" }} />,
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("javascript:");
    expect(textOf(html)).toContain("How to pick one metric");
  });
});

describe("KeelCheckHistory", () => {
  it("lists earlier cards, newest first, with their items", () => {
    const html = renderToStaticMarkup(
      <KeelCheckHistory cards={[emptyCard, olderCard]} />,
    );
    const summaries = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map(
      (match) => textOf(match[1]),
    );
    expect(summaries).toEqual([
      "14 Nov 2026 Not enough evidence",
      "10 Nov 2026 Test",
    ]);
    expect(count(html, /<details/g)).toBe(2);
    expect(html).toContain("<h4");
    expect(html).not.toContain("<button");
  });

  it("renders nothing without earlier cards", () => {
    expect(renderToStaticMarkup(<KeelCheckHistory cards={[]} />)).toBe("");
  });
});

describe("KeelCheckPanel", () => {
  it("shows the latest card, the button and earlier cards", () => {
    const html = renderToStaticMarkup(
      <KeelCheckPanel
        history={{ status: "ok", cards: [fullCard, emptyCard, olderCard] }}
        totalPrompts={40}
      />,
    );
    const text = textOf(html);
    expect(text).toContain("What to keep, stop and test");
    expect(text).toContain("From 15 Nov 2026");
    expect(text).toContain(BUTTON_TEXT);
    expect(text).toContain("Earlier keel checks");
    // Only the Get my keel check button. No reply buttons yet.
    expect(count(html, /<button/g)).toBe(1);
    expect(count(html, /<details/g)).toBe(2);
  });

  it("shows the empty state for an empty latest card", () => {
    const html = renderToStaticMarkup(
      <KeelCheckPanel
        history={{ status: "ok", cards: [emptyCard] }}
        totalPrompts={40}
      />,
    );
    expect(textOf(html)).toContain(EMPTY_TEXT);
    expect(html).not.toContain("Earlier keel checks");
  });

  it("before the first card, shows the empty state with few prompts", () => {
    const few = renderToStaticMarkup(
      <KeelCheckPanel history={{ status: "ok", cards: [] }} totalPrompts={3} />,
    );
    expect(textOf(few)).toContain(EMPTY_TEXT);
    expect(textOf(few)).toContain(BUTTON_TEXT);

    const enough = renderToStaticMarkup(
      <KeelCheckPanel
        history={{ status: "ok", cards: [] }}
        totalPrompts={12}
      />,
    );
    expect(textOf(enough)).toContain(INTRO_TEXT);
    expect(textOf(enough)).not.toContain("From ");
  });

  it("says when cards couldn't load and keeps the button", () => {
    const html = renderToStaticMarkup(
      <KeelCheckPanel history={{ status: "failed" }} totalPrompts={40} />,
    );
    expect(textOf(html)).toContain(LOAD_FAILED_TEXT);
    expect(textOf(html)).toContain(BUTTON_TEXT);
  });
});

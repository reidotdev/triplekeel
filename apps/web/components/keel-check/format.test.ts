import { describe, expect, it } from "vitest";
import type { KeelCheckItem } from "../../src/lib/keel-check";
import { keepItem, stopItem, testItem } from "./fixtures";
import {
  formatDate,
  formatTimestamp,
  isWebUrl,
  itemsSummary,
  itemText,
  keepStopText,
  sourceParts,
  testText,
} from "./format";

type KeepOrStop = Extract<KeelCheckItem, { kind: "keep" | "stop" }>;
type TestItem = Extract<KeelCheckItem, { kind: "test" }>;

const keep = keepItem as KeepOrStop;
const stop = stopItem as KeepOrStop;
const test = testItem as TestItem;

describe("keepStopText", () => {
  it("builds Keep from the card label and counts", () => {
    expect(keepStopText(keep)).toBe(
      "You set a success metric in 12 of your last 18 prompts.",
    );
  });

  it("mentions partly answers", () => {
    expect(keepStopText(stop)).toBe(
      "You accepted output without checking it in 4 of your last 15 prompts, and partly in 2 more.",
    );
  });

  it("falls back to the area name without a card label", () => {
    expect(keepStopText({ ...keep, card_label: null })).toBe(
      "Metrics and experiments: a good habit in 12 of your last 18 prompts.",
    );
    expect(keepStopText({ ...stop, card_label: "  " })).toBe(
      "Working with AI agents day to day: a habit to drop in 4 of your last 15 prompts, and partly in 2 more.",
    );
  });

  it("uses the singular for one prompt", () => {
    expect(
      keepStopText({
        ...keep,
        counts: { yes: 1, partly: 0, no: 0, answered: 1, window: 1 },
      }),
    ).toBe("You set a success metric in 1 of your last 1 prompt.");
  });
});

describe("testText", () => {
  it("names the biggest gap", () => {
    expect(testText(test)).toBe(
      "Your biggest gap: Problem discovery and user research (junior → mid). Try this:",
    );
  });

  it("names the lowest-scoring area at the target or without one", () => {
    const atTarget = { level: "mid", target_level: "mid", gap: 0, score: 1.2 };
    const noTarget = { level: "mid", target_level: null, gap: null, score: 1 };
    for (const level of [atTarget, noTarget] as TestItem["level"][]) {
      expect(testText({ ...test, level })).toBe(
        "Your lowest-scoring area: Problem discovery and user research (mid). Try this:",
      );
    }
  });

  it("uses the counts for a new user without a level", () => {
    expect(
      testText({ ...test, level: null, counts: { prompts: 3, window: 4 } }),
    ).toBe(
      "Your weakest area so far is Problem discovery and user research, based on 3 of your last 4 prompts. Try this:",
    );
  });
});

describe("itemText", () => {
  it("picks the sentence for each kind", () => {
    expect(itemText(keepItem)).toBe(keepStopText(keep));
    expect(itemText(testItem)).toBe(testText(test));
  });
});

describe("formatDate", () => {
  it("shows the day, short month and year in UTC", () => {
    expect(formatDate("2026-10-12T09:00:00+00:00")).toBe("12 Oct 2026");
    expect(formatDate("2026-09-01T00:00:00Z")).toBe("1 Sep 2026");
    // Late on 31 Dec in New York is already 1 Jan in UTC.
    expect(formatDate("2026-12-31T23:30:00-05:00")).toBe("1 Jan 2027");
  });

  it("returns null for a value that isn't a date", () => {
    expect(formatDate("soon")).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("uses m:ss under an hour and h:mm:ss from an hour", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(975)).toBe("16:15");
    expect(formatTimestamp(3599)).toBe("59:59");
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3725)).toBe("1:02:05");
  });
});

describe("sourceParts", () => {
  it("puts the publisher before the title and the date and kind after", () => {
    expect(sourceParts(keepItem.pick)).toEqual({
      before: ["Lenny's Podcast"],
      after: ["12 Oct 2026", "Podcast at 16:15"],
    });
  });

  it("leaves out a missing publisher and calls a web pick an article", () => {
    expect(sourceParts(stopItem.pick)).toEqual({
      before: [],
      after: ["3 Nov 2026", "Article"],
    });
  });

  it("says Podcast without a timestamp", () => {
    expect(
      sourceParts({ ...keepItem.pick, podcast_timestamp_seconds: null }).after,
    ).toEqual(["12 Oct 2026", "Podcast"]);
  });
});

describe("itemsSummary", () => {
  it("lists the labels, or says there wasn't enough evidence", () => {
    expect(itemsSummary([keepItem, stopItem, testItem])).toBe(
      "Keep doing, Stop doing, Test",
    );
    expect(itemsSummary([])).toBe("Not enough evidence");
  });
});

describe("isWebUrl", () => {
  it("allows only http and https links", () => {
    expect(isWebUrl("https://example.com/a")).toBe(true);
    expect(isWebUrl("http://example.com/a")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("not a url")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  clockSeconds,
  findHighlightTimestamp,
  parseTurns,
  podcastShow,
} from "./transcript.ts";

const transcript = `# 90 minutes of unfiltered product advice

- **Podcast:** [Lenny's Podcast: Product - Growth - Career](https://exa.ai/library/podcast/hww2k2by27y)
- **Published:** 2026-09-20T07:00:00+00:00
- **Duration:** 96:52.767

## Transcript

**Lenny Rachitsky · 00:00.031–00:23.365**

Welcome to the show. Today we talk about how product teams run discovery.

**Peter Sellis · 00:23.400–12:34.567**

The best teams I know talk to a customer every single week, and they write down
the problem before they talk about any solution at all.

**Lenny Rachitsky · 12:34.600–61:05.250**

So how do you keep that habit going when the roadmap is full?

**Peter Sellis · 61:05.300–96:52.767**

You put the interviews on the calendar first and protect them like a launch.
Everything else fits around them.
`;

describe("clockSeconds", () => {
  it("reads minutes past 60 without hours", () => {
    expect(clockSeconds("96:52.767")).toBe(5812);
    expect(clockSeconds("00:23.400")).toBe(23);
  });

  it("also reads h:mm:ss", () => {
    expect(clockSeconds("1:01:05.300")).toBe(3665);
  });

  it("rejects garbage", () => {
    expect(clockSeconds("abc")).toBeNull();
    expect(clockSeconds("12")).toBeNull();
  });
});

describe("parseTurns", () => {
  it("finds every turn marker", () => {
    expect(parseTurns(transcript).map((turn) => turn.startSeconds)).toEqual([
      0, 23, 754, 3665,
    ]);
  });
});

describe("findHighlightTimestamp", () => {
  it("takes the start of the turn that holds the highlight", () => {
    expect(
      findHighlightTimestamp(
        transcript,
        "talk to a customer every single week, and they write down the problem",
      ),
    ).toBe(23);
  });

  it("handles episodes longer than an hour", () => {
    expect(
      findHighlightTimestamp(
        transcript,
        "You put the interviews on the calendar first and protect them like a launch.",
      ),
    ).toBe(3665);
  });

  it("matches across line breaks and extra spaces", () => {
    expect(
      findHighlightTimestamp(
        transcript,
        "and they write   down\nthe problem before they talk about any solution",
      ),
    ).toBe(23);
  });

  it("uses the turn a highlight starts in when it spans turns", () => {
    const highlight =
      "write down the problem before they talk about any solution at all. **Lenny Rachitsky · 12:34.600–61:05.250** So how do you keep that habit going";
    expect(findHighlightTimestamp(transcript, highlight)).toBe(23);
  });

  it("uses the first marker when a highlight starts at a turn", () => {
    const highlight =
      "**Peter Sellis · 61:05.300–96:52.767** You put the interviews on the calendar first";
    expect(findHighlightTimestamp(transcript, highlight)).toBe(3665);
  });

  it("finds a highlight whose end was trimmed", () => {
    expect(
      findHighlightTimestamp(
        transcript,
        "So how do you keep that habit going when the roadmap is full? and some words that are not in the transcript at all, added by the highlighter...",
      ),
    ).toBe(754);
  });

  it("returns null when the highlight isn't in the transcript", () => {
    expect(
      findHighlightTimestamp(transcript, "Nothing like this was ever said."),
    ).toBeNull();
    expect(
      findHighlightTimestamp("No turns here.", "No turns here."),
    ).toBeNull();
  });

  it("returns null for text in the header, before any turn", () => {
    expect(
      findHighlightTimestamp(
        transcript,
        "90 minutes of unfiltered product advice",
      ),
    ).toBeNull();
  });
});

describe("podcastShow", () => {
  it("reads the show name from the header", () => {
    expect(podcastShow(transcript)).toBe(
      "Lenny's Podcast: Product - Growth - Career",
    );
    expect(podcastShow("- **Podcast:** Insights Unlocked\n")).toBe(
      "Insights Unlocked",
    );
    expect(podcastShow(undefined)).toBeNull();
  });
});

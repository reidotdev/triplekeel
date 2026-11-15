import { describe, expect, it } from "vitest";
import { dedupeCandidates, toCandidates, urlKey } from "./candidates.ts";
import type { Candidate } from "./types.ts";

const window = {
  start: new Date("2026-08-17T00:00:00Z"),
  end: new Date("2026-11-15T00:00:00Z"),
};

function candidate(url: string, title: string, source = "web"): Candidate {
  return {
    url,
    title,
    source: source as Candidate["source"],
    publisher: null,
    publishedAt: "2026-10-01T00:00:00.000Z",
    highlight: "",
  };
}

describe("urlKey", () => {
  it("ignores www, tracking parameters, fragments and a final slash", () => {
    expect(urlKey("https://www.Example.com/post/?utm_source=x#top")).toBe(
      urlKey("https://example.com/post"),
    );
    expect(urlKey("https://example.com/post?id=2")).not.toBe(
      urlKey("https://example.com/post?id=3"),
    );
  });

  it("rejects non-web URLs", () => {
    expect(urlKey("javascript:alert(1)")).toBeNull();
    expect(urlKey("not a url")).toBeNull();
  });
});

describe("dedupeCandidates", () => {
  it("keeps the first of repeated URLs and titles", () => {
    const kept = dedupeCandidates([
      candidate(
        "https://exa.ai/library/podcast/a/episode/1",
        "Run discovery weekly",
        "podcast",
      ),
      candidate("https://www.example.com/a/", "Another post"),
      candidate("https://example.com/a?utm_medium=email", "Same post again"),
      candidate("https://youtube.com/watch?v=1", "Run Discovery Weekly!"),
      candidate("https://example.com/b", "A third post"),
    ]);
    expect(kept.map((c) => c.url)).toEqual([
      "https://exa.ai/library/podcast/a/episode/1",
      "https://www.example.com/a/",
      "https://example.com/b",
    ]);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      candidate(`https://example.com/${i}`, `Post ${i}`),
    );
    expect(dedupeCandidates(many, 20)).toHaveLength(20);
  });
});

describe("toCandidates", () => {
  it("keeps only dated results inside the window", () => {
    const kept = toCandidates(
      [
        {
          url: "https://example.com/new",
          title: "New",
          publishedDate: "2026-10-01T00:00:00.000Z",
          highlights: ["a", "b"],
        },
        {
          url: "https://example.com/old",
          title: "Old",
          publishedDate: "2026-01-01T00:00:00.000Z",
        },
        { url: "https://example.com/undated", title: "Undated" },
        {
          url: "https://example.com/bad-date",
          title: "Bad",
          publishedDate: "soon",
        },
        {
          url: "https://example.com/untitled",
          title: "  ",
          publishedDate: "2026-10-01T00:00:00.000Z",
        },
        {
          url: "ftp://example.com/file",
          title: "FTP",
          publishedDate: "2026-10-01T00:00:00.000Z",
        },
      ],
      "web",
      window,
    );
    expect(kept).toEqual([
      {
        url: "https://example.com/new",
        title: "New",
        source: "web",
        publisher: "example.com",
        publishedAt: "2026-10-01T00:00:00.000Z",
        highlight: "a b",
      },
    ]);
  });

  it("reads the show name for podcasts", () => {
    const [episode] = toCandidates(
      [
        {
          url: "https://exa.ai/library/podcast/x/episode/y",
          title: "Episode",
          publishedDate: "2026-10-12T07:00:00.000Z",
          text: "# Episode\n\n- **Podcast:** [Insights Unlocked](https://exa.ai/library/podcast/x)\n",
        },
      ],
      "podcast",
      window,
    );
    expect(episode?.publisher).toBe("Insights Unlocked");
  });
});

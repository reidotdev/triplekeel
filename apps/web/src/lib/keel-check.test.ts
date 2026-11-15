import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isKeelCheckCard,
  type KeelCheckCard,
  readLatestKeelCheck,
  secondsUntilUtcMidnight,
} from "./keel-check";

const CARD: KeelCheckCard = {
  id: "7facc855-67ef-4055-bd3c-40788370f6a8",
  track_id: "product-manager",
  created_at: "2026-11-15T08:00:00+00:00",
  items: [
    {
      kind: "test",
      status: "open",
      area_id: "metrics",
      area_name: "Metrics and experiments",
      question_id: null,
      card_label: null,
      counts: { prompts: 3, window: 3 },
      level: null,
      pick_id: "00000000-0000-0000-0000-000000000101",
      pick: {
        title: "Metrics podcast",
        url: "https://example.com/metrics",
        publisher: null,
        published_at: "2026-11-01T00:00:00+00:00",
        podcast_timestamp_seconds: 60,
        source: "podcast",
        why_line: "Shows how to pick one success metric.",
      },
    },
  ],
};

function mockNudges(result: { data?: unknown; error?: { code: string } }) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readLatestKeelCheck", () => {
  it("reads the newest card through row level security", async () => {
    const supabase = mockNudges({ data: CARD });
    expect(await readLatestKeelCheck(supabase.client)).toEqual({
      status: "ok",
      card: CARD,
    });
    expect(supabase.from).toHaveBeenCalledWith("nudges");
    expect(supabase.query.select).toHaveBeenCalledWith(
      "id, track_id, created_at, items",
    );
    expect(supabase.query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(supabase.query.limit).toHaveBeenCalledWith(1);
  });

  it("returns null before the first card", async () => {
    const supabase = mockNudges({ data: null });
    expect(await readLatestKeelCheck(supabase.client)).toEqual({
      status: "ok",
      card: null,
    });
  });

  it("fails on an error or a bad row and logs only the code", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args.join(" "));
    });
    expect(
      await readLatestKeelCheck(
        mockNudges({ error: { code: "42501" } }).client,
      ),
    ).toEqual({ status: "failed" });
    expect(
      await readLatestKeelCheck(
        mockNudges({ data: { ...CARD, items: "nope" } }).client,
      ),
    ).toEqual({ status: "failed" });
    expect(logged).toEqual([
      "Keel check read failed 42501",
      "Keel check read failed bad_result",
    ]);
  });
});

describe("isKeelCheckCard", () => {
  it("accepts a card and rejects a wrong item", () => {
    expect(isKeelCheckCard(CARD)).toBe(true);
    expect(isKeelCheckCard({ ...CARD, items: [] })).toBe(true);
    const [item] = CARD.items;
    for (const bad of [
      { ...item, kind: "maybe" },
      { ...item, question_id: "success_metric" },
      { ...item, counts: { prompts: -1, window: 3 } },
      { ...item, pick: { ...item.pick, source: "video" } },
      { ...item, pick: { ...item.pick, published_at: undefined } },
    ]) {
      expect(isKeelCheckCard({ ...CARD, items: [bad] })).toBe(false);
    }
  });
});

describe("secondsUntilUtcMidnight", () => {
  it("counts down to the next UTC day", () => {
    expect(secondsUntilUtcMidnight(new Date("2026-11-15T23:00:00Z"))).toBe(
      3600,
    );
    expect(secondsUntilUtcMidnight(new Date("2026-11-15T00:00:00Z"))).toBe(
      86400,
    );
  });
});

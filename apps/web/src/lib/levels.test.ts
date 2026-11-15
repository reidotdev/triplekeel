import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type LevelGap, openGaps, readLevelGaps } from "./levels";

const rows: LevelGap[] = [
  {
    rank: 2,
    area_id: "specs",
    area_name: "Writing specs and PRDs",
    level: "mid",
    target_level: "senior",
    gap: 1,
    score: 1.5,
    confidence: 0.5,
    n_prompts: 5,
  },
  {
    rank: 3,
    area_id: "strategy",
    area_name: "Product strategy",
    level: null,
    target_level: "senior",
    gap: null,
    score: null,
    confidence: null,
    n_prompts: null,
  },
  {
    rank: 1,
    area_id: "problem_discovery",
    area_name: "Problem discovery and user research",
    level: "junior",
    target_level: "senior",
    gap: 2,
    score: 0.8438,
    confidence: 0.41,
    n_prompts: 6,
  },
];

function mockSupabase(result: { data?: unknown; error?: { code: string } }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readLevelGaps", () => {
  it("calls read_level_gaps and returns rows in rank order", async () => {
    const supabase = mockSupabase({ data: rows });
    const result = await readLevelGaps(supabase.client);

    expect(supabase.rpc).toHaveBeenCalledWith("read_level_gaps");
    expect(result?.map((row) => row.area_id)).toEqual([
      "problem_discovery",
      "specs",
      "strategy",
    ]);
  });

  it("returns an empty list for a user without a track", async () => {
    const supabase = mockSupabase({ data: [] });
    expect(await readLevelGaps(supabase.client)).toEqual([]);
  });

  it("logs only the error code when the read fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({ error: { code: "42501" } });

    expect(await readLevelGaps(supabase.client)).toBeNull();
    expect(log).toHaveBeenCalledWith("Level read failed", "42501");
  });

  it("rejects rows of the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({
      data: [{ ...rows[0], level: "expert" }],
    });
    expect(await readLevelGaps(supabase.client)).toBeNull();
  });
});

describe("openGaps", () => {
  it("keeps only areas below the target", () => {
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    expect(
      openGaps([...sorted, { ...rows[0], area_id: "metrics", gap: 0 }]).map(
        (row) => row.area_id,
      ),
    ).toEqual(["problem_discovery", "specs"]);
  });
});

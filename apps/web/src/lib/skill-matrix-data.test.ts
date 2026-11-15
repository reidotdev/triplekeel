import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LevelGap } from "./levels";
import { loadSkillMatrix, type SkillMatrixProfile } from "./skill-matrix-data";
import type { TrackSummary } from "./tracks";

const profile: SkillMatrixProfile = {
  user_id: "user_1",
  job_title: "Senior PM, Growth",
  track_id: "product_manager",
  current_level: "mid",
  target_level: "senior",
};

const catalog: TrackSummary[] = [
  { id: "product_manager", name: "Product manager", altTitles: ["PM"] },
];

const pm = { junior: 0, mid: 1, senior: 2 };

const areas = [
  { id: "problem_discovery", thresholds: pm },
  { id: "specs", thresholds: { junior: 0, mid: 1.2, senior: 2.4 } },
  { id: "strategy", thresholds: pm },
];

// Rank order: problem_discovery, specs, strategy. Shuffled on purpose.
const gaps: LevelGap[] = [
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

type Result = { data?: unknown; count?: number | null; error?: unknown };

/** A query builder: chainable select/eq, and awaitable for the result. */
function query(result: Result) {
  const promise = Promise.resolve({
    data: result.data ?? null,
    count: result.count ?? null,
    error: result.error ?? null,
  });
  const builder = Object.assign(promise, { select: vi.fn(), eq: vi.fn() });
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function mockSupabase(results: {
  gaps?: Result;
  areas?: Result;
  signals?: Result;
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: results.gaps?.data ?? null,
    error: results.gaps?.error ?? null,
  });
  const skillAreas = query(results.areas ?? { data: areas });
  const signals = query(results.signals ?? { count: 0 });
  const from = vi.fn((table: string) => {
    if (table === "skill_areas") return skillAreas;
    if (table === "signals") return signals;
    throw new Error(`unexpected table ${table}`);
  });
  return {
    client: { rpc, from } as unknown as SupabaseClient,
    rpc,
    skillAreas,
    signals,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSkillMatrix", () => {
  it("returns the empty state for a user without reports", async () => {
    const supabase = mockSupabase({
      gaps: { data: gaps.map((row) => ({ ...row, level: null })) },
      signals: { count: 0 },
    });

    expect(await loadSkillMatrix(supabase.client, profile, catalog)).toEqual({
      kind: "empty",
      trackName: "Product manager",
      currentLevel: "mid",
      targetLevel: "senior",
    });
  });

  it("counts only the user's reports on their track, without reading rows", async () => {
    const supabase = mockSupabase({ gaps: { data: gaps } });
    await loadSkillMatrix(supabase.client, profile, catalog);

    expect(supabase.rpc).toHaveBeenCalledWith("read_level_gaps");
    expect(supabase.signals.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(supabase.signals.eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(supabase.signals.eq).toHaveBeenCalledWith(
      "track_id",
      "product_manager",
    );
    expect(supabase.skillAreas.select).toHaveBeenCalledWith("id, thresholds");
    expect(supabase.skillAreas.eq).toHaveBeenCalledWith(
      "track_id",
      "product_manager",
    );
  });

  it("maps levels to the view model in the database order", async () => {
    const supabase = mockSupabase({
      gaps: { data: gaps },
      signals: { count: 12 },
    });
    const data = await loadSkillMatrix(supabase.client, profile, catalog);

    expect(data?.kind).toBe("levels");
    if (data?.kind !== "levels") return;
    expect(data.trackName).toBe("Product manager");
    expect(data.currentLevel).toBe("mid");
    expect(data.targetLevel).toBe("senior");
    expect(data.totalPrompts).toBe(12);
    expect(data.areas.map((area) => area.id)).toEqual([
      "problem_discovery",
      "specs",
      "strategy",
    ]);
    expect(data.areas[0]).toEqual({
      id: "problem_discovery",
      name: "Problem discovery and user research",
      level: "junior",
      score: 0.8438,
      confidence: 0.41,
      nPrompts: 6,
      targetLevel: "senior",
      gap: 2,
      thresholds: pm,
    });
  });

  it("keeps each area's own thresholds", async () => {
    const supabase = mockSupabase({
      gaps: { data: gaps },
      signals: { count: 12 },
    });
    const data = await loadSkillMatrix(supabase.client, profile, catalog);
    if (data?.kind !== "levels") throw new Error("expected levels");

    expect(data.areas[1].thresholds).toEqual({
      junior: 0,
      mid: 1.2,
      senior: 2.4,
    });
  });

  it("keeps areas below the evidence minimum, with null values", async () => {
    const supabase = mockSupabase({
      gaps: { data: [{ ...gaps[1], target_level: null }] },
      signals: { count: 3 },
    });
    const data = await loadSkillMatrix(supabase.client, profile, catalog);
    if (data?.kind !== "levels") throw new Error("expected levels");

    expect(data.totalPrompts).toBe(3);
    expect(data.areas).toEqual([
      {
        id: "strategy",
        name: "Product strategy",
        level: null,
        score: null,
        confidence: null,
        nPrompts: null,
        targetLevel: "senior",
        gap: null,
        thresholds: pm,
      },
    ]);
  });

  it("falls back to the job title when the track isn't in the catalog", async () => {
    const supabase = mockSupabase({ gaps: { data: gaps } });
    const data = await loadSkillMatrix(supabase.client, profile, []);
    expect(data?.trackName).toBe("Senior PM, Growth");
  });

  it.each([
    ["levels", { gaps: { error: { code: "42501" } } }, "Level read failed"],
    [
      "thresholds",
      { gaps: { data: gaps }, areas: { error: { code: "42501" } } },
      "Threshold read failed",
    ],
    [
      "prompt count",
      { gaps: { data: gaps }, signals: { error: { code: "42501" } } },
      "Prompt count failed",
    ],
  ])(
    "returns null and logs only the code when the %s read fails",
    async (_name, results, message) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const supabase = mockSupabase(results);

      expect(
        await loadSkillMatrix(supabase.client, profile, catalog),
      ).toBeNull();
      expect(log).toHaveBeenCalledWith(message, "42501");
    },
  );

  it("returns null for thresholds of the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({
      gaps: { data: gaps },
      areas: { data: [{ id: "specs", thresholds: { junior: "0" } }] },
      signals: { count: 5 },
    });
    expect(await loadSkillMatrix(supabase.client, profile, catalog)).toBeNull();
  });

  it("returns null when an area has no thresholds", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({
      gaps: { data: gaps },
      areas: { data: areas.slice(0, 2) },
      signals: { count: 5 },
    });
    expect(await loadSkillMatrix(supabase.client, profile, catalog)).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "Skill matrix read failed",
      "missing_thresholds",
    );
  });
});

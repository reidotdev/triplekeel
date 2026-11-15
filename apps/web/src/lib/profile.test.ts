import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProfileRow,
  type CompleteProfile,
  getProfile,
  isProfileComplete,
  profileSummary,
  saveProfile,
} from "./profile";
import type { TrackSummary } from "./tracks";

const catalog: TrackSummary[] = [
  {
    id: "product-manager",
    name: "Product manager",
    altTitles: ["PM", "Product owner"],
  },
];

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const valid = {
  job_title: "Product manager",
  current_level: "junior",
  target_level: "mid",
  unsupported_choice: "wait",
};

type DbError = { code: string; message?: string } | null;

function mockSupabase(options: { error?: DbError; row?: unknown } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: options.error ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.row ?? null,
    error: options.error ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ upsert, select }));
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    upsert,
    select,
    eq,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildProfileRow", () => {
  it("builds a row on the matched track", () => {
    expect(buildProfileRow("user_1", form(valid), catalog)).toEqual({
      ok: true,
      row: {
        user_id: "user_1",
        job_title: "Product manager",
        track_id: "product-manager",
        current_level: "junior",
        target_level: "mid",
        waitlisted: false,
      },
    });
  });

  it("trims the title and collapses spaces", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "  Senior   PM " }),
      catalog,
    );
    expect(result.ok && result.row.job_title).toBe("Senior PM");
    expect(result.ok && result.row.track_id).toBe("product-manager");
  });

  it("puts an unsupported title on the waitlist with no track", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "Designer", unsupported_choice: "wait" }),
      catalog,
    );
    expect(result.ok && result.row).toMatchObject({
      job_title: "Designer",
      track_id: null,
      waitlisted: true,
    });
  });

  it("lets an unsupported title try the first track and stay waitlisted", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "Designer", unsupported_choice: "try" }),
      catalog,
    );
    expect(result.ok && result.row).toMatchObject({
      job_title: "Designer",
      track_id: "product-manager",
      waitlisted: true,
    });
  });

  it("ignores a track sent by the browser", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "Designer", track_id: "product-manager" }),
      catalog,
    );
    expect(result.ok && result.row.track_id).toBeNull();
  });

  it("allows the same current level and goal", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, current_level: "senior", target_level: "senior" }),
      catalog,
    );
    expect(result.ok).toBe(true);
  });

  it("requires every field", () => {
    expect(buildProfileRow("user_1", form({}), catalog)).toEqual({
      ok: false,
      errors: {
        job_title: "Enter your job title.",
        current_level: "Pick your current level.",
        target_level: "Pick your goal.",
      },
    });
  });

  it("rejects a goal below the current level", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, current_level: "senior", target_level: "junior" }),
      catalog,
    );
    expect(result).toEqual({
      ok: false,
      errors: { target_level: "Pick a goal at or above your current level." },
    });
  });

  it("rejects unknown levels", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, current_level: "principal", target_level: "staff" }),
      catalog,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors)).toEqual([
      "current_level",
      "target_level",
    ]);
  });

  it("rejects long titles and control characters", () => {
    const long = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "a".repeat(81) }),
      catalog,
    );
    expect(!long.ok && long.errors.job_title).toBe(
      "Use 80 characters or fewer.",
    );
    const control = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "PM\u0000" }),
      catalog,
    );
    expect(!control.ok && control.errors.job_title).toBe(
      "Use plain text only.",
    );
  });

  it("needs a choice for an unsupported title", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, job_title: "Designer", unsupported_choice: "other" }),
      catalog,
    );
    expect(result).toEqual({
      ok: false,
      errors: { unsupported_choice: "Pick what to do next." },
    });
  });

  it("cannot try a track when there are none", () => {
    const result = buildProfileRow(
      "user_1",
      form({ ...valid, unsupported_choice: "try" }),
      [],
    );
    expect(!result.ok && result.errors.unsupported_choice).toBe(
      "No track is available yet.",
    );
  });
});

describe("saveProfile", () => {
  it("upserts the signed-in user's row", async () => {
    const supabase = mockSupabase();
    const state = await saveProfile(
      supabase.client,
      "user_1",
      form(valid),
      catalog,
    );

    expect(state).toEqual({ status: "saved" });
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.upsert).toHaveBeenCalledTimes(1);
    const [row, options] = supabase.upsert.mock.calls[0];
    expect(row).toMatchObject({
      user_id: "user_1",
      job_title: "Product manager",
      track_id: "product-manager",
      current_level: "junior",
      target_level: "mid",
      waitlisted: false,
    });
    expect(Number.isNaN(Date.parse(row.updated_at))).toBe(false);
    expect(options).toEqual({ onConflict: "user_id" });
  });

  it("does not call the database for invalid input", async () => {
    const supabase = mockSupabase();
    const state = await saveProfile(
      supabase.client,
      "user_1",
      form({ ...valid, job_title: "" }),
      catalog,
    );

    expect(state).toEqual({
      status: "error",
      errors: { job_title: "Enter your job title." },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("reports a database error without leaking details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({ error: { code: "42501" } });
    const state = await saveProfile(
      supabase.client,
      "user_1",
      form(valid),
      catalog,
    );

    expect(state).toEqual({
      status: "error",
      message: "Could not save. Try again.",
    });
    expect(log).toHaveBeenCalledWith("Profile save failed", "42501");
  });

  it("asks to retry when the users row doesn't exist yet", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({
      error: {
        code: "23503",
        message:
          'insert or update on table "profiles" violates foreign key constraint "profiles_user_id_fkey"',
      },
    });
    const state = await saveProfile(
      supabase.client,
      "user_1",
      form(valid),
      catalog,
    );

    expect(state).toEqual({
      status: "error",
      message: "Your account is still being set up. Try again in a minute.",
    });
    expect(log).toHaveBeenCalledWith("Profile save failed", "23503");
  });
});

describe("getProfile", () => {
  it("reads the user's row", async () => {
    const row = { user_id: "user_1", job_title: "PM" };
    const supabase = mockSupabase({ row });

    expect(await getProfile(supabase.client, "user_1")).toEqual({
      ok: true,
      profile: row,
    });
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.eq).toHaveBeenCalledWith("user_id", "user_1");
  });

  it("returns no profile for a new user", async () => {
    const supabase = mockSupabase();
    expect(await getProfile(supabase.client, "user_1")).toEqual({
      ok: true,
      profile: null,
    });
  });

  it("reports a read error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({ error: { code: "PGRST301" } });
    expect(await getProfile(supabase.client, "user_1")).toEqual({ ok: false });
  });
});

describe("profile display", () => {
  const profile: CompleteProfile = {
    user_id: "user_1",
    job_title: "Senior PM",
    track_id: "product-manager",
    current_level: "junior",
    target_level: "mid",
    waitlisted: false,
  };

  it("shows the track name and both levels", () => {
    expect(profileSummary(profile, catalog)).toBe(
      "Product manager · junior → mid",
    );
  });

  it("shows the job title when there is no track", () => {
    expect(
      profileSummary(
        { ...profile, job_title: "Designer", track_id: null },
        catalog,
      ),
    ).toBe("Designer · junior → mid");
  });

  it("treats a missing or partial profile as incomplete", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ ...profile, target_level: null })).toBe(false);
    expect(isProfileComplete(profile)).toBe(true);
  });
});

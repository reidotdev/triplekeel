import type { SupabaseClient } from "@supabase/supabase-js";
import { matchTrack, type TrackSummary } from "./tracks";

export const LEVELS = ["junior", "mid", "senior"] as const;
export type Level = (typeof LEVELS)[number];

/** What a user with an unsupported title chose to do. */
export const UNSUPPORTED_CHOICES = ["wait", "try"] as const;
export type UnsupportedChoice = (typeof UNSUPPORTED_CHOICES)[number];

export const JOB_TITLE_MAX_LENGTH = 80;

export type ProfileRow = {
  user_id: string;
  job_title: string | null;
  track_id: string | null;
  current_level: Level | null;
  target_level: Level | null;
  waitlisted: boolean;
};

export type CompleteProfile = ProfileRow & {
  job_title: string;
  current_level: Level;
  target_level: Level;
};

export type ProfileField =
  | "job_title"
  | "current_level"
  | "target_level"
  | "unsupported_choice";

export type ProfileErrors = Partial<Record<ProfileField, string>>;

export type ProfileFormState = {
  status: "idle" | "saved" | "error";
  errors?: ProfileErrors;
  message?: string;
};

const PROFILE_COLUMNS =
  "user_id, job_title, track_id, current_level, target_level, waitlisted";

function isLevel(value: unknown): value is Level {
  return LEVELS.includes(value as Level);
}

function isUnsupportedChoice(value: unknown): value is UnsupportedChoice {
  return UNSUPPORTED_CHOICES.includes(value as UnsupportedChoice);
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export type ProfileRowResult =
  | { ok: true; row: ProfileRow }
  | { ok: false; errors: ProfileErrors };

/**
 * Validates the form and builds the row to store. The track always comes from
 * the title and the track files, never from the browser.
 */
export function buildProfileRow(
  userId: string,
  formData: FormData,
  catalog: readonly TrackSummary[],
): ProfileRowResult {
  const errors: ProfileErrors = {};

  const rawTitle = formData.get("job_title");
  const jobTitle =
    typeof rawTitle === "string" ? rawTitle.trim().replace(/\s+/g, " ") : "";
  if (!jobTitle) {
    errors.job_title = "Enter your job title.";
  } else if (jobTitle.length > JOB_TITLE_MAX_LENGTH) {
    errors.job_title = `Use ${JOB_TITLE_MAX_LENGTH} characters or fewer.`;
  } else if (hasControlCharacter(jobTitle)) {
    errors.job_title = "Use plain text only.";
  }

  const currentLevel = formData.get("current_level");
  if (!isLevel(currentLevel)) {
    errors.current_level = "Pick your current level.";
  }

  const targetLevel = formData.get("target_level");
  if (!isLevel(targetLevel)) {
    errors.target_level = "Pick your goal.";
  } else if (
    isLevel(currentLevel) &&
    LEVELS.indexOf(targetLevel) < LEVELS.indexOf(currentLevel)
  ) {
    errors.target_level = "Pick a goal at or above your current level.";
  }

  const matched = errors.job_title ? null : matchTrack(jobTitle, catalog);
  const choice = formData.get("unsupported_choice");
  let trackId = matched?.id ?? null;
  if (!errors.job_title && !matched) {
    if (!isUnsupportedChoice(choice)) {
      errors.unsupported_choice = "Pick what to do next.";
    } else if (choice === "try") {
      trackId = catalog[0]?.id ?? null;
      if (!trackId) errors.unsupported_choice = "No track is available yet.";
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    !isLevel(currentLevel) ||
    !isLevel(targetLevel)
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    row: {
      user_id: userId,
      job_title: jobTitle,
      track_id: trackId,
      current_level: currentLevel,
      target_level: targetLevel,
      // An unsupported title stays on the waitlist, even when the user tries
      // another track for now.
      waitlisted: !matched,
    },
  };
}

/** Validates and stores the signed-in user's profile. */
export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData,
  catalog: readonly TrackSummary[],
): Promise<ProfileFormState> {
  const result = buildProfileRow(userId, formData, catalog);
  if (!result.ok) return { status: "error", errors: result.errors };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { ...result.row, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("Profile save failed", error.code);
    // profiles references users (REI-286). Right after sign-up, the Clerk
    // webhook may not have created the users row yet.
    if (
      error.code === "23503" &&
      error.message?.includes("profiles_user_id_fkey")
    ) {
      return {
        status: "error",
        message: "Your account is still being set up. Try again in a minute.",
      };
    }
    return { status: "error", message: "Could not save. Try again." };
  }
  return { status: "saved" };
}

export type ProfileReadResult =
  | { ok: true; profile: ProfileRow | null }
  | { ok: false };

/** Reads the signed-in user's profile. Row level security hides other rows. */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileReadResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();
  if (error) {
    console.error("Profile read failed", error.code);
    return { ok: false };
  }
  return { ok: true, profile: data };
}

/** A profile is complete once the sign-up questions are answered. */
export function isProfileComplete(
  profile: ProfileRow | null,
): profile is CompleteProfile {
  return Boolean(
    profile?.job_title && profile.current_level && profile.target_level,
  );
}

/** The dashboard line, for example "Product manager · junior → mid". */
export function profileSummary(
  profile: CompleteProfile,
  catalog: readonly TrackSummary[],
): string {
  const track = catalog.find((item) => item.id === profile.track_id);
  const name = track?.name ?? profile.job_title;
  return `${name} · ${profile.current_level} → ${profile.target_level}`;
}

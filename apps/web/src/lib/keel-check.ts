// The keel check card (REI-279). public.build_keel_check() builds a card from
// the user's reports, levels and the day's picks, stores it in public.nudges
// and returns it. Both calls here use a Supabase client that sends the Clerk
// session token, so row level security limits them to the user's own cards.
//
// A card holds counts, IDs and copied picks, never sentences: the UI phrases
// them, for example "You {card_label} in {yes} of your last {answered}
// prompts." Only error codes are logged, never card content.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEVELS, type Level } from "./profile";

/** The pick copied into the item when the card was built. */
export type KeelCheckPick = {
  title: string;
  url: string;
  publisher: string | null;
  /** ISO 8601. The dated source the card shows. */
  published_at: string;
  podcast_timestamp_seconds: number | null;
  source: "podcast" | "web";
  why_line: string;
};

/** Keep and Stop: one question's answers in the user's last 20 reports. */
export type QuestionCounts = {
  yes: number;
  partly: number;
  no: number;
  /** yes + partly + no. n/a and missing answers don't count. */
  answered: number;
  /** Reports in the window: up to 20. */
  window: number;
};

/** Test: reports in the window with an answer in the area. */
export type AreaCounts = { prompts: number; window: number };

/** Test: the area's level, from public.levels. */
export type TestLevel = {
  level: Level;
  target_level: Level | null;
  gap: number | null;
  score: number;
};

type ItemBase = {
  /** "open" when built. Replies update it later (REI-283). */
  status: string;
  area_id: string;
  area_name: string;
  /** The pick's row when the card was built. The daily job may replace it. */
  pick_id: string;
  pick: KeelCheckPick;
};

export type KeelCheckItem =
  | (ItemBase & {
      /** keep: a good habit. stop: an anti-pattern ("yes" means it happened). */
      kind: "keep" | "stop";
      question_id: string;
      /** Completes "You ___ in 14 of your last 20 prompts". */
      card_label: string | null;
      counts: QuestionCounts;
      level: null;
    })
  | (ItemBase & {
      kind: "test";
      question_id: null;
      card_label: null;
      counts: AreaCounts;
      /** null for a new user without a level yet. */
      level: TestLevel | null;
    });

export type KeelCheckCard = {
  id: string;
  track_id: string;
  /** ISO 8601. */
  created_at: string;
  /** Keep, Stop, Test in that order. Each is left out without evidence or a pick. */
  items: KeelCheckItem[];
};

export type BuildKeelCheckResult =
  | { status: "ok"; card: KeelCheckCard }
  | { status: "unauthorized" }
  | { status: "profile_incomplete" }
  | { status: "limit" }
  | { status: "failed" };

export type LatestKeelCheckResult =
  | { status: "ok"; card: KeelCheckCard | null }
  | { status: "failed" };

/** SQLSTATE or PostgREST codes only. Safe to log. */
const ERROR_CODE_PATTERN = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/;

function safeCode(error: { code?: unknown }): string {
  return typeof error.code === "string" && ERROR_CODE_PATTERN.test(error.code)
    ? error.code
    : "unknown";
}

type Row = Record<string, unknown>;

const isObject = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const isLevel = (value: unknown): value is Level =>
  LEVELS.includes(value as Level);

function isPick(value: unknown): value is KeelCheckPick {
  if (!isObject(value)) return false;
  return (
    isString(value.title) &&
    isString(value.url) &&
    (value.publisher === null || isString(value.publisher)) &&
    isString(value.published_at) &&
    (value.podcast_timestamp_seconds === null ||
      isCount(value.podcast_timestamp_seconds)) &&
    (value.source === "podcast" || value.source === "web") &&
    isString(value.why_line)
  );
}

function isTestLevel(value: unknown): value is TestLevel {
  if (!isObject(value)) return false;
  return (
    isLevel(value.level) &&
    (value.target_level === null || isLevel(value.target_level)) &&
    (value.gap === null || isCount(value.gap)) &&
    typeof value.score === "number"
  );
}

function isItem(value: unknown): value is KeelCheckItem {
  if (!isObject(value)) return false;
  if (
    !isString(value.status) ||
    !isString(value.area_id) ||
    !isString(value.area_name) ||
    !isString(value.pick_id) ||
    !isPick(value.pick) ||
    !isObject(value.counts)
  ) {
    return false;
  }
  const counts = value.counts;
  if (value.kind === "keep" || value.kind === "stop") {
    return (
      isString(value.question_id) &&
      (value.card_label === null || isString(value.card_label)) &&
      value.level === null &&
      ["yes", "partly", "no", "answered", "window"].every((key) =>
        isCount(counts[key]),
      )
    );
  }
  if (value.kind === "test") {
    return (
      value.question_id === null &&
      value.card_label === null &&
      (value.level === null || isTestLevel(value.level)) &&
      isCount(counts.prompts) &&
      isCount(counts.window)
    );
  }
  return false;
}

export function isKeelCheckCard(value: unknown): value is KeelCheckCard {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.track_id) &&
    isString(value.created_at) &&
    Array.isArray(value.items) &&
    value.items.length <= 3 &&
    value.items.every(isItem)
  );
}

/** Builds and stores a card for the signed-in user now. */
export async function buildKeelCheck(
  supabase: SupabaseClient,
): Promise<BuildKeelCheckResult> {
  let data: unknown;
  let error: { code?: string; message?: string } | null;
  try {
    ({ data, error } = await supabase.rpc("build_keel_check"));
  } catch {
    console.error("Keel check failed", "client_error");
    return { status: "failed" };
  }
  if (error) {
    // The function raises P0001 with one of these fixed messages.
    if (error.code === "P0001") {
      switch (error.message) {
        case "not_authenticated":
          return { status: "unauthorized" };
        case "profile_incomplete":
          return { status: "profile_incomplete" };
        case "keel_check_limit":
          return { status: "limit" };
      }
    }
    // Log the code only. Messages and details can contain row values.
    console.error("Keel check failed", safeCode(error));
    return { status: "failed" };
  }
  if (!isKeelCheckCard(data)) {
    console.error("Keel check failed", "bad_result");
    return { status: "failed" };
  }
  return { status: "ok", card: data };
}

/**
 * The signed-in user's newest card, or null before their first one. The
 * newest card can have no items when there was nothing to say.
 */
export async function readLatestKeelCheck(
  supabase: SupabaseClient,
): Promise<LatestKeelCheckResult> {
  let data: unknown;
  let error: { code?: string } | null;
  try {
    ({ data, error } = await supabase
      .from("nudges")
      .select("id, track_id, created_at, items")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle());
  } catch {
    console.error("Keel check read failed", "client_error");
    return { status: "failed" };
  }
  if (error) {
    console.error("Keel check read failed", safeCode(error));
    return { status: "failed" };
  }
  if (data === null) return { status: "ok", card: null };
  if (!isKeelCheckCard(data)) {
    console.error("Keel check read failed", "bad_result");
    return { status: "failed" };
  }
  return { status: "ok", card: data };
}

/** Seconds until the daily cap resets at midnight UTC. At least 1. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

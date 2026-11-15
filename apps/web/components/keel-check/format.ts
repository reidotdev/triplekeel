// Pure text helpers for the keel check card. A card stores counts and IDs,
// never sentences, so the sentences are built here. Kept apart from the
// components so they are easy to test.
import type { KeelCheckItem, KeelCheckPick } from "../../src/lib/keel-check";

type KeepOrStop = Extract<KeelCheckItem, { kind: "keep" | "stop" }>;
type TestItem = Extract<KeelCheckItem, { kind: "test" }>;

/** Shown when a card has no items, or before the first card with few prompts. */
export const EMPTY_TEXT =
  "Score a past chat or keep prompting. Your first keel check needs about 10 prompts.";

/** Below this many prompts, the first keel check is likely empty. */
export const FIRST_CHECK_PROMPTS = 10;

/** The words that label each item. Colour never carries this alone. */
export const KIND_LABEL: Record<KeelCheckItem["kind"], string> = {
  keep: "Keep doing",
  stop: "Stop doing",
  test: "Test",
};

function prompts(count: number): string {
  return count === 1 ? "prompt" : "prompts";
}

/** ", and partly in 3 more", or nothing when no answer was "partly". */
function partlyText(partly: number): string {
  return partly > 0 ? `, and partly in ${partly} more` : "";
}

/**
 * Keep and Stop: "You set a success metric in 12 of your last 18 prompts."
 * Card labels complete "You ___ in N of your last M prompts", so both kinds
 * use the same sentence; the Keep doing or Stop doing label says which it is.
 * Without a card label, the area name stands in.
 */
export function keepStopText(item: KeepOrStop): string {
  const { yes, partly, answered } = item.counts;
  const share = `in ${yes} of your last ${answered} ${prompts(answered)}${partlyText(partly)}`;
  const label = item.card_label?.trim();
  if (label) return `You ${label} ${share}.`;
  const habit = item.kind === "keep" ? "a good habit" : "a habit to drop";
  return `${item.area_name}: ${habit} ${share}.`;
}

/**
 * Test: "Your biggest gap: Metrics (junior → mid). Try this:". At the target
 * or without one, it names the lowest-scoring area. A new user without a
 * level gets the weakest area so far, with the prompts it's based on.
 */
export function testText(item: TestItem): string {
  const { level, area_name: area } = item;
  if (level === null) {
    const { prompts: inArea, window } = item.counts;
    return `Your weakest area so far is ${area}, based on ${inArea} of your last ${window} ${prompts(window)}. Try this:`;
  }
  if (level.target_level !== null && level.gap !== null && level.gap > 0) {
    return `Your biggest gap: ${area} (${level.level} → ${level.target_level}). Try this:`;
  }
  return `Your lowest-scoring area: ${area} (${level.level}). Try this:`;
}

/** The sentence an item opens with, built from its counts. */
export function itemText(item: KeelCheckItem): string {
  return item.kind === "test" ? testText(item) : keepStopText(item);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * "12 Oct 2026", in UTC so the server and every viewer show the same day.
 * Spelled out by hand, because Intl month names differ between runtimes.
 * Null when the value isn't a date.
 */
export function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A podcast position: 975 is "16:15", 3725 is "1:02:05". */
export function formatTimestamp(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  }
  return `${minutes}:${seconds}`;
}

/** "Podcast at 16:15", "Podcast" or "Article". */
export function sourceKindText(pick: KeelCheckPick): string {
  if (pick.source === "web") return "Article";
  return pick.podcast_timestamp_seconds === null
    ? "Podcast"
    : `Podcast at ${formatTimestamp(pick.podcast_timestamp_seconds)}`;
}

/** The parts of a source line around the title link, without empty parts. */
export function sourceParts(pick: KeelCheckPick): {
  before: string[];
  after: string[];
} {
  const publisher = pick.publisher?.trim();
  const date = formatDate(pick.published_at);
  return {
    before: publisher ? [publisher] : [],
    after: [date, sourceKindText(pick)].filter(
      (part): part is string => part !== null,
    ),
  };
}

/** "Keep doing, Stop doing, Test" for a history row, or the empty note. */
export function itemsSummary(items: KeelCheckItem[]): string {
  if (items.length === 0) return "Not enough evidence";
  return items.map((item) => KIND_LABEL[item.kind]).join(", ");
}

/** True when a link goes to a web page, so it is safe to render. */
export function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

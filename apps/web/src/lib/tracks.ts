export type TrackSummary = {
  id: string;
  name: string;
  altTitles: string[];
};

function isTrackSummary(value: unknown): value is TrackSummary {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<TrackSummary>;
  return (
    typeof track.id === "string" &&
    typeof track.name === "string" &&
    Array.isArray(track.altTitles) &&
    track.altTitles.every((title) => typeof title === "string")
  );
}

/** Parses the catalog that `next.config.ts` builds from the track files. */
export function parseTrackCatalog(json: string | undefined): TrackSummary[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isTrackSummary) : [];
  } catch {
    return [];
  }
}

/** The tracks from `tracks/<id>/track.yaml`, inlined at build time. */
export function getTrackCatalog(): TrackSummary[] {
  return parseTrackCatalog(process.env.TRACK_CATALOG);
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Finds the track for a job title. A title matches when it contains the track
 * name or one of its alternative titles as whole words, ignoring case and
 * punctuation. "Senior Product Manager, Growth" matches; "Project manager"
 * does not.
 */
export function matchTrack(
  title: string,
  catalog: readonly TrackSummary[],
): TrackSummary | null {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  for (const track of catalog) {
    for (const known of [track.name, ...track.altTitles]) {
      const candidate = normalizeTitle(known);
      if (candidate && padded.includes(` ${candidate} `)) return track;
    }
  }
  return null;
}

/** Job title suggestions: each track name followed by its other titles. */
export function titleSuggestions(catalog: readonly TrackSummary[]): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const track of catalog) {
    for (const title of [track.name, ...track.altTitles]) {
      const key = normalizeTitle(title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      titles.push(title);
    }
  }
  return titles;
}

/** Test and Keep cite `practice` picks. Stop cites `mistake` picks. */
export type Kind = "practice" | "mistake";
export const KINDS: readonly Kind[] = ["practice", "mistake"];

export type Source = "podcast" | "web";

export type FlagReason =
  | "no_candidates"
  | "no_good_picks"
  | "model_error"
  | "search_error"
  | "cap_reached";

export type Level = "junior" | "mid" | "senior";

/** One skill area, as the job reads it from the database catalog. */
export type CatalogArea = {
  trackId: string;
  trackName: string;
  areaId: string;
  areaName: string;
  descriptions: Record<Level, string>;
  /** The area's Exa queries from skill-areas.yaml, per level. */
  exaQueries: Record<Level, string[]>;
};

/** What the job searches for one area and kind. */
export type AreaPlan = {
  trackId: string;
  trackName: string;
  areaId: string;
  areaName: string;
  descriptions: Record<Level, string>;
  kind: Kind;
  podcastQuery: string;
  webQuery: string;
};

/** A search result the model may pick. */
export type Candidate = {
  url: string;
  title: string;
  source: Source;
  publisher: string | null;
  /** ISO 8601. */
  publishedAt: string;
  /** The passage Exa matched. Used to find the podcast timestamp. */
  highlight: string;
};

/** A row for public.replace_area_picks. */
export type StoredPick = {
  title: string;
  url: string;
  publisher: string | null;
  published_at: string;
  podcast_timestamp_seconds: number | null;
  source: Source;
  why_line: string;
};

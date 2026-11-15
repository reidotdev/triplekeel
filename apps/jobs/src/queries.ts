// Turns the catalog's Exa queries into one search plan per area and kind, and
// builds the Exa request bodies. Only area names and queries go to Exa.
import { PODCAST_DOMAIN, WINDOW_DAYS } from "./config.ts";
import type { AreaPlan, CatalogArea, Kind, Level, Source } from "./types.ts";
import { KINDS } from "./types.ts";

// Mid-level wording first, so a query that names a level reads "mid-level".
const LEVEL_ORDER: readonly Level[] = ["mid", "junior", "senior"];

const MISTAKE_WORDING =
  /\b(mistakes?|fail(s|ed|ing|ures?)?|complain(s|ing)?|wrong|pitfalls?|anti-?patterns?|when not to)\b/i;

/** A query about mistakes or failure feeds Stop; anything else feeds Test and Keep. */
export function queryKind(query: string): Kind {
  return MISTAKE_WORDING.test(query) ? "mistake" : "practice";
}

/** "Product manager" becomes "product manager". */
export function roleName(trackName: string): string {
  return trackName.trim().toLowerCase();
}

export function rolePlural(trackName: string): string {
  const role = roleName(trackName);
  return role.endsWith("s") ? role : `${role}s`;
}

/** "Strategy and vision" becomes "strategy and vision"; "AI product sense" stays. */
export function areaPhrase(areaName: string): string {
  const name = areaName.trim();
  const first = name.split(/\s/)[0] ?? "";
  if (first.length > 1 && first === first.toUpperCase()) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Used when an area's queries have none of this kind. It follows the wording
 * that worked for most areas in REI-265: "mistakes ... make with {area}" and
 * "... talking about {area}".
 */
export function fallbackQuery(
  kind: Kind,
  trackName: string,
  areaName: string,
): string {
  const people = rolePlural(trackName);
  const area = areaPhrase(areaName);
  return kind === "mistake"
    ? `mistakes ${people} make with ${area}`
    : `${people} talking about ${area}`;
}

export function uniqueQueries(area: CatalogArea): string[] {
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const level of LEVEL_ORDER) {
    for (const raw of area.exaQueries[level] ?? []) {
      const query = raw.trim();
      const key = query.toLowerCase();
      if (query && !seen.has(key)) {
        seen.add(key);
        queries.push(query);
      }
    }
  }
  return queries;
}

/**
 * One plan per area and kind. The first query of a kind goes to the podcast
 * search (the tested podcast wording), the second to the web search. With only
 * one query, both searches use it.
 */
export function buildAreaPlans(areas: readonly CatalogArea[]): AreaPlan[] {
  return areas.flatMap((area) => {
    const queries = uniqueQueries(area);
    return KINDS.map((kind) => {
      const ofKind = queries.filter((query) => queryKind(query) === kind);
      if (ofKind.length === 0) {
        ofKind.push(fallbackQuery(kind, area.trackName, area.areaName));
      }
      return {
        trackId: area.trackId,
        trackName: area.trackName,
        areaId: area.areaId,
        areaName: area.areaName,
        descriptions: area.descriptions,
        kind,
        podcastQuery: ofKind[0] as string,
        webQuery: (ofKind[1] ?? ofKind[0]) as string,
      };
    });
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
}

/** The Exa `/search` body for one plan and source. */
export function buildSearchRequest(
  plan: AreaPlan,
  source: Source,
  now: Date,
): Record<string, unknown> {
  const role = roleName(plan.trackName);
  const people = rolePlural(plan.trackName);
  const goal =
    plan.kind === "mistake"
      ? "Prefer common mistakes and what to do instead."
      : "Prefer concrete practices that work today.";
  const what =
    source === "podcast"
      ? "podcast episodes"
      : "blog posts, articles and talks";
  const base = {
    query: source === "podcast" ? plan.podcastQuery : plan.webQuery,
    objective: `Find ${what} where ${people} discuss ${areaPhrase(plan.areaName)}, from a ${role}'s point of view. ${goal}`,
    type: "auto",
    startPublishedDate: windowStart(now).toISOString(),
    endPublishedDate: now.toISOString(),
  };
  if (source === "podcast") {
    // A short `text` holds the episode header with the show name, which the
    // model needs to judge whether the show is product-focused.
    return {
      ...base,
      includeDomains: [PODCAST_DOMAIN],
      contents: { highlights: true, text: { maxCharacters: 800 } },
    };
  }
  return {
    ...base,
    excludeDomains: ["exa.ai"],
    contents: { highlights: true },
  };
}

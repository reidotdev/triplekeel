// Turns Exa results into candidates the model may pick: dated inside the
// window, with a title and an http(s) URL, and without duplicates.
import { MAX_CANDIDATES } from "./config.ts";
import type { ExaResult } from "./exa.ts";
import { podcastShow } from "./transcript.ts";
import type { Candidate, Source } from "./types.ts";

/** A key that treats `www.`, tracking parameters, `#...` and a final `/` as the same URL. */
export function urlKey(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...url.searchParams.entries()]
    .filter(([name]) => !/^(utm_|ref$|ref_|fbclid$|gclid$)/i.test(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${query}`;
}

function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function publisherFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Results with a usable URL, title and a publish date inside the window. */
export function toCandidates(
  results: readonly ExaResult[],
  source: Source,
  window: { start: Date; end: Date },
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const result of results) {
    const title = result.title?.replace(/\s+/g, " ").trim();
    if (!title || !urlKey(result.url)) continue;
    const published = result.publishedDate
      ? new Date(result.publishedDate)
      : null;
    if (!published || Number.isNaN(published.getTime())) continue;
    if (published < window.start || published > window.end) continue;
    candidates.push({
      url: result.url,
      title: title.slice(0, 300),
      source,
      publisher:
        source === "podcast"
          ? podcastShow(result.text)
          : publisherFromUrl(result.url),
      publishedAt: published.toISOString(),
      highlight: (result.highlights ?? []).join(" ").trim(),
    });
  }
  return candidates;
}

/**
 * Drops repeats by URL and by title, keeping the first. Podcasts come first,
 * so an episode found on both sides keeps its timestamp.
 */
export function dedupeCandidates(
  candidates: readonly Candidate[],
  limit = MAX_CANDIDATES,
): Candidate[] {
  const urls = new Set<string>();
  const titles = new Set<string>();
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    const url = urlKey(candidate.url);
    const title = titleKey(candidate.title);
    if (!url || urls.has(url) || (title && titles.has(title))) continue;
    urls.add(url);
    if (title) titles.add(title);
    kept.push(candidate);
    if (kept.length >= limit) break;
  }
  return kept;
}

// Reads Exa podcast transcripts. Each turn starts with
// `**Speaker name · mm:ss.mmm–mm:ss.mmm**`. Minutes don't roll over into
// hours (a 97-minute episode ends at `96:52.767`). Highlights carry no
// timestamps, so the job finds the highlight in the text and takes the start
// of its turn.

const CLOCK = String.raw`(?:\d+:)?\d+:\d{2}(?:\.\d+)?`;
const TURN_SOURCE = String.raw`\*\*[^*\n]+? · (${CLOCK})\s*[–-]\s*${CLOCK}\*\*`;

/** Seconds from `mm:ss.mmm` or `h:mm:ss.mmm`, rounded down. */
export function clockSeconds(clock: string): number | null {
  const parts = clock.split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    return null;
  }
  const [a = 0, b = 0, c] = parts;
  const seconds = c === undefined ? a * 60 + b : a * 3600 + b * 60 + c;
  return Math.floor(seconds);
}

export type Turn = { index: number; startSeconds: number };

/** Every turn marker in `text`, in order. */
export function parseTurns(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const match of text.matchAll(new RegExp(TURN_SOURCE, "g"))) {
    const seconds = clockSeconds(match[1] ?? "");
    if (seconds !== null && match.index !== undefined) {
      turns.push({ index: match.index, startSeconds: seconds });
    }
  }
  return turns;
}

function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripEllipses(value: string): string {
  return value.replace(/^(\.\.\.|…)\s*/, "").replace(/\s*(\.\.\.|…)$/, "");
}

/** Likely substrings of the highlight, best first. */
function needles(passage: string): string[] {
  const clean = stripEllipses(passage);
  const out = [clean];
  for (const size of [120, 60]) {
    if (clean.length > size) out.push(clean.slice(0, size));
  }
  if (clean.length > 90) {
    const middle = Math.floor(clean.length / 2);
    out.push(clean.slice(middle - 30, middle + 30));
  }
  return out.filter((needle) => needle.trim().length >= 20);
}

/**
 * The start, in whole seconds, of the transcript turn that holds the
 * highlight. Null when the highlight can't be found in a turn.
 */
export function findHighlightTimestamp(
  transcript: string,
  highlight: string,
): number | null {
  const text = squash(transcript);
  const turns = parseTurns(text);
  if (turns.length === 0) return null;
  const passage = squash(highlight);

  // A highlight that spans turns carries the raw markers. The text before
  // the first marker is the end of the turn it starts in.
  const marker = new RegExp(TURN_SOURCE).exec(passage);
  let lead = passage;
  if (marker) {
    lead = passage.slice(0, marker.index).trim();
    if (stripEllipses(lead).length < 20) {
      const start = text.indexOf(marker[0]);
      if (start >= 0) return turnAt(turns, start);
      return clockSeconds(marker[1] ?? "");
    }
  }

  for (const needle of needles(lead)) {
    const at = text.indexOf(needle);
    if (at >= 0) return turnAt(turns, at);
  }
  return null;
}

function turnAt(turns: readonly Turn[], index: number): number | null {
  let found: Turn | undefined;
  for (const turn of turns) {
    if (turn.index > index) break;
    found = turn;
  }
  return found ? found.startSeconds : null;
}

/** The show name from the episode header: `- **Podcast:** [Name](url)`. */
export function podcastShow(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = /\*\*Podcast:\*\*\s*(?:\[([^\]\n]+)\]|([^\n]+))/.exec(text);
  const name = squash(match?.[1] ?? match?.[2] ?? "");
  return name ? name.slice(0, 200) : null;
}

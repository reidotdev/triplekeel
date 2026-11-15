// Turns scored messages into triplekeel.signal.v1 reports, in the popup.
// The content script never sends prompt text, so none can get in here.
import {
  ANSWERS,
  type Answer,
  buildReport,
  type ImportApp,
  QUESTION_IDS,
  type QuestionId,
  type Report,
  TRACK_IDS,
  type TrackId,
  type TrackQuestion,
} from "@triplekeel/schema";
import type { TrackQuestion as ApiQuestion } from "./api.js";
import type { ScoredMessage } from "./score-chat.js";

/** True if this build can make reports for the track. */
export function isKnownTrack(trackId: string): trackId is TrackId {
  return (TRACK_IDS as readonly string[]).includes(trackId);
}

/**
 * The API's questions that this build knows. A question added on the server
 * after this build is left out, because the report schema would reject it.
 */
export function knownQuestions(
  questions: readonly ApiQuestion[],
): TrackQuestion[] {
  const seen = new Set<string>();
  const known: TrackQuestion[] = [];
  for (const question of questions) {
    if (seen.has(question.id)) continue;
    if (!(QUESTION_IDS as readonly string[]).includes(question.id)) continue;
    const answers = question.answers;
    if (answers.length < 2) continue;
    if (!answers.every((a) => (ANSWERS as readonly string[]).includes(a))) {
      continue;
    }
    seen.add(question.id);
    known.push({
      id: question.id as QuestionId,
      text: question.text,
      area: question.area,
      polarity: question.polarity,
      answers: answers as Answer[],
    });
  }
  return known;
}

/** One `import` report per scored message. Throws if one is invalid. */
export function buildImportReports(
  scored: readonly ScoredMessage[],
  track: TrackId,
  app: ImportApp,
  scoredAt: Date,
): Report[] {
  return scored.map((message) =>
    buildReport({
      track,
      app,
      source: "import",
      scoredAt,
      promptLength: message.promptLength,
      answers: message.answers,
      importKey: message.importKey,
    }),
  );
}

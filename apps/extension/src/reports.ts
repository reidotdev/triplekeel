// Turns scored messages into triplekeel.signal.v1 reports. buildReport()
// takes answers and a length, never text, so no prompt text can get in.
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
import type { ScoredAnswer } from "@triplekeel/scorer";
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

/**
 * One `live` report for a prompt the user just sent, built in the content
 * script from the answers and the length only. It has no import_key: a live
 * prompt happens once. Throws if the report is invalid.
 */
export function buildLiveReport(
  answers: readonly ScoredAnswer[],
  track: TrackId,
  app: ImportApp,
  scoredAt: Date,
  promptLength: number,
): Report {
  return buildReport({
    track,
    app,
    source: "live",
    scoredAt,
    promptLength,
    answers,
  });
}

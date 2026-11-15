// Messages between the popup and the content script. None of them carries
// prompt text: the content script sends counts, answers, lengths and import
// keys only.
import type { TrackQuestion } from "@triplekeel/schema";
import type { SiteId } from "./adapters/index.js";
import type { ScoreChatErrorCode, ScoredMessage } from "./score-chat.js";

/** A one-off message: is this tab a chat, and how many user messages? */
export const PAGE_STATUS_MESSAGE = "triplekeel.page-status";

export type PageStatus = {
  site: SiteId;
  isConversationPage: boolean;
  userMessageCount: number;
};

/** A port the popup opens to score the tab's chat. */
export const SCORE_CHAT_PORT = "triplekeel.score-chat";

/** Popup to content script. */
export type ScoreChatRequest = {
  type: "start";
  trackId: string;
  questions: TrackQuestion[];
};

/** Content script to popup. */
export type ScoreChatEvent =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; site: SiteId; scored: ScoredMessage[]; found: number }
  | { type: "error"; error: ScoreChatErrorCode | "failed" };

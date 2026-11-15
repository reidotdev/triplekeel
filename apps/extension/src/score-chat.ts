// "Score this chat", the part that runs in the content script on the chat's
// page. It reads only what the page shows, keeps the user's own messages,
// drops off-track and personal ones, and scores the rest. Prompt text stays
// in this file's variables: what comes out is answers, a length and an
// import key per message.

import type { TrackQuestion } from "@triplekeel/schema";
import type { ScoredAnswer, Scorer } from "@triplekeel/scorer";
import { isPersonal, routeTrack } from "@triplekeel/scorer";
import type { SiteAdapter, SiteId } from "./adapters/index.js";
import type { MessageIdentity } from "./import-key.js";

/** At most this many of the chat's latest user messages are scored. */
export const MAX_CHAT_MESSAGES = 20;

export type ChatMessage = {
  /** Position among the user's messages on the page, from 0. */
  position: number;
  text: string;
};

export type CollectedChat = {
  /** The chat's first user message, used to route the chat. */
  firstMessage: string | undefined;
  /** The last messages, oldest first, at most `limit`. */
  messages: ChatMessage[];
};

/** The user's own messages on the page, oldest first, up to the last `limit`. */
export function collectUserMessages(
  adapter: SiteAdapter,
  limit = MAX_CHAT_MESSAGES,
): CollectedChat {
  const all = adapter.getAllUserMessages();
  const start = Math.max(0, all.length - limit);
  return {
    firstMessage: all[0],
    messages: all
      .slice(start)
      .map((text, i) => ({ position: start + i, text })),
  };
}

/**
 * Keeps the messages that belong to the user's track. A message with track
 * words goes by its own route. A message with none, like "fix it", takes the
 * chat's route, which comes from the first message (ADR-0012). A personal
 * message is always dropped.
 */
export function keepOnTrack(
  chat: CollectedChat,
  trackId: string,
): ChatMessage[] {
  const chatTrack =
    chat.firstMessage === undefined ? "none" : routeTrack(chat.firstMessage);
  return chat.messages.filter(({ text }) => {
    if (isPersonal(text)) return false;
    const route = routeTrack(text);
    return (route === "none" ? chatTrack : route) === trackId;
  });
}

/** One scored message, without its text. */
export type ScoredMessage = {
  answers: ScoredAnswer[];
  /** Length in characters. buildReport() keeps only its bucket. */
  promptLength: number;
  importKey: string;
};

export type ScoreChatErrorCode =
  | "not_conversation"
  | "shared_chat"
  | "no_messages";

export class ScoreChatError extends Error {
  constructor(readonly code: ScoreChatErrorCode) {
    super(code);
    this.name = "ScoreChatError";
  }
}

export type ScoreChatInput = {
  adapter: SiteAdapter;
  trackId: string;
  questions: readonly TrackQuestion[];
  scorer: Scorer;
  importKey: (identity: MessageIdentity) => Promise<string>;
  onProgress?: (done: number, total: number) => void;
};

export type ScoreChatResult = {
  site: SiteId;
  scored: ScoredMessage[];
  /** User messages read from the page, at most MAX_CHAT_MESSAGES. */
  found: number;
};

export async function scoreChat(
  input: ScoreChatInput,
): Promise<ScoreChatResult> {
  const { adapter, scorer } = input;
  const conversationId = adapter.conversationId();
  if (!conversationId) throw new ScoreChatError("not_conversation");
  // A shared link may show someone else's prompts. Never score them as ours.
  if (adapter.isSharedChat()) throw new ScoreChatError("shared_chat");
  const chat = collectUserMessages(adapter);
  if (chat.messages.length === 0) throw new ScoreChatError("no_messages");
  const kept = keepOnTrack(chat, input.trackId);

  await scorer.ready();
  const scored: ScoredMessage[] = [];
  input.onProgress?.(0, kept.length);
  for (const [i, message] of kept.entries()) {
    scored.push({
      answers: await scorer.score(message.text, input.questions, {
        followUp: message.position > 0,
      }),
      promptLength: message.text.length,
      importKey: await input.importKey({
        site: adapter.siteId,
        conversationId,
        position: message.position,
        text: message.text,
      }),
    });
    input.onProgress?.(i + 1, kept.length);
  }
  return { site: adapter.siteId, scored, found: chat.messages.length };
}

import type { PageStatus } from "./page-protocol.js";
import type { SessionState } from "./session.js";

export type PopupView = {
  status: string;
  track: string | null;
  note: string | null;
  showConnect: boolean;
  showDevices: boolean;
};

/** Turns the session state into the popup's text. */
export function popupView(state: SessionState, hasServer: boolean): PopupView {
  if (!hasServer) {
    return {
      status: "This build has no server address.",
      track: null,
      note: "Build it again with TRIPLEKEEL_API_BASE set.",
      showConnect: false,
      showDevices: false,
    };
  }
  if (!state.connected) {
    return {
      status: "Not connected.",
      track: null,
      note: "Connect to link this browser to your account.",
      showConnect: true,
      showDevices: false,
    };
  }
  const email = state.me?.email;
  const trackName = state.me?.track?.name;
  return {
    status: email ? `Connected as ${email}` : "Connected",
    track: state.me
      ? trackName
        ? `Track: ${trackName}`
        : "Track: not chosen yet"
      : null,
    note: state.stale ? "Can't reach TripleKeel. Showing saved info." : null,
    showConnect: false,
    showDevices: true,
  };
}

/** What the popup knows about the active tab. */
export type PageInfo =
  | { kind: "other" }
  /** claude.ai or chatgpt.com, but the content script didn't answer. */
  | { kind: "reload" }
  | { kind: "page"; status: PageStatus };

export type ScoreView = { showButton: boolean; note: string | null };

/** Shows "Score this chat" only on a chat page, and only when connected. */
export function scoreView(
  state: SessionState,
  hasServer: boolean,
  page: PageInfo,
): ScoreView {
  const hidden = { showButton: false, note: null };
  if (!hasServer || !state.connected || page.kind === "other") return hidden;
  if (page.kind === "reload") {
    return { showButton: false, note: "Reload this page to score this chat." };
  }
  if (!page.status.isConversationPage) {
    return { showButton: false, note: "Open a chat to score it." };
  }
  if (page.status.isSharedChat) {
    return { showButton: false, note: SCORE_TEXT.shared_chat };
  }
  if (page.status.userMessageCount === 0) {
    return { showButton: false, note: "No messages found on this page." };
  }
  return { showButton: true, note: null };
}

/** Plain, short text for each step and error of "Score this chat". */
export const SCORE_TEXT = {
  reading: "Reading this chat…",
  sending: "Sending scores…",
  no_track: "Choose a track in TripleKeel first.",
  no_questions: "Your questions haven't loaded. Try again in a minute.",
  unsupported_track: "Your track can't be scored yet.",
  not_conversation: "Open a chat to score it.",
  shared_chat: "Shared chats can't be scored. Open one of your own chats.",
  no_messages: "No messages found on this page.",
  none_on_track: "No prompts in this chat match your track.",
  failed: "Something went wrong. Reload the page and try again.",
  rate_limited: "TripleKeel is busy. Try again in a minute.",
  send_failed: "Couldn't send the scores. Try again later.",
} as const;

export function scoringText(done: number, total: number): string {
  return `Scoring ${done} of ${total}…`;
}

export function waitingText(ms: number): string {
  return `TripleKeel is busy. Trying again in ${Math.ceil(ms / 1000)} seconds.`;
}

/** `scored` reports were sent. `inserted` of them were new to the server. */
export function doneText(scored: number, inserted: number): string {
  const prompts = scored === 1 ? "1 prompt" : `${scored} prompts`;
  const repeats = scored - inserted;
  if (repeats <= 0) return `Done: ${prompts} scored.`;
  return repeats === scored
    ? `Done: ${prompts} scored. You scored this chat before, so they count once.`
    : `Done: ${prompts} scored. ${repeats} were scored before and count once.`;
}

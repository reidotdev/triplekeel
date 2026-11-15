import {
  type ApiDeps,
  apiGet,
  type Me,
  type QuestionSet,
  type Track,
  type TrackQuestion,
  UnauthorizedError,
} from "./api.js";

/** The part of `chrome.storage.local` this module uses. */
export type KeyValueStore = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

export type CachedQuestions = {
  trackId: string;
  questions: TrackQuestion[];
  fetchedAt: number;
};

export type SessionState =
  | { connected: false }
  | {
      connected: true;
      me: Me | null;
      questions: CachedQuestions | null;
      /** True when the last refresh failed and the data comes from the cache. */
      stale: boolean;
    };

export type SessionDeps = ApiDeps & {
  store: KeyValueStore;
  now?: () => number;
};

const TOKEN_KEY = "deviceToken";
const ME_KEY = "me";
const QUESTIONS_KEY = "questions";
const ALL_KEYS = [TOKEN_KEY, ME_KEY, QUESTIONS_KEY];

/** `tkd_` plus 32 random bytes as base64url without padding. */
const TOKEN_PATTERN = /^tkd_[A-Za-z0-9_-]{43}$/;

/** Question sets are fetched again after this long, or when the track changes. */
export const QUESTIONS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isDeviceToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return typeof track.id === "string" && typeof track.name === "string";
}

function parseMe(value: unknown): Me {
  const me = (value ?? {}) as Partial<Me>;
  return {
    email: typeof me.email === "string" ? me.email : null,
    track: isTrack(me.track) ? { id: me.track.id, name: me.track.name } : null,
  };
}

function isQuestion(value: unknown): value is TrackQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<TrackQuestion>;
  return (
    typeof question.id === "string" &&
    typeof question.text === "string" &&
    typeof question.area === "string" &&
    (question.polarity === "good" || question.polarity === "bad") &&
    Array.isArray(question.answers) &&
    question.answers.every((answer) => typeof answer === "string")
  );
}

function parseQuestionSet(value: unknown): QuestionSet {
  const set = (value ?? {}) as Partial<QuestionSet>;
  return {
    track: isTrack(set.track) ? set.track : null,
    questions: Array.isArray(set.questions)
      ? set.questions.filter(isQuestion)
      : [],
  };
}

export async function readState(store: KeyValueStore): Promise<SessionState> {
  const stored = await store.get(ALL_KEYS);
  if (!isDeviceToken(stored[TOKEN_KEY])) return { connected: false };
  return {
    connected: true,
    me: (stored[ME_KEY] as Me | undefined) ?? null,
    questions: (stored[QUESTIONS_KEY] as CachedQuestions | undefined) ?? null,
    stale: false,
  };
}

export async function disconnect(store: KeyValueStore): Promise<void> {
  await store.remove(ALL_KEYS);
}

/**
 * Checks the account with the server and updates the cached question set.
 * A 401 means the device was revoked: the token and caches are removed.
 * On any other failure the cached data stays.
 */
export async function refresh(deps: SessionDeps): Promise<SessionState> {
  const { store } = deps;
  const now = deps.now ?? Date.now;
  const before = await readState(store);
  if (!before.connected) return before;
  const token = (await store.get([TOKEN_KEY]))[TOKEN_KEY] as string;

  try {
    const me = parseMe(await apiGet<unknown>(deps, "/api/me", token));
    await store.set({ [ME_KEY]: me });

    let questions = before.questions;
    if (!me.track) {
      questions = null;
      await store.remove([QUESTIONS_KEY]);
    } else if (
      !questions ||
      questions.trackId !== me.track.id ||
      now() - questions.fetchedAt > QUESTIONS_MAX_AGE_MS
    ) {
      const set = parseQuestionSet(
        await apiGet<unknown>(deps, "/api/questions", token),
      );
      questions = {
        trackId: set.track?.id ?? me.track.id,
        questions: set.questions,
        fetchedAt: now(),
      };
      await store.set({ [QUESTIONS_KEY]: questions });
    }
    return { connected: true, me, questions, stale: false };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await disconnect(store);
      return { connected: false };
    }
    const cached = await readState(store);
    return cached.connected ? { ...cached, stale: true } : cached;
  }
}

/** Stores a new device token from the connect page, then loads the account. */
export async function connect(
  deps: SessionDeps,
  token: unknown,
): Promise<SessionState> {
  if (!isDeviceToken(token)) return { connected: false };
  await deps.store.remove([ME_KEY, QUESTIONS_KEY]);
  await deps.store.set({ [TOKEN_KEY]: token });
  return refresh(deps);
}

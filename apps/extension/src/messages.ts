import { connect, type SessionDeps } from "./session.js";

/** Messages the web app's connect page sends through `externally_connectable`. */
export const PING_MESSAGE = "triplekeel.ping";
export const CONNECT_MESSAGE = "triplekeel.connect";

export type ExternalReply =
  | { ok: true; email?: string | null }
  | { ok: false; error: "forbidden" | "bad_request" | "not_connected" };

function sameSite(senderUrl: string | undefined, appUrl: string): boolean {
  if (!senderUrl || !appUrl) return false;
  try {
    const sender = new URL(senderUrl);
    const app = new URL(appUrl);
    return sender.protocol === app.protocol && sender.hostname === app.hostname;
  } catch {
    return false;
  }
}

/**
 * Handles a message from a web page. Only the TripleKeel web app may talk
 * to the extension. The token is stored and never logged.
 */
export async function handleExternalMessage(
  deps: SessionDeps & { appUrl: string },
  message: unknown,
  senderUrl: string | undefined,
): Promise<ExternalReply> {
  if (!sameSite(senderUrl, deps.appUrl)) {
    return { ok: false, error: "forbidden" };
  }
  const type = (message as { type?: unknown } | null)?.type;
  if (type === PING_MESSAGE) return { ok: true };
  if (type !== CONNECT_MESSAGE) return { ok: false, error: "bad_request" };

  const state = await connect(deps, (message as { token?: unknown }).token);
  if (!state.connected) return { ok: false, error: "not_connected" };
  return { ok: true, email: state.me?.email ?? null };
}

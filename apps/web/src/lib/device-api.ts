// Device-authenticated read endpoints for the extension: GET /api/me and
// GET /api/questions. Nothing from the request is logged or echoed.
import { DEVICE_TOKEN_PATTERN, hashDeviceToken } from "./device-token";
import { createSupabaseAnon } from "./supabase-anon";

export type DeviceContext = {
  email: string | null;
  trackId: string | null;
  trackName: string | null;
};

export type ApiQuestion = {
  id: string;
  text: string;
  area: string;
  polarity: string;
  answers: string[];
};

export type ContextResult =
  | { status: "ok"; context: DeviceContext }
  | { status: "unauthorized" }
  | { status: "failed" };

export type DeviceApiDeps = {
  /** Looks up an active device by token hash. Revoked devices are unauthorized. */
  readContext(tokenHash: string): Promise<ContextResult>;
  /** The track's questions, or null if they can't be read. */
  readQuestions(trackId: string): Promise<ApiQuestion[] | null>;
};

// The extension calls from another origin. Auth is a bearer token, not a
// cookie, so any origin may call.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
};

function reply(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...headers },
  });
}

const unauthorized = () =>
  reply(
    401,
    { error: "Invalid device token" },
    { "WWW-Authenticate": "Bearer" },
  );
const serverError = () => reply(500, { error: "Unable to load" });

export function deviceApiOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function authenticate(
  request: Request,
  deps: DeviceApiDeps,
): Promise<ContextResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer +(\S+)$/i.exec(header);
  if (!match || !DEVICE_TOKEN_PATTERN.test(match[1])) {
    return { status: "unauthorized" };
  }
  try {
    return await deps.readContext(await hashDeviceToken(match[1]));
  } catch {
    return { status: "failed" };
  }
}

function trackOf(context: DeviceContext) {
  return context.trackId
    ? { id: context.trackId, name: context.trackName ?? context.trackId }
    : null;
}

/** GET /api/me: the account's email and track. */
export async function handleMe(
  request: Request,
  deps: DeviceApiDeps,
): Promise<Response> {
  const result = await authenticate(request, deps);
  if (result.status === "unauthorized") return unauthorized();
  if (result.status === "failed") return serverError();
  return reply(200, {
    email: result.context.email,
    track: trackOf(result.context),
  });
}

/** GET /api/questions: the question set for the account's track. */
export async function handleQuestions(
  request: Request,
  deps: DeviceApiDeps,
): Promise<Response> {
  const result = await authenticate(request, deps);
  if (result.status === "unauthorized") return unauthorized();
  if (result.status === "failed") return serverError();

  const track = trackOf(result.context);
  if (!track) return reply(200, { track: null, questions: [] });
  let questions: ApiQuestion[] | null;
  try {
    questions = await deps.readQuestions(track.id);
  } catch {
    questions = null;
  }
  if (!questions) return serverError();
  return reply(200, { track, questions });
}

type ContextRow = {
  email: string | null;
  track_id: string | null;
  track_name: string | null;
};

type QuestionRow = {
  id: string;
  area_id: string;
  question_text: string;
  polarity: string;
  answers: string[];
};

/** Reads through Supabase with the anon key. No service-role key. */
export function supabaseDeviceApiDeps(): DeviceApiDeps {
  return {
    async readContext(tokenHash) {
      const { data, error } = await createSupabaseAnon().rpc(
        "read_device_context",
        { p_token_hash: tokenHash },
      );
      if (error) {
        // The function raises P0001 with one of these fixed messages.
        if (
          error.code === "P0001" &&
          (error.message === "device_not_found" ||
            error.message === "device_revoked")
        ) {
          return { status: "unauthorized" };
        }
        // Log the error code only.
        console.error("Device lookup failed", error.code ?? "unknown");
        return { status: "failed" };
      }
      const row = (Array.isArray(data) ? data[0] : data) as
        | ContextRow
        | undefined;
      if (!row) return { status: "failed" };
      return {
        status: "ok",
        context: {
          email: row.email,
          trackId: row.track_id,
          trackName: row.track_name,
        },
      };
    },
    async readQuestions(trackId) {
      const { data, error } = await createSupabaseAnon()
        .from("questions")
        .select("id, area_id, question_text, polarity, answers")
        .eq("track_id", trackId)
        .order("id");
      if (error || !data) {
        console.error("Question read failed", error?.code ?? "unknown");
        return null;
      }
      return (data as QuestionRow[]).map((row) => ({
        id: row.id,
        text: row.question_text,
        area: row.area_id,
        polarity: row.polarity,
        answers: row.answers,
      }));
    },
  };
}

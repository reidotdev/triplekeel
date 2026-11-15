// POST /api/signals: the extension sends score reports here.
// Privacy boundary: this file never logs or echoes anything from the request.
// Relative imports keep the route testable without a path alias.
import { parseReport, type Report } from "@triplekeel/schema";
import { hashDeviceToken } from "../../../src/lib/device-token";
import { isKillSwitchEnabled } from "../../../src/lib/kill-switch";
import { createSupabaseAnon } from "../../../src/lib/supabase-anon";

/** The database function accepts 1 to 50 reports per call. */
const MAX_REPORTS = 50;

/** A full batch is well under 100 KB. Larger bodies aren't parsed. */
const MAX_BODY_BYTES = 256 * 1024;

const BEARER_PATTERN = /^Bearer +(tkd_[A-Za-z0-9_-]{16,256})$/i;

/** SQLSTATE or PostgREST codes only. Safe to log. */
const ERROR_CODE_PATTERN = /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/;

// The extension calls from another origin. Auth is a bearer token, not a
// cookie, so any origin may call.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
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
const badRequest = () => reply(400, { error: "Invalid reports" });
const serverError = () => reply(500, { error: "Unable to store reports" });

/** Reads the body as text, or returns null if it's missing or too large. */
async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !(Number(declared) <= MAX_BODY_BYTES)) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Returns the validated reports, or null if anything is wrong. */
async function readReports(request: Request): Promise<Report[] | null> {
  let body: unknown;
  try {
    const text = await readBody(request);
    if (text === null) return null;
    body = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "reports") return null;
  const items = (body as { reports: unknown }).reports;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_REPORTS) {
    return null;
  }

  const reports: Report[] = [];
  for (const item of items) {
    const result = parseReport(item);
    if (!result.ok) return null;
    reports.push(result.report);
  }
  return reports;
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  // proxy.ts also checks this. The route checks again in case it's bypassed.
  if (isKillSwitchEnabled(process.env.KILL_SWITCH)) {
    return reply(503, { error: "API is temporarily unavailable" });
  }

  const match = BEARER_PATTERN.exec(request.headers.get("authorization") ?? "");
  if (!match) return unauthorized();

  const reports = await readReports(request);
  if (!reports) return badRequest();

  let data: unknown;
  let error: { code?: string; message?: string } | null;
  try {
    const supabase = createSupabaseAnon();
    ({ data, error } = await supabase.rpc("write_device_signals", {
      p_token_hash: await hashDeviceToken(match[1]),
      p_reports: reports,
    }));
  } catch {
    console.error("Signal write failed", "client_error");
    return serverError();
  }

  if (error) {
    // The function raises P0001 with one of these fixed messages.
    if (error.code === "P0001") {
      switch (error.message) {
        case "device_not_found":
        case "device_revoked":
          return unauthorized();
        case "rate_limit_exceeded":
          return reply(
            429,
            { error: "Too many reports" },
            { "Retry-After": "60" },
          );
        case "invalid_batch":
        case "invalid_report":
          return badRequest();
      }
    }
    // Log the error code only. Messages and details can contain row values.
    const code =
      typeof error.code === "string" && ERROR_CODE_PATTERN.test(error.code)
        ? error.code
        : "unknown";
    console.error("Signal write failed", code);
    return serverError();
  }

  if (typeof data !== "number") {
    console.error("Signal write failed", "bad_result");
    return serverError();
  }
  return reply(200, { received: reports.length, inserted: data });
}

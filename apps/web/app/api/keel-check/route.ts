// POST /api/keel-check: builds the signed-in user's keel check card now
// (REI-279) and returns it. The database does the work in
// public.build_keel_check(), through the Clerk-token client, never the
// service role key. This file logs error codes only, never card content.
// Relative imports keep the route testable without a path alias.
import { auth } from "@clerk/nextjs/server";
import {
  buildKeelCheck,
  secondsUntilUtcMidnight,
} from "../../../src/lib/keel-check";
import { isKillSwitchEnabled } from "../../../src/lib/kill-switch";
import { createSupabaseServerClient } from "../../../src/lib/supabase-server";

function reply(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

const unauthorized = () => reply(401, { error: "Sign in required" });
const serverError = () => reply(500, { error: "Unable to build a keel check" });

export async function POST(): Promise<Response> {
  // proxy.ts also checks this. The route checks again in case it's bypassed.
  if (isKillSwitchEnabled(process.env.KILL_SWITCH)) {
    return reply(503, { error: "API is temporarily unavailable" });
  }

  const { userId } = await auth();
  if (!userId) return unauthorized();

  let result: Awaited<ReturnType<typeof buildKeelCheck>>;
  try {
    result = await buildKeelCheck(createSupabaseServerClient());
  } catch {
    console.error("Keel check failed", "client_error");
    return serverError();
  }

  switch (result.status) {
    case "ok":
      return reply(200, result.card);
    case "unauthorized":
      return unauthorized();
    case "profile_incomplete":
      return reply(409, { error: "Finish your profile first" });
    case "limit":
      return reply(
        429,
        { error: "Too many keel checks today" },
        { "Retry-After": String(secondsUntilUtcMidnight()) },
      );
    default:
      return serverError();
  }
}

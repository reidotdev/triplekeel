import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One fake table that remembers which users rows exist.
const users = new Set<string>();
let deleteError: { code: string } | null = null;
const eq = vi.fn(async (_column: string, id: string) => {
  if (deleteError) return { error: deleteError };
  users.delete(id);
  return { error: null };
});
const from = vi.fn(() => ({ delete: () => ({ eq }) }));
const createClient = vi.fn((..._args: unknown[]) => ({ from }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const { POST } = await import("./route");

const SECRET = `whsec_${Buffer.from("webhook-secret-for-tests-only!!").toString("base64")}`;

function signedRequest(event: unknown): Request {
  const body = JSON.stringify(event);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const signature = new Webhook(SECRET).sign(id, now, body);
  return new Request("http://app.test/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
      "svix-signature": signature,
    },
    body,
  });
}

const deletedEvent = (id: string) => ({
  type: "user.deleted",
  data: { id, object: "user", deleted: true },
});

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests");
  users.clear();
  deleteError = null;
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/webhooks/clerk user.deleted", () => {
  it("deletes the users row", async () => {
    users.add("user_1");

    const response = await POST(signedRequest(deletedEvent("user_1")));

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("users");
    expect(eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(users.has("user_1")).toBe(false);
  });

  it("succeeds for a user that is already deleted", async () => {
    const first = await POST(signedRequest(deletedEvent("user_gone")));
    const again = await POST(signedRequest(deletedEvent("user_gone")));

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ received: true });
    expect(log).not.toHaveBeenCalled();
  });

  it("returns 500 and logs only the code when the delete fails", async () => {
    deleteError = { code: "42501" };

    const response = await POST(signedRequest(deletedEvent("user_1")));

    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("Clerk user deletion failed", "42501");
  });

  it("rejects an event without a valid signature", async () => {
    const request = signedRequest(deletedEvent("user_1"));
    request.headers.set("svix-signature", "v1,invalid");

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});

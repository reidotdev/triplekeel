import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { KeelCheckCard } from "../../../src/lib/keel-check";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const rpc = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const { POST } = await import("./route");

const SUPABASE_URL = "http://supabase.test";
const ANON_KEY = "anon-key-for-tests";
const SERVICE_ROLE_KEY = "service-role-key-for-tests";
const SESSION_TOKEN = "clerk-session-token";

const PICK = {
  title: "Pick one success metric",
  url: "https://example.com/metrics-podcast",
  publisher: "Example Podcast",
  published_at: "2026-11-01T00:00:00+00:00",
  podcast_timestamp_seconds: 754,
  source: "podcast",
  why_line: "Shows how to name one number that proves the feature worked.",
} as const;

const CARD: KeelCheckCard = {
  id: "7facc855-67ef-4055-bd3c-40788370f6a8",
  track_id: "product-manager",
  created_at: "2026-11-15T08:00:00+00:00",
  items: [
    {
      kind: "keep",
      status: "open",
      area_id: "metrics",
      area_name: "Metrics and experiments",
      question_id: "success_metric",
      card_label: "set a success metric",
      counts: { yes: 14, partly: 0, no: 6, answered: 20, window: 20 },
      level: null,
      pick_id: "00000000-0000-0000-0000-000000000101",
      pick: PICK,
    },
    {
      kind: "stop",
      status: "open",
      area_id: "ai_prototyping",
      area_name: "Prototyping with AI tools",
      question_id: "vague_fix",
      card_label: 'asked to "fix it" with no detail',
      counts: { yes: 9, partly: 0, no: 11, answered: 20, window: 20 },
      level: null,
      pick_id: "00000000-0000-0000-0000-000000000105",
      pick: {
        ...PICK,
        title: "Fix-it loops",
        url: "https://example.com/fix-it",
        publisher: null,
        podcast_timestamp_seconds: null,
        source: "web",
      },
    },
    {
      kind: "test",
      status: "open",
      area_id: "problem_discovery",
      area_name: "Problem discovery and user research",
      question_id: null,
      card_label: null,
      counts: { prompts: 20, window: 20 },
      level: { level: "junior", target_level: "senior", gap: 2, score: 0 },
      pick_id: "00000000-0000-0000-0000-000000000103",
      pick: PICK,
    },
  ],
};

// Everything the route writes to the console during this file.
const logged: string[] = [];
const CONSOLE_METHODS = ["debug", "error", "info", "log", "warn"] as const;

beforeAll(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(args.map((arg) => String(arg)).join(" "));
    });
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  auth.mockReset();
  auth.mockResolvedValue({
    userId: "user_123",
    getToken: async () => SESSION_TOKEN,
  });
  rpc.mockReset();
  rpc.mockResolvedValue({ data: CARD, error: null });
  createClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  vi.stubEnv("KILL_SWITCH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function rpcError(message: string, code = "P0001") {
  return {
    data: null,
    error: { code, message, details: `detail ${PICK.title}`, hint: null },
  };
}

describe("POST /api/keel-check", () => {
  it("returns 401 without a Clerk session and never calls the database", async () => {
    auth.mockResolvedValue({ userId: null, getToken: async () => null });
    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in required" });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("builds the card through the Clerk-token client and returns it", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(CARD);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("build_keel_check");

    expect(createClient).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClient.mock.calls[0] as [
      string,
      string,
      { accessToken: () => Promise<string | null> },
    ];
    expect([url, key]).toEqual([SUPABASE_URL, ANON_KEY]);
    expect(await options.accessToken()).toBe(SESSION_TOKEN);
    expect(JSON.stringify(createClient.mock.calls)).not.toContain(
      SERVICE_ROLE_KEY,
    );
  });

  it("returns every item with counts and a dated source", async () => {
    const card = (await (await POST()).json()) as KeelCheckCard;
    expect(card.items.map((item) => item.kind)).toEqual([
      "keep",
      "stop",
      "test",
    ]);
    for (const item of card.items) {
      expect(item.counts.window).toBeGreaterThan(0);
      expect(Date.parse(item.pick.published_at)).not.toBeNaN();
      expect(Object.keys(item.pick).sort()).toEqual([
        "podcast_timestamp_seconds",
        "published_at",
        "publisher",
        "source",
        "title",
        "url",
        "why_line",
      ]);
    }
  });

  it("returns an empty card when there is nothing to say", async () => {
    rpc.mockResolvedValue({ data: { ...CARD, items: [] }, error: null });
    const response = await POST();
    expect(response.status).toBe(200);
    expect((await response.json()).items).toEqual([]);
  });

  it("maps the daily cap to 429 with Retry-After", async () => {
    rpc.mockResolvedValue(rpcError("keel_check_limit"));
    const response = await POST();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Too many keel checks today",
    });
    const retryAfter = Number(response.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(86400);
  });

  it("maps a missing track to 409", async () => {
    rpc.mockResolvedValue(rpcError("profile_incomplete"));
    const response = await POST();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Finish your profile first",
    });
  });

  it("maps a token without a user to 401", async () => {
    rpc.mockResolvedValue(rpcError("not_authenticated"));
    expect((await POST()).status).toBe(401);
  });

  it("returns 500 for other database errors and logs only the code", async () => {
    rpc.mockResolvedValue(rpcError(`boom ${PICK.url}`, "42501"));
    const start = logged.length;
    const response = await POST();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to build a keel check",
    });
    expect(logged.slice(start)).toEqual(["Keel check failed 42501"]);
  });

  it("returns 500 for a result that is not a card", async () => {
    rpc.mockResolvedValue({
      data: { ...CARD, items: [{ ...CARD.items[0], counts: {} }] },
      error: null,
    });
    const start = logged.length;
    expect((await POST()).status).toBe(500);
    expect(logged.slice(start)).toEqual(["Keel check failed bad_result"]);
  });

  it("returns 500 when the client throws", async () => {
    rpc.mockRejectedValue(new Error(`network ${PICK.title}`));
    const start = logged.length;
    expect((await POST()).status).toBe(500);
    expect(logged.slice(start)).toEqual(["Keel check failed client_error"]);
  });

  it("returns 503 when the kill switch is on", async () => {
    vi.stubEnv("KILL_SWITCH", "true");
    const response = await POST();
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never logs card content or error text", () => {
    // Runs last: checks everything logged by the tests above.
    const all = logged.join("\n");
    for (const text of [
      PICK.title,
      PICK.url,
      PICK.why_line,
      "Fix-it loops",
      "set a success metric",
      "boom",
      "detail",
      "network",
      SESSION_TOKEN,
    ]) {
      expect(all).not.toContain(text);
    }
  });
});

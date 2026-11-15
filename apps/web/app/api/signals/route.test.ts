import { createHash } from "node:crypto";
import {
  rejectionCases,
  validReport,
} from "@triplekeel/schema/rejection-cases";
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
import { hashDeviceToken } from "../../../src/lib/device-token";

const rpc = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const { OPTIONS, POST } = await import("./route");

const TOKEN = "tkd_0123456789abcdefghijklmnopqrstuvwxyzABCDEF";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");
const FREE_TEXT = "Write a PRD for a todo app for busy parents";
const SUPABASE_URL = "http://supabase.test";
const ANON_KEY = "anon-key-for-tests";
const SERVICE_ROLE_KEY = "service-role-key-for-tests";

const INVALID_REPORTS = '{"error":"Invalid reports"}';
const INVALID_TOKEN = '{"error":"Invalid device token"}';

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
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 1, error: null });
  createClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  vi.stubEnv("KILL_SWITCH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function post(
  body: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` },
): Promise<Response> {
  return POST(
    new Request("http://localhost/api/signals", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function rpcError(message: string, code = "P0001") {
  return { data: null, error: { code, message, details: null, hint: null } };
}

describe("hashDeviceToken", () => {
  it("returns the SHA-256 of the full token as lowercase hex", async () => {
    expect(await hashDeviceToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await hashDeviceToken(TOKEN)).toBe(TOKEN_HASH);
    expect(await hashDeviceToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes the tkd_ prefix in the hash", async () => {
    expect(await hashDeviceToken(TOKEN)).not.toBe(
      await hashDeviceToken(TOKEN.slice(4)),
    );
  });
});

describe("POST /api/signals returns 200", () => {
  it("stores a valid report with the token hash and the anon key", async () => {
    const response = await post({ reports: [validReport()] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: 1, inserted: 1 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("write_device_signals", {
      p_token_hash: TOKEN_HASH,
      p_reports: [validReport()],
    });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual([
      SUPABASE_URL,
      ANON_KEY,
    ]);
    expect(JSON.stringify(createClient.mock.calls)).not.toContain(
      SERVICE_ROLE_KEY,
    );
  });

  it("reports how many were inserted when duplicates are ignored", async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    const response = await post({ reports: [validReport(), validReport()] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: 2, inserted: 0 });
  });

  it("accepts a batch of 50 reports", async () => {
    rpc.mockResolvedValue({ data: 50, error: null });
    const reports = Array.from({ length: 50 }, validReport);
    const response = await post({ reports });
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_reports).toHaveLength(50);
  });

  it("allows calls from the extension's origin", async () => {
    const response = await post({ reports: [validReport()] });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "Authorization",
    );
  });
});

describe("POST /api/signals returns 401", () => {
  it.each([
    ["no Authorization header", {}],
    ["an empty header", { authorization: "" }],
    ["a different scheme", { authorization: `Basic ${TOKEN}` }],
    ["a bare token", { authorization: TOKEN }],
    [
      "a token without the tkd_ prefix",
      { authorization: "Bearer abc_0123456789abcdefghij" },
    ],
    ["a token that is too short", { authorization: "Bearer tkd_abc" }],
    [
      "a token with other characters",
      { authorization: `Bearer ${TOKEN} ${FREE_TEXT}` },
    ],
    ["a very long token", { authorization: `Bearer tkd_${"a".repeat(300)}` }],
  ])("for %s, without calling the database", async (_name, headers) => {
    const response = await post({ reports: [validReport()] }, headers);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe(INVALID_TOKEN);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["device_not_found", "device_revoked"])(
    "when the function raises %s",
    async (message) => {
      rpc.mockResolvedValue(rpcError(message));
      const response = await post({ reports: [validReport()] });
      expect(response.status).toBe(401);
      expect(await response.text()).toBe(INVALID_TOKEN);
    },
  );
});

describe("POST /api/signals returns 400", () => {
  async function expectRejected(body: unknown): Promise<void> {
    const response = await post(body);
    expect(response.status).toBe(400);
    // The body is a fixed string, so nothing from the input is echoed.
    expect(await response.text()).toBe(INVALID_REPORTS);
    expect(rpc).not.toHaveBeenCalled();
  }

  it.each(rejectionCases())("for a report with $name", async ({ input }) => {
    await expectRejected({ reports: [input] });
  });

  it("for one bad report in a batch of good ones", async () => {
    const bad = { ...validReport(), prompt: FREE_TEXT };
    await expectRejected({ reports: [validReport(), bad, validReport()] });
  });

  it("for more than 50 reports", async () => {
    await expectRejected({ reports: Array.from({ length: 51 }, validReport) });
  });

  it("for an empty batch", async () => {
    await expectRejected({ reports: [] });
  });

  it.each([
    ["text that isn't JSON", FREE_TEXT],
    ["an empty body", ""],
    ["a bare array", [validReport()]],
    ["a bare report", validReport()],
    ["null", null],
    ["reports that isn't an array", { reports: validReport() }],
    ["an unknown top-level key", { reports: [validReport()], note: FREE_TEXT }],
    ["a missing reports key", { items: [validReport()] }],
  ])("for %s", async (_name, body) => {
    await expectRejected(body);
  });

  it("for a body that is too large", async () => {
    await expectRejected({
      reports: [validReport()],
      padding: FREE_TEXT.repeat(10_000),
    });
  });

  it.each(["invalid_report", "invalid_batch"])(
    "when the function raises %s",
    async (message) => {
      rpc.mockResolvedValue(rpcError(message));
      const response = await post({ reports: [validReport()] });
      expect(response.status).toBe(400);
      expect(await response.text()).toBe(INVALID_REPORTS);
    },
  );
});

describe("POST /api/signals returns other errors", () => {
  it("429 when the function raises rate_limit_exceeded", async () => {
    rpc.mockResolvedValue(rpcError("rate_limit_exceeded"));
    const response = await post({ reports: [validReport()] });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.text()).toBe('{"error":"Too many reports"}');
  });

  it("500 for an unexpected database error, without its message", async () => {
    rpc.mockResolvedValue(
      rpcError(`Failing row contains (${FREE_TEXT})`, "23514"),
    );
    const response = await post({ reports: [validReport()] });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"Unable to store reports"}');
  });

  it("500 when the client throws or the configuration is missing", async () => {
    rpc.mockRejectedValue(new Error(FREE_TEXT));
    expect((await post({ reports: [validReport()] })).status).toBe(500);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect((await post({ reports: [validReport()] })).status).toBe(500);
  });

  it("500 when the function returns something that isn't a count", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await post({ reports: [validReport()] })).status).toBe(500);
  });

  it("503 when the kill switch is on, before anything else", async () => {
    vi.stubEnv("KILL_SWITCH", "true");
    const response = await post({ reports: [validReport()] });
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/signals logs", () => {
  it("nothing from the request, whatever the outcome", async () => {
    const before = logged.length;
    const token = `tkd_${"SecretTokenValue".repeat(2)}`;
    const hash = createHash("sha256").update(token).digest("hex");
    const headers = { authorization: `Bearer ${token}` };
    const good = { reports: [validReport()] };
    const bad = {
      reports: [
        { ...validReport(), track: FREE_TEXT, prompt: FREE_TEXT },
        { ...validReport(), answers: [{ q: FREE_TEXT, a: FREE_TEXT, p: 1 }] },
      ],
      [FREE_TEXT]: FREE_TEXT,
    };

    const statuses: number[] = [];
    const send = async (body: unknown, h: Record<string, string>) => {
      statuses.push((await post(body, h)).status);
    };

    await send(good, headers); // 200
    await send(bad, headers); // 400
    await send(FREE_TEXT, headers); // 400
    await send(good, { authorization: `Bearer ${FREE_TEXT}` }); // 401
    rpc.mockResolvedValue(rpcError("device_not_found"));
    await send(good, headers); // 401
    rpc.mockResolvedValue(rpcError("rate_limit_exceeded"));
    await send(good, headers); // 429
    rpc.mockResolvedValue(rpcError("invalid_report"));
    await send(good, headers); // 400
    rpc.mockResolvedValue(rpcError(`${FREE_TEXT} ${token} ${hash}`, "XX000"));
    await send(good, headers); // 500
    rpc.mockResolvedValue(rpcError(FREE_TEXT, FREE_TEXT));
    await send(good, headers); // 500
    rpc.mockRejectedValue(new Error(`${FREE_TEXT} ${token} ${hash}`));
    await send(good, headers); // 500

    expect(statuses).toEqual([
      200, 400, 400, 401, 401, 429, 400, 500, 500, 500,
    ]);

    // Only the three server errors log, and only a fixed line with a code.
    expect(logged.slice(before)).toEqual([
      "Signal write failed XX000",
      "Signal write failed unknown",
      "Signal write failed client_error",
    ]);
  });

  it("nothing with request text anywhere in this test file", () => {
    const requestText = [
      FREE_TEXT,
      TOKEN,
      TOKEN_HASH,
      "SecretTokenValue",
      ...Object.values(validReport()).filter((v) => typeof v === "string"),
      "target_user",
      "0.91",
    ];
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) {
      expect(line).toMatch(/^Signal write failed [0-9A-Za-z_]+$/);
      for (const text of requestText) expect(line).not.toContain(text);
    }
  });
});

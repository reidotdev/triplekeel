import { describe, expect, it } from "vitest";
import {
  type ContextResult,
  type DeviceApiDeps,
  deviceApiOptions,
  handleMe,
  handleQuestions,
} from "./device-api";
import {
  createDeviceToken,
  DEVICE_TOKEN_PATTERN,
  hashDeviceToken,
} from "./device-token";

const QUESTION = {
  id: "target_user",
  text: "Does the prompt name a specific user or audience?",
  area: "problem_discovery",
  polarity: "good",
  answers: ["yes", "partly", "no", "n/a"],
};

/** A fake devices table keyed by token hash, like read_device_context. */
function fakeDatabase() {
  const devices = new Map<
    string,
    { revoked: boolean; trackId: string | null }
  >();
  const seen: string[] = [];
  const deps: DeviceApiDeps = {
    async readContext(tokenHash): Promise<ContextResult> {
      seen.push(tokenHash);
      const device = devices.get(tokenHash);
      if (!device || device.revoked) return { status: "unauthorized" };
      return {
        status: "ok",
        context: {
          email: "ada@example.com",
          trackId: device.trackId,
          trackName: device.trackId ? "Product manager" : null,
        },
      };
    },
    async readQuestions() {
      return [QUESTION];
    },
  };
  return { devices, deps, seen };
}

function get(token?: string): Request {
  return new Request("https://app.example/api/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("device tokens", () => {
  it("creates tkd_ tokens with 32 random bytes as base64url", () => {
    const token = createDeviceToken();
    expect(token).toMatch(DEVICE_TOKEN_PATTERN);
    expect(createDeviceToken()).not.toBe(token);
  });

  it("hashes the full token as lowercase SHA-256 hex", async () => {
    expect(await hashDeviceToken("tkd_test")).toBe(
      "4ff5222e3268fe4f275bd607ad84720a0306e4ea1375d4ab33e084981ef46417",
    );
  });
});

describe("GET /api/me and /api/questions", () => {
  it("returns the email and track for an active device", async () => {
    const { devices, deps, seen } = fakeDatabase();
    const token = createDeviceToken();
    devices.set(await hashDeviceToken(token), {
      revoked: false,
      trackId: "product-manager",
    });

    const me = await handleMe(get(token), deps);
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      email: "ada@example.com",
      track: { id: "product-manager", name: "Product manager" },
    });
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(seen).toEqual([await hashDeviceToken(token)]);

    const questions = await handleQuestions(get(token), deps);
    expect(await questions.json()).toEqual({
      track: { id: "product-manager", name: "Product manager" },
      questions: [QUESTION],
    });
  });

  it("returns no questions when the user has no track yet", async () => {
    const { devices, deps } = fakeDatabase();
    const token = createDeviceToken();
    devices.set(await hashDeviceToken(token), {
      revoked: false,
      trackId: null,
    });
    const response = await handleQuestions(get(token), deps);
    expect(await response.json()).toEqual({ track: null, questions: [] });
  });

  it("fails the next call with 401 once the device is revoked", async () => {
    const { devices, deps } = fakeDatabase();
    const token = createDeviceToken();
    const device = { revoked: false, trackId: "product-manager" };
    devices.set(await hashDeviceToken(token), device);
    expect((await handleMe(get(token), deps)).status).toBe(200);

    device.revoked = true;
    const me = await handleMe(get(token), deps);
    expect(me.status).toBe(401);
    expect(me.headers.get("www-authenticate")).toBe("Bearer");
    expect((await handleQuestions(get(token), deps)).status).toBe(401);
  });

  it("rejects missing, malformed and unknown tokens with 401", async () => {
    const { deps, seen } = fakeDatabase();
    expect((await handleMe(get(), deps)).status).toBe(401);
    expect((await handleMe(get("tkd_short"), deps)).status).toBe(401);
    expect(seen).toEqual([]);
    expect((await handleMe(get(createDeviceToken()), deps)).status).toBe(401);
  });

  it("returns 500 without details when the lookup fails", async () => {
    const deps: DeviceApiDeps = {
      readContext: async () => {
        throw new Error("database down");
      },
      readQuestions: async () => null,
    };
    const response = await handleMe(get(createDeviceToken()), deps);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load" });
  });

  it("answers the CORS preflight", () => {
    const response = deviceApiOptions();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Authorization",
    );
  });
});

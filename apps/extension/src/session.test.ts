import { describe, expect, it } from "vitest";
import { buildManifest, extensionIdFromKey } from "../scripts/manifest.mjs";
import { handleExternalMessage } from "./messages.js";
import { popupView } from "./popup-view.js";
import {
  connect,
  type KeyValueStore,
  QUESTIONS_MAX_AGE_MS,
  readState,
  refresh,
} from "./session.js";

const TOKEN = `tkd_${"A".repeat(43)}`;
const APP = "https://app.example";
const TRACK = { id: "product-manager", name: "Product manager" };
const QUESTION = {
  id: "target_user",
  text: "Does the prompt name a specific user or audience?",
  area: "problem_discovery",
  polarity: "good",
  answers: ["yes", "partly", "no", "n/a"],
};

function memoryStore(): KeyValueStore & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(keys) {
      return Object.fromEntries(
        keys.filter((key) => key in data).map((key) => [key, data[key]]),
      );
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
  };
}

type Route = () => Response;

function fakeServer(routes: Record<string, Route>) {
  const calls: Array<{ path: string; authorization: string | null }> = [];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    calls.push({
      path,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return routes[path]?.() ?? new Response(null, { status: 404 });
  }) as typeof fetch;
  return { calls, fetch: fetchFake };
}

const ok = (body: unknown) => () => Response.json(body);

function setup(routes: Record<string, Route>) {
  const store = memoryStore();
  const server = fakeServer(routes);
  const sleeps: number[] = [];
  let time = 1_000_000;
  const deps = {
    apiBase: APP,
    appUrl: APP,
    fetch: server.fetch,
    store,
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
  return {
    deps,
    store,
    server,
    sleeps,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("connect and refresh", () => {
  it("stores the token, sends it as a bearer token, and caches the question set", async () => {
    const { deps, store, server } = setup({
      "/api/me": ok({ email: "ada@example.com", track: TRACK }),
      "/api/questions": ok({ track: TRACK, questions: [QUESTION] }),
    });
    const state = await connect(deps, TOKEN);
    expect(state).toMatchObject({
      connected: true,
      me: { email: "ada@example.com", track: TRACK },
      stale: false,
    });
    expect(store.data.deviceToken).toBe(TOKEN);
    expect(server.calls).toEqual([
      { path: "/api/me", authorization: `Bearer ${TOKEN}` },
      { path: "/api/questions", authorization: `Bearer ${TOKEN}` },
    ]);
    expect(
      state.connected && state.questions?.questions.map((q) => q.id),
    ).toEqual(["target_user"]);
  });

  it("reuses cached questions until they are old or the track changes", async () => {
    let track = TRACK;
    const { deps, server, advance } = setup({
      "/api/me": () => Response.json({ email: null, track }),
      "/api/questions": () => Response.json({ track, questions: [QUESTION] }),
    });
    await connect(deps, TOKEN);
    await refresh(deps);
    expect(server.calls.map((call) => call.path)).toEqual([
      "/api/me",
      "/api/questions",
      "/api/me",
    ]);
    advance(QUESTIONS_MAX_AGE_MS + 1);
    await refresh(deps);
    expect(server.calls).toHaveLength(5);
    track = { id: "marketer", name: "Marketer" };
    const state = await refresh(deps);
    expect(server.calls).toHaveLength(7);
    expect(state.connected && state.questions?.trackId).toBe("marketer");
  });

  it("rejects a malformed token without calling the server", async () => {
    const { deps, store, server } = setup({});
    expect(await connect(deps, "not-a-token")).toEqual({ connected: false });
    expect(store.data).toEqual({});
    expect(server.calls).toEqual([]);
  });

  it("disconnects when the server answers 401 after a revoke", async () => {
    let revoked = false;
    const { deps, store } = setup({
      "/api/me": () =>
        revoked
          ? new Response(null, { status: 401 })
          : Response.json({ email: "ada@example.com", track: null }),
    });
    await connect(deps, TOKEN);
    expect((await readState(store)).connected).toBe(true);
    revoked = true;
    expect(await refresh(deps)).toEqual({ connected: false });
    expect(store.data).toEqual({});
  });

  it("backs off on 429 and keeps the cache when the server stays busy", async () => {
    let busy = false;
    const { deps, sleeps, server } = setup({
      "/api/me": () =>
        busy
          ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
          : Response.json({ email: "ada@example.com", track: null }),
    });
    await connect(deps, TOKEN);
    busy = true;
    const state = await refresh(deps);
    expect(sleeps).toEqual([2000, 2000]);
    expect(server.calls).toHaveLength(4);
    expect(state).toMatchObject({
      connected: true,
      stale: true,
      me: { email: "ada@example.com" },
    });
  });
});

describe("messages from the web app", () => {
  it("answers a ping and connects only for the web app's origin", async () => {
    const { deps, store } = setup({
      "/api/me": ok({ email: "ada@example.com", track: null }),
    });
    expect(
      await handleExternalMessage(
        deps,
        { type: "triplekeel.ping" },
        `${APP}/connect`,
      ),
    ).toEqual({ ok: true });
    expect(
      await handleExternalMessage(
        deps,
        { type: "triplekeel.connect", token: TOKEN },
        "https://evil.example/connect",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(store.data).toEqual({});
    expect(
      await handleExternalMessage(
        deps,
        { type: "triplekeel.connect", token: TOKEN },
        `${APP}/connect`,
      ),
    ).toEqual({ ok: true, email: "ada@example.com" });
    expect(
      await handleExternalMessage(deps, { type: "other" }, `${APP}/connect`),
    ).toEqual({ ok: false, error: "bad_request" });
  });
});

describe("popupView", () => {
  it("shows the email and track when connected", () => {
    expect(
      popupView(
        {
          connected: true,
          me: { email: "ada@example.com", track: TRACK },
          questions: null,
          stale: false,
        },
        true,
      ),
    ).toMatchObject({
      status: "Connected as ada@example.com",
      track: "Track: Product manager",
      showConnect: false,
    });
  });

  it("offers Connect when not connected", () => {
    expect(popupView({ connected: false }, true)).toMatchObject({
      status: "Not connected.",
      showConnect: true,
    });
  });
});

describe("manifest", () => {
  const base = {
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2k+sDvAmhm5J44DxBX/PQD6vU+dlKpOqfDUbkzvZYXL16C0DymYzJ6BOj+edkN2yZz3ycUl1pg9irwQmzD7xofr4qBhh+/5cpHGkhty7ZQf66zGTsgoBXoDAwPe66OvCsV0Iek/UZOGTgrQ8xWNepEox+4LnJj0oTQ+eFi8Z/5XW2teuxc+z8emyBi2KkArbh2VUO52f+iDMakmhxQOd/Y7CUYEQsArsRoXpcCsXG0TDEaVxLiUS4bZDU7vVMrhInCRBPfqSV9Mzf50nSWxs97GX4G13NMxTULEmv5hKsWkV9X6w6sbXlZZI/BpPptRZBl49si0KhYqb3RcZmy9+NwIDAQAB",
    host_permissions: ["https://claude.ai/*", "https://chatgpt.com/*"],
  };

  it("pins the extension ID", () => {
    expect(extensionIdFromKey(base.key)).toBe(
      "pdnjcggmbannclgepccjfphlfchijfln",
    );
  });

  it("lets only the web app message the extension", () => {
    expect(
      buildManifest(base, "http://localhost:3000").externally_connectable,
    ).toEqual({ matches: ["http://localhost/*"] });
    expect(buildManifest(base, "").externally_connectable).toBeUndefined();
  });

  it("refuses any host beyond claude.ai and chatgpt.com", () => {
    expect(() =>
      buildManifest(
        { ...base, host_permissions: ["https://example.com/*"] },
        APP,
      ),
    ).toThrow("Host not allowed");
  });
});

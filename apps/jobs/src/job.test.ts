import { describe, expect, it } from "vitest";
import { hasWriteErrors, type JobEnv, runDailyJob } from "./job.ts";

// A fake world for one run: Supabase, Exa and the Claude API, all through a
// mocked fetch. Nothing here reaches the network.

const NOW = new Date("2026-11-15T04:17:00.000Z");
const SUPABASE_URL = "http://supabase.test";

const env: JobEnv = {
  EXA_API_KEY: "exa-test-key",
  ANTHROPIC_API_KEY: "anthropic-test-key",
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  KILL_SWITCH: "",
};

const areas = [
  {
    id: "problem_discovery",
    track_id: "product-manager",
    name: "Problem discovery and user research",
    junior_description: "Runs user interviews.",
    mid_description: "Plans their own research.",
    senior_description: "Sets the research agenda.",
    exa_queries: {
      junior: [
        "product managers talking about user interviews and continuous discovery",
      ],
      mid: [
        "product managers talking about user interviews and continuous discovery",
        "mistakes product managers make with user research",
      ],
      senior: ["how senior product managers run user interviews now"],
    },
  },
  {
    id: "eng_design_collab",
    track_id: "product-manager",
    name: "Delivery with engineering and design",
    junior_description: "Runs the backlog.",
    mid_description: "Brings design and engineering in early.",
    senior_description: "Shapes how the teams work together.",
    exa_queries: {
      junior: ["how PMs work with designers"],
      mid: ["product manager and engineering lead relationship"],
      senior: ["how PMs work with designers"],
    },
  },
];

const QUERIES = new Set(
  areas.flatMap((area) => Object.values(area.exa_queries).flat()),
);

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
}

const TRANSCRIPT = `# Episode

- **Podcast:** [Product Talk](https://exa.ai/library/podcast/show)

## Transcript

**Host · 00:00.031–00:23.365**

Welcome back to the show about product work.

**Guest · 61:05.300–96:52.767**

The habit that matters most is a weekly customer interview with the whole team.
`;

type Call = { url: string; method: string; headers: Headers; body: unknown };

type World = {
  calls: Call[];
  rpcBodies: Record<string, unknown>[];
  fetch: typeof fetch;
};

type Options = {
  /** Model response text, per area and kind. */
  modelText?: (areaId: string, kind: string, urls: string[]) => string;
  modelStatus?: number;
  rpcStatus?: number;
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function world(options: Options = {}): World {
  const calls: Call[] = [];
  const rpcBodies: Record<string, unknown>[] = [];
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? "GET";
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : undefined;
    calls.push({ url, method, headers: new Headers(init?.headers), body });

    if (url.startsWith(`${SUPABASE_URL}/rest/v1/tracks`)) {
      return json([{ id: "product-manager", name: "Product manager" }]);
    }
    if (url.startsWith(`${SUPABASE_URL}/rest/v1/skill_areas`)) {
      return json(areas);
    }
    if (url === `${SUPABASE_URL}/rest/v1/rpc/replace_area_picks`) {
      rpcBodies.push(body);
      return json(1, options.rpcStatus ?? 200);
    }
    if (url === "https://api.exa.ai/search") {
      const podcast = Array.isArray(body.includeDomains);
      const id = slug(body.query);
      if (podcast) {
        return json({
          results: [
            {
              id: `https://exa.ai/library/podcast/show/episode/${id}`,
              url: `https://exa.ai/library/podcast/show/episode/${id}`,
              title: `Episode about ${body.query}`,
              publishedDate: "2026-10-12T07:00:00.000Z",
              highlights: [
                "The habit that matters most is a weekly customer interview with the whole team.",
              ],
              text: TRANSCRIPT.slice(0, 120),
            },
            {
              url: `https://exa.ai/library/podcast/show/episode/old-${id}`,
              title: `Old episode about ${body.query}`,
              publishedDate: "2025-01-01T00:00:00.000Z",
              highlights: ["old"],
            },
          ],
        });
      }
      return json({
        results: [
          {
            url: `https://blog.example.com/${id}`,
            title: `Post about ${body.query}`,
            publishedDate: "2026-11-01T00:00:00.000Z",
            highlights: ["A post passage."],
          },
          {
            url: `https://www.blog.example.com/${id}/?utm_source=feed`,
            title: "Duplicate URL",
            publishedDate: "2026-11-01T00:00:00.000Z",
          },
        ],
      });
    }
    if (url === "https://api.exa.ai/contents") {
      return json({
        results: (body.urls as string[]).map((u) => ({
          id: u,
          url: u,
          text: TRANSCRIPT,
        })),
        statuses: [],
      });
    }
    if (url === "https://api.anthropic.com/v1/messages") {
      if (options.modelStatus) {
        return json(
          { type: "error", error: { type: "api_error", message: "x" } },
          options.modelStatus,
        );
      }
      const message: string = body.messages[0].content;
      const data = message.slice(
        message.indexOf("<candidates>") + "<candidates>".length,
        message.lastIndexOf("</candidates>"),
      );
      const candidateUrls = (JSON.parse(data) as { url: string }[]).map(
        (c) => c.url,
      );
      const area = JSON.parse(
        message.slice(
          message.indexOf("<area>") + 6,
          message.indexOf("</area>"),
        ),
      ) as { name: string };
      const areaId = areas.find((a) => a.name === area.name)?.id ?? "";
      const kind = message.includes("Kind: mistake") ? "mistake" : "practice";
      const text = options.modelText
        ? options.modelText(areaId, kind, candidateUrls)
        : JSON.stringify({
            picks: candidateUrls.slice(0, 2).map((u) => ({
              url: u,
              why_line: "Shows a habit a product manager can start this week",
            })),
          });
      return json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5",
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { calls, rpcBodies, fetch: fetchImpl as typeof fetch };
}

const quiet = { now: () => NOW, sleep: async () => {}, log: () => {} };

describe("runDailyJob", () => {
  it("stores picks with a source, a recent date and a podcast timestamp", async () => {
    const w = world();
    const summary = await runDailyJob(env, { ...quiet, fetch: w.fetch });

    expect(summary.status).toBe("done");
    expect(summary.sets).toBe(4);
    expect(summary.setsStored).toBe(4);
    expect(summary.flags).toEqual({});
    expect(hasWriteErrors(summary)).toBe(false);
    expect(w.rpcBodies).toHaveLength(4);

    const kinds = w.rpcBodies.map((b) => `${b.p_area_id}:${b.p_kind}`).sort();
    expect(kinds).toEqual([
      "eng_design_collab:mistake",
      "eng_design_collab:practice",
      "problem_discovery:mistake",
      "problem_discovery:practice",
    ]);
    for (const body of w.rpcBodies) {
      expect(body.p_run_date).toBe("2026-11-15");
      expect(body.p_flag_reason).toBeNull();
      const picks = body.p_picks as Record<string, unknown>[];
      expect(picks.length).toBeGreaterThanOrEqual(1);
      for (const pick of picks) {
        expect(Object.keys(pick).sort()).toEqual([
          "podcast_timestamp_seconds",
          "published_at",
          "publisher",
          "source",
          "title",
          "url",
          "why_line",
        ]);
        const published = new Date(String(pick.published_at));
        expect(NOW.getTime() - published.getTime()).toBeLessThan(
          90 * 86_400_000,
        );
        expect(pick.why_line).toBe(
          "Shows a habit a product manager can start this week.",
        );
      }
      const podcast = picks.find((p) => p.source === "podcast");
      expect(podcast?.podcast_timestamp_seconds).toBe(3665);
      expect(podcast?.publisher).toBe("Product Talk");
      const web = picks.find((p) => p.source === "web");
      expect(web?.podcast_timestamp_seconds).toBeNull();
      expect(web?.publisher).toBe("blog.example.com");
    }
    // 4 sets × (podcast + web search + one transcript call).
    expect(summary.exaCalls).toBe(12);
    expect(summary.anthropicCalls).toBe(4);
    expect(summary.timestampsFound).toBe(4);
  });

  it("drops candidates outside 90 days and repeated URLs", async () => {
    const w = world();
    await runDailyJob(env, { ...quiet, fetch: w.fetch });
    const anthropic = w.calls.filter((c) => c.url.includes("anthropic"));
    for (const call of anthropic) {
      const message: string =
        (call.body as { messages: { content: string }[] }).messages[0]
          ?.content ?? "";
      expect(message).not.toContain("Old episode");
      expect(message).not.toContain("Duplicate URL");
    }
  });

  it("sends only area queries and candidates to Exa and Claude", async () => {
    const w = world();
    await runDailyJob(env, { ...quiet, fetch: w.fetch });

    const exa = w.calls.filter((c) => c.url.startsWith("https://api.exa.ai/"));
    for (const call of exa) {
      const body = call.body as Record<string, unknown>;
      if (call.url.endsWith("/search")) {
        const domainKey =
          "includeDomains" in body ? "includeDomains" : "excludeDomains";
        expect(Object.keys(body).sort()).toEqual(
          [
            "contents",
            domainKey,
            "endPublishedDate",
            "objective",
            "query",
            "startPublishedDate",
            "type",
          ].sort(),
        );
        const fallback = String(body.query).startsWith(
          "mistakes product managers make with",
        );
        expect(QUERIES.has(String(body.query)) || fallback).toBe(true);
      } else {
        expect(Object.keys(body).sort()).toEqual(["text", "urls"]);
        for (const url of body.urls as string[]) {
          expect(url.startsWith("https://exa.ai/library/podcast/")).toBe(true);
        }
      }
      expect(call.headers.get("x-api-key")).toBe("exa-test-key");
    }

    const claude = w.calls.filter(
      (c) => c.url === "https://api.anthropic.com/v1/messages",
    );
    expect(claude).toHaveLength(4);
    for (const call of claude) {
      const body = call.body as {
        model: string;
        messages: { role: string; content: string }[];
        system: string;
      };
      expect(body.model).toBe("claude-haiku-5-5");
      expect(body.messages).toHaveLength(1);
      const message = body.messages[0]?.content ?? "";
      const data = JSON.parse(
        message.slice(
          message.indexOf("<candidates>") + 12,
          message.lastIndexOf("</candidates>"),
        ),
      ) as Record<string, unknown>[];
      for (const item of data) {
        expect(Object.keys(item).sort()).toEqual([
          "highlight",
          "published",
          "publisher",
          "source",
          "title",
          "url",
        ]);
      }
      const area = JSON.parse(
        message.slice(
          message.indexOf("<area>") + 6,
          message.indexOf("</area>"),
        ),
      );
      expect(Object.keys(area).sort()).toEqual([
        "junior",
        "mid",
        "name",
        "senior",
      ]);
    }

    const all = JSON.stringify(w.calls.map((c) => c.body));
    expect(all).not.toMatch(/user_id|clerk|email|signal|prompt_text/i);
  });

  it("sends a new-style service key only as apikey, never as a Bearer token", async () => {
    const w = world();
    await runDailyJob(env, { ...quiet, fetch: w.fetch });
    const supabase = w.calls.filter((c) => c.url.startsWith(SUPABASE_URL));
    expect(supabase.length).toBeGreaterThan(0);
    for (const call of supabase) {
      expect(call.headers.get("apikey")).toBe("sb_secret_test");
      expect(call.headers.get("authorization")).toBeNull();
    }
  });

  it("stops before any call when the kill switch is on", async () => {
    const w = world();
    const summary = await runDailyJob(
      { ...env, KILL_SWITCH: " TRUE " },
      { ...quiet, fetch: w.fetch },
    );
    expect(summary.status).toBe("killed");
    expect(w.calls).toHaveLength(0);
  });

  it("runs when the kill switch is false or empty", async () => {
    const w = world();
    const summary = await runDailyJob(
      { ...env, KILL_SWITCH: "false" },
      { ...quiet, fetch: w.fetch },
    );
    expect(summary.status).toBe("done");
  });

  it("fails without its settings and calls nothing", async () => {
    const w = world();
    await expect(
      runDailyJob({ ...env, EXA_API_KEY: "" }, { ...quiet, fetch: w.fetch }),
    ).rejects.toThrow("missing_config");
    expect(w.calls).toHaveLength(0);
  });

  it("stops cleanly at the caps and flags the rest", async () => {
    const w = world();
    const lines: string[] = [];
    const summary = await runDailyJob(env, {
      ...quiet,
      log: (line) => lines.push(line),
      fetch: w.fetch,
      limits: { exa: 5, anthropic: 1 },
    });
    const exa = w.calls.filter((c) => c.url.startsWith("https://api.exa.ai/"));
    const claude = w.calls.filter((c) => c.url.includes("anthropic"));
    expect(exa.length).toBeLessThanOrEqual(5);
    expect(claude.length).toBeLessThanOrEqual(1);
    expect(summary.exaCalls).toBe(exa.length);
    expect(summary.anthropicCalls).toBe(claude.length);
    expect(summary.setsStored).toBe(1);
    expect(summary.flags.cap_reached).toBe(3);
    expect(w.rpcBodies).toHaveLength(4);
    expect(
      w.rpcBodies.filter((b) => b.p_flag_reason === "cap_reached"),
    ).toHaveLength(3);
    // The log has counts, not content or keys.
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(
      /exa-test-key|anthropic-test-key|sb_secret|Episode|Post about/,
    );
  });

  it("flags an area and kind with no good picks instead of storing weak ones", async () => {
    const w = world({
      modelText: (areaId, kind, urls) =>
        areaId === "eng_design_collab" && kind === "mistake"
          ? '{"picks": []}'
          : JSON.stringify({
              picks: [
                {
                  url: urls[0],
                  why_line: "Explains a practice worth trying this week",
                },
              ],
            }),
    });
    const summary = await runDailyJob(env, { ...quiet, fetch: w.fetch });
    expect(summary.flags).toEqual({ no_good_picks: 1 });
    const flagged = w.rpcBodies.find(
      (b) => b.p_area_id === "eng_design_collab" && b.p_kind === "mistake",
    );
    expect(flagged?.p_picks).toEqual([]);
    expect(flagged?.p_flag_reason).toBe("no_good_picks");
  });

  it("flags instead of storing when the model returns a URL it was not given", async () => {
    const w = world({
      modelText: () =>
        JSON.stringify({
          picks: [
            {
              url: "https://evil.example/x",
              why_line: "Explains a practice worth trying this week",
            },
          ],
        }),
    });
    const summary = await runDailyJob(env, { ...quiet, fetch: w.fetch });
    expect(summary.flags).toEqual({ model_error: 4 });
    expect(summary.errors.model_bad_output).toBe(4);
    expect(
      w.rpcBodies.every((b) => (b.p_picks as unknown[]).length === 0),
    ).toBe(true);
  });

  it("flags when the model call fails", async () => {
    const w = world({ modelStatus: 400 });
    const summary = await runDailyJob(env, { ...quiet, fetch: w.fetch });
    expect(summary.flags).toEqual({ model_error: 4 });
    expect(summary.errors.anthropic_http_400).toBe(4);
  });

  it("reports write failures", async () => {
    const w = world({ rpcStatus: 500 });
    const summary = await runDailyJob(env, { ...quiet, fetch: w.fetch });
    expect(hasWriteErrors(summary)).toBe(true);
    expect(summary.errors.db_supabase_http_500).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildReport,
  computeImportKey,
  LENGTH_BUCKETS,
  lengthBucket,
  parseReport,
  QUESTION_IDS,
  REPORT_SCHEMA_ID,
  toHour,
} from "./index.js";
import { rejectionCases, validReport } from "./rejection-cases.js";

const KEY = "a".repeat(64);

// Rejection tests come first: this is the privacy boundary.
// The cases live in rejection-cases.ts so /api/signals runs the same list.
describe("parseReport rejects", () => {
  it("has the full list of cases", () => {
    expect(rejectionCases().length).toBeGreaterThanOrEqual(70);
  });

  it.each(rejectionCases())("$name", ({ input }) => {
    expect(parseReport(input).ok).toBe(false);
  });
});

describe("parseReport accepts", () => {
  it("a valid live report", () => {
    const result = parseReport(validReport());
    expect(result).toEqual({ ok: true, report: validReport() });
  });

  it("a valid import report with a key", () => {
    const input = { ...validReport(), source: "import", import_key: KEY };
    expect(parseReport(input).ok).toBe(true);
  });

  it("a live report with a key, and p at 0 and 1", () => {
    const input = {
      ...validReport(),
      import_key: KEY,
      answers: [
        { q: "target_user", a: "n/a", p: 0 },
        { q: "problem", a: "partly", p: 1 },
      ],
    };
    expect(parseReport(input).ok).toBe(true);
  });

  it("returns errors without echoing the input values", () => {
    const secret = "my secret prompt text";
    const result = parseReport({
      ...validReport(),
      prompt: secret,
      track: secret,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(result.errors)).not.toContain(secret);
    }
  });
});

describe("toHour", () => {
  it("rounds down to the hour in UTC", () => {
    expect(toHour(new Date("2026-11-14T10:59:59.999Z"))).toBe(
      "2026-11-14T10:00Z",
    );
    expect(toHour(new Date("2026-11-14T12:30:00+02:00"))).toBe(
      "2026-11-14T10:00Z",
    );
  });

  it("rejects an invalid date", () => {
    expect(() => toHour(new Date("nope"))).toThrow();
  });
});

describe("lengthBucket", () => {
  it("maps lengths to buckets, lower bound inclusive", () => {
    expect(lengthBucket(0)).toBe("0-50");
    expect(lengthBucket(49)).toBe("0-50");
    expect(lengthBucket(50)).toBe("50-200");
    expect(lengthBucket(200)).toBe("200-500");
    expect(lengthBucket(499)).toBe("200-500");
    expect(lengthBucket(4999)).toBe("2000-5000");
    expect(lengthBucket(5000)).toBe("5000+");
    expect(lengthBucket(1_000_000)).toBe("5000+");
  });

  it("covers every bucket", () => {
    const seen = new Set([0, 50, 200, 500, 1000, 2000, 5000].map(lengthBucket));
    expect([...seen]).toEqual([...LENGTH_BUCKETS]);
  });

  it("rejects negative and non-integer lengths", () => {
    for (const n of [-1, 1.5, Number.NaN, Infinity]) {
      expect(() => lengthBucket(n)).toThrow();
    }
  });
});

describe("buildReport", () => {
  const input = {
    track: "product-manager",
    app: "claude",
    source: "live",
    scoredAt: new Date("2026-11-14T10:42:13Z"),
    promptLength: 321,
    answers: [
      { q: "success_metric", a: "no", p: 0.8412 },
      { q: "target_user", a: "yes", p: 0.9061 },
    ],
  } as const;

  it("builds a valid report with the hour, bucket and rounded p", () => {
    const report = buildReport(input);
    expect(report).toEqual({
      schema: REPORT_SCHEMA_ID,
      track: "product-manager",
      app: "claude",
      source: "live",
      hour: "2026-11-14T10:00Z",
      length_bucket: "200-500",
      answers: [
        { q: "target_user", a: "yes", p: 0.91 },
        { q: "success_metric", a: "no", p: 0.84 },
      ],
    });
    expect(parseReport(JSON.parse(JSON.stringify(report))).ok).toBe(true);
  });

  it("sorts answers in question ID order", () => {
    const report = buildReport(input);
    expect(report.answers.map((a) => a.q)).toEqual([
      "target_user",
      "success_metric",
    ]);
  });

  it("adds the import key when given", () => {
    const report = buildReport({ ...input, source: "import", importKey: KEY });
    expect(report.import_key).toBe(KEY);
  });

  it("throws on input that would make an invalid report", () => {
    expect(() =>
      buildReport({
        ...input,
        answers: [{ q: "nope", a: "yes", p: 0.5 }],
      } as never),
    ).toThrow();
    expect(() => buildReport({ ...input, source: "import" })).toThrow();
    expect(() => buildReport({ ...input, answers: [] })).toThrow();
  });

  it("doesn't put text in its error messages", () => {
    const secret = "my secret prompt text";
    try {
      buildReport({ ...input, track: secret } as never);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

describe("computeImportKey", () => {
  const message = {
    app: "chatgpt",
    conversationId: "abc-123",
    messageIndex: 4,
  } as const;

  it("returns a 64-character hex hash", async () => {
    const key = await computeImportKey(message);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("abc-123");
  });

  it("is stable for the same message and differs otherwise", async () => {
    const key = await computeImportKey(message);
    expect(await computeImportKey({ ...message })).toBe(key);
    expect(await computeImportKey({ ...message, messageIndex: 5 })).not.toBe(
      key,
    );
    expect(await computeImportKey({ ...message, app: "claude" })).not.toBe(key);
    expect(
      await computeImportKey({ ...message, conversationId: "abc-124" }),
    ).not.toBe(key);
  });

  it("doesn't collide when fields shift between each other", async () => {
    const a = await computeImportKey({
      app: "chatgpt",
      conversationId: "1",
      messageIndex: 23,
    });
    const b = await computeImportKey({
      app: "chatgpt",
      conversationId: "12",
      messageIndex: 3,
    });
    expect(a).not.toBe(b);
  });

  it("rejects bad input", async () => {
    await expect(
      computeImportKey({ ...message, conversationId: "" }),
    ).rejects.toThrow();
    await expect(
      computeImportKey({ ...message, messageIndex: -1 }),
    ).rejects.toThrow();
    await expect(
      computeImportKey({ ...message, messageIndex: 1.5 }),
    ).rejects.toThrow();
  });
});

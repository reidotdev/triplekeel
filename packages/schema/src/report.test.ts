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

const KEY = "a".repeat(64);

function validReport(): Record<string, unknown> {
  return {
    schema: "triplekeel.signal.v1",
    track: "product-manager",
    app: "chatgpt",
    source: "live",
    hour: "2026-11-14T10:00Z",
    length_bucket: "200-500",
    answers: [
      { q: "target_user", a: "yes", p: 0.91 },
      { q: "success_metric", a: "no", p: 0.84 },
    ],
  };
}

// biome-ignore lint/suspicious/noExplicitAny: tests break nested fixtures on purpose.
type Mutable = Record<string, any>;

function rejects(mutate: (r: Mutable) => void): void {
  const report = validReport() as Mutable;
  mutate(report);
  const result = parseReport(report);
  expect(result.ok, JSON.stringify(report)).toBe(false);
}

// Rejection tests come first: this is the privacy boundary.
describe("parseReport rejects", () => {
  it("anything that isn't an object", () => {
    for (const input of [null, undefined, 1, "report", [], [validReport()]]) {
      expect(parseReport(input).ok).toBe(false);
    }
  });

  it("unknown keys at the top level", () => {
    rejects((r) => (r.prompt = "Write a PRD for a todo app"));
    rejects((r) => (r.text = ""));
    rejects((r) => (r.extra = 1));
  });

  it("unknown keys inside an answer", () => {
    rejects((r) => (r.answers[0].evidence = "the user said X"));
    rejects((r) => (r.answers[0].note = 1));
  });

  it("a __proto__ key from JSON", () => {
    const input = JSON.parse(
      JSON.stringify(validReport()).replace("{", '{"__proto__":{"x":1},'),
    );
    expect(parseReport(input).ok).toBe(false);
  });

  it("free-text strings in any field", () => {
    const text = "Write a PRD for a todo app for busy parents";
    rejects((r) => (r.track = text));
    rejects((r) => (r.app = text));
    rejects((r) => (r.source = text));
    rejects((r) => (r.hour = text));
    rejects((r) => (r.length_bucket = text));
    rejects((r) => (r.answers[0].q = text));
    rejects((r) => (r.answers[0].a = text));
    rejects((r) => (r.import_key = text));
  });

  it("strings that aren't allowed enum values", () => {
    rejects((r) => (r.schema = "triplekeel.signal.v2"));
    rejects((r) => (r.track = "Product-Manager"));
    rejects((r) => (r.app = "lovable"));
    rejects((r) => (r.source = "LIVE"));
    rejects((r) => (r.length_bucket = "200-499"));
    rejects((r) => (r.answers[0].q = "made_up"));
    rejects((r) => (r.answers[0].a = "maybe"));
    rejects((r) => (r.answers[0].q = " target_user"));
  });

  it("path-like strings", () => {
    for (const path of [
      "../etc/passwd",
      "/home/user/notes.md",
      "C:\\x",
      "~/x",
    ]) {
      rejects((r) => (r.track = path));
      rejects((r) => (r.answers[0].q = path));
      rejects((r) => (r.import_key = path));
    }
  });

  it("a too-long answers array", () => {
    rejects((r) => {
      r.answers = Array.from({ length: QUESTION_IDS.length + 1 }, (_, i) => ({
        q: QUESTION_IDS[i % QUESTION_IDS.length],
        a: "yes",
        p: 0.5,
      }));
    });
  });

  it("an empty answers array", () => {
    rejects((r) => (r.answers = []));
  });

  it("the same question twice", () => {
    rejects((r) => r.answers.push({ q: "target_user", a: "no", p: 0.5 }));
  });

  it("any missing field", () => {
    for (const key of Object.keys(validReport())) {
      rejects((r) => delete r[key]);
    }
    for (const key of ["q", "a", "p"]) {
      rejects((r) => delete r.answers[0][key]);
    }
  });

  it("p outside 0–1 or not a plain number", () => {
    for (const p of [-0.01, 1.01, 2, "0.5", null, Number.NaN, Infinity]) {
      rejects((r) => (r.answers[0].p = p));
    }
  });

  it("p with more than two decimals", () => {
    rejects((r) => (r.answers[0].p = 0.912345));
  });

  it("an hour that isn't rounded to the hour", () => {
    for (const hour of [
      "2026-11-14T10:30Z",
      "2026-11-14T10:00:00Z",
      "2026-11-14T10:00:00.000Z",
      "2026-11-14T10:00+02:00",
      "2026-11-14",
      "2026-13-01T10:00Z",
      "2026-02-30T10:00Z",
      "2026-11-14T24:00Z",
    ]) {
      rejects((r) => (r.hour = hour));
    }
  });

  it("an import key that isn't a 64-character lowercase hex hash", () => {
    for (const key of [
      "a".repeat(63),
      "a".repeat(65),
      "A".repeat(64),
      "g".repeat(64),
      1,
    ]) {
      rejects((r) => {
        r.source = "import";
        r.import_key = key;
      });
    }
  });

  it("an import report without an import key", () => {
    rejects((r) => (r.source = "import"));
  });

  it("a paste report with an import key", () => {
    rejects((r) => {
      r.source = "paste";
      r.import_key = KEY;
    });
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

// Inputs that must never be accepted as a report. This is the privacy
// boundary, so the same list runs against parseReport() and /api/signals.
import { QUESTION_IDS } from "./questions.ts";

export type RejectionCase = { name: string; input: unknown };

// biome-ignore lint/suspicious/noExplicitAny: cases break nested fixtures on purpose.
type Mutable = Record<string, any>;

const KEY = "a".repeat(64);

/** A valid live report. Each call returns a fresh copy. */
export function validReport(): Record<string, unknown> {
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

/** Every rejection case, as a named input. */
export function rejectionCases(): RejectionCase[] {
  const cases: RejectionCase[] = [];
  const add = (name: string, input: unknown) => {
    cases.push({ name, input });
  };
  const broken = (name: string, mutate: (r: Mutable) => void) => {
    const report = validReport() as Mutable;
    mutate(report);
    add(name, report);
  };

  // Anything that isn't an object.
  add("not an object: null", null);
  add("not an object: undefined", undefined);
  add("not an object: number", 1);
  add("not an object: string", "report");
  add("not an object: empty array", []);
  add("not an object: array of reports", [validReport()]);

  // Unknown keys at the top level.
  broken("unknown top-level key: prompt", (r) => {
    r.prompt = "Write a PRD for a todo app";
  });
  broken("unknown top-level key: empty text", (r) => {
    r.text = "";
  });
  broken("unknown top-level key: number", (r) => {
    r.extra = 1;
  });

  // Unknown keys inside an answer.
  broken("unknown answer key: evidence", (r) => {
    r.answers[0].evidence = "the user said X";
  });
  broken("unknown answer key: number", (r) => {
    r.answers[0].note = 1;
  });

  add(
    "a __proto__ key from JSON",
    JSON.parse(
      JSON.stringify(validReport()).replace("{", '{"__proto__":{"x":1},'),
    ),
  );

  // Free-text strings in any field.
  const text = "Write a PRD for a todo app for busy parents";
  for (const field of ["track", "app", "source", "hour", "length_bucket"]) {
    broken(`free text in ${field}`, (r) => {
      r[field] = text;
    });
  }
  broken("free text in answers.q", (r) => {
    r.answers[0].q = text;
  });
  broken("free text in answers.a", (r) => {
    r.answers[0].a = text;
  });
  broken("free text in import_key", (r) => {
    r.import_key = text;
  });

  // Strings that aren't allowed enum values.
  broken("wrong schema version", (r) => {
    r.schema = "triplekeel.signal.v2";
  });
  broken("wrong-case track", (r) => {
    r.track = "Product-Manager";
  });
  broken("unknown app", (r) => {
    r.app = "lovable";
  });
  broken("wrong-case source", (r) => {
    r.source = "LIVE";
  });
  broken("unknown length bucket", (r) => {
    r.length_bucket = "200-499";
  });
  broken("unknown question", (r) => {
    r.answers[0].q = "made_up";
  });
  broken("unknown answer", (r) => {
    r.answers[0].a = "maybe";
  });
  broken("question with a leading space", (r) => {
    r.answers[0].q = " target_user";
  });

  // Path-like strings.
  for (const path of ["../etc/passwd", "/home/user/notes.md", "C:\\x", "~/x"]) {
    broken(`path ${path} in track`, (r) => {
      r.track = path;
    });
    broken(`path ${path} in answers.q`, (r) => {
      r.answers[0].q = path;
    });
    broken(`path ${path} in import_key`, (r) => {
      r.import_key = path;
    });
  }

  broken("a too-long answers array", (r) => {
    r.answers = Array.from({ length: QUESTION_IDS.length + 1 }, (_, i) => ({
      q: QUESTION_IDS[i % QUESTION_IDS.length],
      a: "yes",
      p: 0.5,
    }));
  });
  broken("an empty answers array", (r) => {
    r.answers = [];
  });
  broken("the same question twice", (r) => {
    r.answers.push({ q: "target_user", a: "no", p: 0.5 });
  });

  // Any missing field.
  for (const key of Object.keys(validReport())) {
    broken(`missing ${key}`, (r) => {
      delete r[key];
    });
  }
  for (const key of ["q", "a", "p"]) {
    broken(`missing answers.${key}`, (r) => {
      delete r.answers[0][key];
    });
  }

  // p outside 0–1 or not a plain number.
  for (const p of [-0.01, 1.01, 2, "0.5", null, Number.NaN, Infinity]) {
    broken(`p is ${typeof p === "string" ? "a string" : String(p)}`, (r) => {
      r.answers[0].p = p;
    });
  }
  broken("p with more than two decimals", (r) => {
    r.answers[0].p = 0.912345;
  });

  // An hour that isn't rounded to the hour.
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
    broken(`hour ${hour}`, (r) => {
      r.hour = hour;
    });
  }

  // An import key that isn't a 64-character lowercase hex hash.
  const badKeys: [string, unknown][] = [
    ["63 characters", "a".repeat(63)],
    ["65 characters", "a".repeat(65)],
    ["uppercase", "A".repeat(64)],
    ["not hex", "g".repeat(64)],
    ["a number", 1],
  ];
  for (const [name, key] of badKeys) {
    broken(`import key: ${name}`, (r) => {
      r.source = "import";
      r.import_key = key;
    });
  }

  broken("an import report without an import key", (r) => {
    r.source = "import";
  });
  broken("a paste report with an import key", (r) => {
    r.source = "paste";
    r.import_key = KEY;
  });

  return cases;
}

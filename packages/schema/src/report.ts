// triplekeel.signal.v1: the only data that leaves the user's browser.
// Every string is an enum or a fixed format, so free text can't get through.
// This is the privacy boundary: when in doubt, reject.
import { z } from "zod";
import {
  type Answer,
  AnswerSchema,
  QUESTION_IDS,
  type QuestionId,
  QuestionIdSchema,
} from "./questions.js";

export const REPORT_SCHEMA_ID = "triplekeel.signal.v1";

/** Track IDs. Each one must have a folder under tracks/. */
export const TRACK_IDS = ["product-manager"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

/**
 * Where the prompt was written. The extension only runs on claude.ai and
 * chatgpt.com. `other` is for prompts pasted on the paste page.
 */
export const APPS = ["chatgpt", "claude", "other"] as const;
export type App = (typeof APPS)[number];

/** Sites the extension can import past chats from. */
export const IMPORT_APPS = ["chatgpt", "claude"] as const;
export type ImportApp = (typeof IMPORT_APPS)[number];

/** `live`: typed now. `import`: a past chat message. `paste`: the paste page. */
export const SOURCES = ["live", "import", "paste"] as const;
export type Source = (typeof SOURCES)[number];

/** Prompt length in characters. Lower bound inclusive, upper bound exclusive. */
export const LENGTH_BUCKETS = [
  "0-50",
  "50-200",
  "200-500",
  "500-1000",
  "1000-2000",
  "2000-5000",
  "5000+",
] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

const BUCKET_LOWER_BOUNDS = [0, 50, 200, 500, 1000, 2000, 5000] as const;

const HOUR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00Z$/;
const IMPORT_KEY_PATTERN = /^[0-9a-f]{64}$/;

function isRealHour(value: string): boolean {
  const match = HOUR_PATTERN.exec(value);
  if (!match) return false;
  const [, y, mo, d, h] = match;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h));
  return (
    date.getUTCFullYear() === +y &&
    date.getUTCMonth() === +mo - 1 &&
    date.getUTCDate() === +d &&
    date.getUTCHours() === +h
  );
}

const HourSchema = z
  .string()
  .regex(HOUR_PATTERN)
  .refine(isRealHour, "must be a real UTC hour, like 2026-11-14T10:00Z");

const ProbabilitySchema = z
  .number()
  .min(0)
  .max(1)
  .refine(
    (p) => Math.round(p * 100) / 100 === p,
    "must have at most 2 decimals",
  );

const ReportAnswerSchema = z
  .object({
    q: QuestionIdSchema,
    a: AnswerSchema,
    p: ProbabilitySchema,
  })
  .strict();

export const ReportSchema = z
  .object({
    schema: z.literal(REPORT_SCHEMA_ID),
    track: z.enum(TRACK_IDS),
    app: z.enum(APPS),
    source: z.enum(SOURCES),
    hour: HourSchema,
    length_bucket: z.enum(LENGTH_BUCKETS),
    answers: z
      .array(ReportAnswerSchema)
      .min(1)
      .max(QUESTION_IDS.length)
      .refine(
        (answers) => new Set(answers.map((a) => a.q)).size === answers.length,
        "each question can appear only once",
      ),
    import_key: z.string().regex(IMPORT_KEY_PATTERN).optional(),
  })
  .strict()
  .superRefine((report, ctx) => {
    if (report.source === "import" && report.import_key === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["import_key"],
        message: "is required for import reports",
      });
    }
    if (report.source === "paste" && report.import_key !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["import_key"],
        message: "is not allowed for paste reports",
      });
    }
  });

export type Report = z.infer<typeof ReportSchema>;
export type ReportAnswer = z.infer<typeof ReportAnswerSchema>;

export type ParseReportResult =
  | { ok: true; report: Report }
  | { ok: false; errors: string[] };

/**
 * Error lines name the field and the problem, never the value or unknown key
 * names, so a rejected report's text is never echoed or logged.
 */
function safeErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    if (issue.code === "unrecognized_keys") return `${path}: unknown keys`;
    if (issue.code === "custom") return `${path}: ${issue.message}`;
    return `${path}: ${issue.code}`;
  });
}

/** For the API. Validates untrusted input. Never throws. */
export function parseReport(input: unknown): ParseReportResult {
  const result = ReportSchema.safeParse(input);
  if (!result.success) return { ok: false, errors: safeErrors(result.error) };
  return { ok: true, report: result.data };
}

/** Rounds a time down to the hour in UTC, like 2026-11-14T10:00Z. */
export function toHour(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("toHour: invalid date");
  return `${date.toISOString().slice(0, 13)}:00Z`;
}

/** Maps a prompt length in characters to its bucket. */
export function lengthBucket(length: number): LengthBucket {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error("lengthBucket: length must be a whole number, 0 or more");
  }
  let index = 0;
  for (let i = 0; i < BUCKET_LOWER_BOUNDS.length; i++) {
    if (length >= BUCKET_LOWER_BOUNDS[i]) index = i;
  }
  return LENGTH_BUCKETS[index];
}

export type BuildReportInput = {
  track: TrackId;
  app: App;
  source: Source;
  /** When the prompt was scored. Rounded down to the hour. */
  scoredAt: Date;
  /** Prompt length in characters. Only its bucket is kept. */
  promptLength: number;
  answers: readonly { q: QuestionId; a: Answer; p: number }[];
  /** From computeImportKey(). Required when source is "import". */
  importKey?: string;
};

/**
 * For the extension and the paste page. Builds and validates a report.
 * Takes the prompt's length, never its text. Throws if the report is invalid.
 */
export function buildReport(input: BuildReportInput): Report {
  const order = new Map<string, number>(QUESTION_IDS.map((id, i) => [id, i]));
  const answers = input.answers
    .map((answer) => ({
      q: answer.q,
      a: answer.a,
      p: Math.round(answer.p * 100) / 100,
    }))
    .sort((x, y) => (order.get(x.q) ?? 0) - (order.get(y.q) ?? 0));

  const report: Record<string, unknown> = {
    schema: REPORT_SCHEMA_ID,
    track: input.track,
    app: input.app,
    source: input.source,
    hour: toHour(input.scoredAt),
    length_bucket: lengthBucket(input.promptLength),
    answers,
  };
  if (input.importKey !== undefined) report.import_key = input.importKey;

  const result = parseReport(report);
  if (!result.ok) {
    throw new Error(`buildReport: invalid report: ${result.errors.join("; ")}`);
  }
  return result.report;
}

export type ImportKeyInput = {
  app: ImportApp;
  /** The site's conversation ID. Hashed on the device, never sent. */
  conversationId: string;
  /** The message's position in the conversation, from 0. */
  messageIndex: number;
};

/**
 * Hashes site + conversation ID + message index with SHA-256 on the device,
 * so scoring the same chat twice doesn't count twice. The result can't be
 * turned back into the conversation ID.
 */
export async function computeImportKey(input: ImportKeyInput): Promise<string> {
  if (!(IMPORT_APPS as readonly string[]).includes(input.app)) {
    throw new Error("computeImportKey: unknown app");
  }
  if (input.conversationId.length === 0 || input.conversationId.length > 200) {
    throw new Error(
      "computeImportKey: conversationId must be 1-200 characters",
    );
  }
  if (!Number.isInteger(input.messageIndex) || input.messageIndex < 0) {
    throw new Error(
      "computeImportKey: messageIndex must be a whole number, 0 or more",
    );
  }
  // JSON keeps the fields apart, so "1"+"23" and "12"+"3" don't collide.
  const material = `triplekeel.import.v1:${JSON.stringify([
    input.app,
    input.conversationId,
    input.messageIndex,
  ])}`;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

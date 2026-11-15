import { z } from "zod";
import {
  ANSWERS,
  AnswerSchema,
  LEVELS,
  POLARITIES,
  QUESTION_IDS_V0,
  QuestionIdSchema,
} from "./questions.ts";

const TrackIdSchema = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
  message: "must be lowercase kebab-case, for example product-manager",
});

const AreaIdSchema = z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, {
  message: "must be lowercase snake_case, for example problem_discovery",
});

const TextSchema = z.string().trim().min(1).max(500);

function unique<T>(items: readonly T[]): boolean {
  return new Set(items).size === items.length;
}

/** tracks/<id>/track.yaml */
export const TrackFileSchema = z
  .object({
    id: TrackIdSchema,
    name: TextSchema,
    levels: z
      .array(z.enum(LEVELS))
      .refine((levels) => levels.join() === LEVELS.join(), {
        message: `must be exactly [${LEVELS.join(", ")}]`,
      }),
    alt_titles: z.array(TextSchema).refine(unique, "must not repeat"),
  })
  .strict();

const AreaLevelSchema = z
  .object({
    description: TextSchema,
    exa_queries: z
      .array(TextSchema)
      .min(3)
      .max(5)
      .refine(unique, "must not repeat"),
  })
  .strict();

const LevelThresholdsSchema = z
  .object({
    junior: z.number().min(0).max(3),
    mid: z.number().min(0).max(3),
    senior: z.number().min(0).max(3),
  })
  .strict()
  .refine(
    ({ junior, mid, senior }) => junior < mid && mid < senior,
    "thresholds must increase from junior to mid to senior",
  );

const SkillAreaSchema = z
  .object({
    id: AreaIdSchema,
    name: TextSchema,
    thresholds: LevelThresholdsSchema,
    levels: z
      .object({
        junior: AreaLevelSchema,
        mid: AreaLevelSchema,
        senior: AreaLevelSchema,
      })
      .strict(),
  })
  .strict();

/** tracks/<id>/skill-areas.yaml */
export const SkillAreasFileSchema = z
  .object({
    areas: z
      .array(SkillAreaSchema)
      .min(1)
      .refine(
        (areas) => unique(areas.map((a) => a.id)),
        "area IDs must be unique",
      ),
  })
  .strict();

const QuestionSchema = z
  .object({
    id: QuestionIdSchema,
    text: TextSchema,
    area: AreaIdSchema,
    polarity: z.enum(POLARITIES),
    answers: z
      .array(AnswerSchema)
      .min(2)
      .max(ANSWERS.length)
      .refine(unique, "must not repeat"),
  })
  .strict();

/** tracks/<id>/questions.yaml */
export const QuestionsFileSchema = z
  .object({
    questions: z
      .array(QuestionSchema)
      .min(1)
      .refine(
        (questions) => unique(questions.map((q) => q.id)),
        "question IDs must be unique",
      ),
  })
  .strict();

export type TrackFile = z.infer<typeof TrackFileSchema>;
export type SkillAreasFile = z.infer<typeof SkillAreasFileSchema>;
export type QuestionsFile = z.infer<typeof QuestionsFileSchema>;
/** One typed question from a track's questions.yaml. */
export type TrackQuestion = z.infer<typeof QuestionSchema>;

export type Track = {
  track: TrackFile;
  skillAreas: SkillAreasFile;
  questions: QuestionsFile;
};

export type TrackInput = {
  /** Folder name under tracks/. */
  folder: string;
  track: unknown;
  skillAreas: unknown;
  questions: unknown;
};

export type TrackCheckResult =
  | { ok: true; track: Track }
  | { ok: false; errors: string[] };

function issues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${file}: ${path}: ${issue.message}`;
  });
}

/**
 * Validates one track's three parsed files and the links between them.
 * Pure: takes already-parsed YAML, so it runs anywhere.
 */
export function checkTrack(input: TrackInput): TrackCheckResult {
  const errors: string[] = [];
  const track = TrackFileSchema.safeParse(input.track);
  const skillAreas = SkillAreasFileSchema.safeParse(input.skillAreas);
  const questions = QuestionsFileSchema.safeParse(input.questions);

  if (!track.success) errors.push(...issues("track.yaml", track.error));
  if (!skillAreas.success) {
    errors.push(...issues("skill-areas.yaml", skillAreas.error));
  }
  if (!questions.success) {
    errors.push(...issues("questions.yaml", questions.error));
  }

  if (track.success && track.data.id !== input.folder) {
    errors.push(
      `track.yaml: id: "${track.data.id}" must match the folder name "${input.folder}"`,
    );
  }

  if (skillAreas.success && questions.success) {
    const areaIds = new Set(skillAreas.data.areas.map((a) => a.id));
    const questionCounts = new Map<string, number>();
    for (const q of questions.data.questions) {
      if (!areaIds.has(q.area)) {
        errors.push(`questions.yaml: ${q.id}: area "${q.area}" does not exist`);
      }
      questionCounts.set(q.area, (questionCounts.get(q.area) ?? 0) + 1);
    }
    for (const area of skillAreas.data.areas) {
      const count = questionCounts.get(area.id) ?? 0;
      if (count < 2) {
        errors.push(
          `skill-areas.yaml: area "${area.id}" has ${count} question${count === 1 ? "" : "s"}; at least 2 are required`,
        );
      }
    }
  }

  if (questions.success) {
    const present = new Set<string>(questions.data.questions.map((q) => q.id));
    for (const id of QUESTION_IDS_V0) {
      if (!present.has(id)) {
        errors.push(`questions.yaml: v0 question "${id}" is missing`);
      }
    }
  }

  if (
    errors.length > 0 ||
    !track.success ||
    !skillAreas.success ||
    !questions.success
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    track: {
      track: track.data,
      skillAreas: skillAreas.data,
      questions: questions.data,
    },
  };
}

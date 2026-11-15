import { describe, expect, it } from "vitest";
import { checkTrack, QUESTION_IDS_V0, type TrackInput } from "./index.js";

const level = (name: string) => ({
  description: `${name} description`,
  exa_queries: [`${name} query`, `${name} practice`, `${name} mistakes`],
});

function validInput(): TrackInput {
  return {
    folder: "test-track",
    track: {
      id: "test-track",
      name: "Test track",
      levels: ["junior", "mid", "senior"],
      alt_titles: ["Tester"],
    },
    skillAreas: {
      areas: [
        {
          id: "area_one",
          name: "Area one",
          thresholds: { junior: 0, mid: 1, senior: 2 },
          levels: {
            junior: level("junior"),
            mid: level("mid"),
            senior: level("senior"),
          },
        },
      ],
    },
    questions: {
      questions: QUESTION_IDS_V0.map((id) => ({
        id,
        text: `Question ${id}?`,
        area: "area_one",
        polarity: "good",
        answers: ["yes", "partly", "no", "n/a"],
      })),
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: tests break nested fixtures on purpose.
type Mutable = Record<string, any>;

function errorsFor(mutate: (input: Mutable) => void): string[] {
  const input = validInput() as Mutable;
  mutate(input);
  const result = checkTrack(input as TrackInput);
  if (result.ok) throw new Error("expected the track to be rejected");
  return result.errors;
}

describe("checkTrack", () => {
  it("accepts a valid track", () => {
    const result = checkTrack(validInput());
    expect(result.ok).toBe(true);
  });

  it("rejects unknown keys in every file", () => {
    expect(errorsFor((i) => (i.track.extra = 1)).join()).toMatch(/track\.yaml/);
    expect(
      errorsFor((i) => (i.skillAreas.areas[0].levels.mid.extra = 1)).join(),
    ).toMatch(/skill-areas\.yaml/);
    expect(
      errorsFor((i) => (i.questions.questions[0].extra = 1)).join(),
    ).toMatch(/questions\.yaml/);
  });

  it("accepts a short card label and rejects a sentence", () => {
    const input = validInput() as Mutable;
    input.questions.questions[0].card_label = "set a success metric";
    expect(checkTrack(input as TrackInput).ok).toBe(true);
    for (const label of ["Set a success metric", "set a metric.", "a\nb", ""]) {
      const errors = errorsFor(
        (i) => (i.questions.questions[0].card_label = label),
      );
      expect(errors.join()).toMatch(/card_label/);
    }
  });

  it("rejects a track ID that doesn't match the folder", () => {
    const errors = errorsFor((i) => (i.folder = "other-track"));
    expect(errors.join()).toMatch(/must match the folder name/);
  });

  it("rejects levels other than junior, mid, senior", () => {
    errorsFor((i) => (i.track.levels = ["junior", "senior"]));
    errorsFor((i) => (i.track.levels = ["mid", "junior", "senior"]));
  });

  it("rejects a missing level in an area", () => {
    errorsFor((i) => delete i.skillAreas.areas[0].levels.senior);
  });

  it("rejects an area with no Exa queries", () => {
    errorsFor((i) => (i.skillAreas.areas[0].levels.junior.exa_queries = []));
  });

  it("rejects an area with fewer than three or more than five Exa queries", () => {
    const tooFew = errorsFor(
      (i) => (i.skillAreas.areas[0].levels.junior.exa_queries = ["one", "two"]),
    );
    expect(tooFew.join()).toMatch(/exa_queries/);
    const tooMany = errorsFor((i) =>
      i.skillAreas.areas[0].levels.junior.exa_queries.push(
        "fourth",
        "fifth",
        "sixth",
      ),
    );
    expect(tooMany.join()).toMatch(/exa_queries/);
  });

  it("rejects thresholds outside the 0–3 scale or out of order", () => {
    const outside = errorsFor(
      (i) => (i.skillAreas.areas[0].thresholds.senior = 4),
    );
    expect(outside.join()).toMatch(/thresholds\.senior/);

    const unordered = errorsFor(
      (i) => (i.skillAreas.areas[0].thresholds.mid = 0),
    );
    expect(unordered.join()).toMatch(/thresholds/);
  });

  it("rejects duplicate area IDs", () => {
    const errors = errorsFor((i) =>
      i.skillAreas.areas.push(structuredClone(i.skillAreas.areas[0])),
    );
    expect(errors.join()).toMatch(/area IDs must be unique/);
  });

  it("rejects a question whose area doesn't exist", () => {
    const errors = errorsFor((i) => (i.questions.questions[0].area = "nope"));
    expect(errors).toContain(
      'questions.yaml: target_user: area "nope" does not exist',
    );
  });

  it("requires at least two questions for every area", () => {
    const input = validInput() as Mutable;
    input.skillAreas.areas.push({
      id: "area_two",
      name: "Area two",
      thresholds: { junior: 0, mid: 1, senior: 2 },
      levels: {
        junior: level("junior"),
        mid: level("mid"),
        senior: level("senior"),
      },
    });
    input.questions.questions[0].area = "area_two";
    const result = checkTrack(input as TrackInput);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContain(
        'skill-areas.yaml: area "area_two" has 1 question; at least 2 are required',
      );
  });

  it("rejects a missing v0 question", () => {
    const errors = errorsFor((i) => i.questions.questions.pop());
    expect(errors).toContain(
      'questions.yaml: v0 question "blind_accept" is missing',
    );
  });

  it("rejects an unknown question ID", () => {
    errorsFor((i) => (i.questions.questions[0].id = "made_up"));
  });

  it("rejects duplicate question IDs", () => {
    const errors = errorsFor((i) =>
      i.questions.questions.push(structuredClone(i.questions.questions[0])),
    );
    expect(errors.join()).toMatch(/question IDs must be unique/);
  });

  it("rejects bad polarity and answers", () => {
    errorsFor((i) => (i.questions.questions[0].polarity = "neutral"));
    errorsFor((i) => (i.questions.questions[0].answers = ["yes", "maybe"]));
    errorsFor((i) => (i.questions.questions[0].answers = ["yes", "yes"]));
    errorsFor((i) => (i.questions.questions[0].answers = ["yes"]));
  });

  it("rejects empty text", () => {
    errorsFor((i) => (i.questions.questions[0].text = "  "));
  });
});

import { describe, expect, it } from "vitest";
import {
  juniorWithGapsMatrix,
  nearlyMidMatrix,
} from "../../src/lib/skill-matrix-fixtures";
import {
  barDescription,
  basedOnText,
  confidenceText,
  formatScore,
  gapText,
  isGapArea,
  levelText,
  markerLabelAlign,
  promptsText,
  scorePercent,
  targetPercent,
} from "./format";

const thresholds = { junior: 0, mid: 1, senior: 2 };

describe("levelText", () => {
  it("shows the score with one decimal and the level", () => {
    expect(levelText(1.8, "junior")).toBe("1.8 · junior");
    expect(levelText(2, "senior")).toBe("2.0 · senior");
  });

  it("rounds down so the text never reaches the next threshold", () => {
    expect(levelText(0.96, "junior")).toBe("0.9 · junior");
    expect(formatScore(1.1)).toBe("1.1");
    expect(formatScore(2.3)).toBe("2.3");
  });

  it("says there isn't enough evidence without a score", () => {
    expect(levelText(null, null)).toBe("Not enough evidence yet");
  });
});

describe("gapText", () => {
  it("names the gap in words", () => {
    expect(gapText(1)).toBe("Gap: 1 level");
    expect(gapText(2)).toBe("Gap: 2 levels");
  });

  it("says when the area is at the target", () => {
    expect(gapText(0)).toBe("At target");
  });

  it("shows nothing without evidence", () => {
    expect(gapText(null)).toBeNull();
  });
});

describe("confidenceText", () => {
  it("uses the documented cut-offs", () => {
    expect(confidenceText(0)).toBe("Low confidence");
    expect(confidenceText(0.39)).toBe("Low confidence");
    expect(confidenceText(0.4)).toBe("Medium confidence");
    expect(confidenceText(0.69)).toBe("Medium confidence");
    expect(confidenceText(0.7)).toBe("High confidence");
    expect(confidenceText(1)).toBe("High confidence");
    expect(confidenceText(null)).toBeNull();
  });
});

describe("prompt counts", () => {
  it("uses the singular for one prompt", () => {
    expect(promptsText(1)).toBe("1 prompt");
    expect(basedOnText(38)).toBe("Based on 38 prompts");
  });
});

describe("bar positions", () => {
  it("places the score on the 0–3 scale", () => {
    expect(scorePercent(0)).toBe(0);
    expect(scorePercent(1.5)).toBe(50);
    expect(scorePercent(3)).toBe(100);
  });

  it("keeps the bar inside the track", () => {
    expect(scorePercent(-1)).toBe(0);
    expect(scorePercent(4)).toBe(100);
  });

  it("puts the target marker where the target level starts", () => {
    expect(targetPercent(thresholds, "junior")).toBe(0);
    expect(targetPercent(thresholds, "mid")).toBeCloseTo(33.33, 2);
    expect(targetPercent(thresholds, "senior")).toBeCloseTo(66.67, 2);
  });

  it("keeps the target label inside the bar", () => {
    expect(markerLabelAlign(0)).toBe("start");
    expect(markerLabelAlign(33.3)).toBe("center");
    expect(markerLabelAlign(95)).toBe("end");
  });
});

describe("areas", () => {
  if (juniorWithGapsMatrix.kind !== "levels") throw new Error("bad fixture");
  if (nearlyMidMatrix.kind !== "levels") throw new Error("bad fixture");
  const [gapArea] = juniorWithGapsMatrix.areas;
  const noEvidence = juniorWithGapsMatrix.areas.at(-1);
  const aboveTarget = nearlyMidMatrix.areas.find((a) => a.level === "senior");

  it("marks only scored areas below the target as gaps", () => {
    expect(isGapArea(gapArea)).toBe(true);
    expect(noEvidence && isGapArea(noEvidence)).toBe(false);
    expect(aboveTarget && isGapArea(aboveTarget)).toBe(false);
  });

  it("describes the bar for screen readers", () => {
    expect(barDescription(gapArea)).toBe(
      "Score 0.4 of 3, junior. Target mid starts at 1.0.",
    );
    expect(noEvidence && barDescription(noEvidence)).toBe(
      "No score yet. Target mid starts at 1.0.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { scorerPlaceholder } from "./index.js";

describe("scorer placeholder", () => {
  it("exports its placeholder", () => {
    expect(scorerPlaceholder).toContain("local scorer");
  });
});

import { describe, expect, it } from "vitest";
import { jobsPlaceholder } from "./index.js";

describe("jobs placeholder", () => {
  it("exports its placeholder", () => {
    expect(jobsPlaceholder).toContain("daily Exa job");
  });
});

import { describe, expect, it } from "vitest";
import { schemaPlaceholder } from "./index.js";

describe("schema placeholder", () => {
  it("names the future report format", () => {
    expect(schemaPlaceholder).toContain("triplekeel.signal.v1");
  });
});

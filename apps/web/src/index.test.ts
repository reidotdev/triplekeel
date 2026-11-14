import { describe, expect, it } from "vitest";
import { webPlaceholder } from "./index.js";

describe("web placeholder", () => {
  it("exports its placeholder", () => {
    expect(webPlaceholder).toContain("web dashboard");
  });
});

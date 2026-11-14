import { describe, expect, it } from "vitest";
import { extensionPlaceholder } from "./index.js";

describe("extension placeholder", () => {
  it("exports its placeholder", () => {
    expect(extensionPlaceholder).toContain("Chrome extension");
  });
});

import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protected-routes";

describe("isProtectedPath", () => {
  it("keeps the privacy notice public", () => {
    expect(isProtectedPath("/privacy")).toBe(false);
  });

  it("keeps the homepage and sign-up public", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-up")).toBe(false);
  });

  it("protects the dashboard", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/skills")).toBe(true);
  });
});

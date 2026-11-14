import { describe, expect, it } from "vitest";
import { isKillSwitchEnabled } from "./kill-switch";

describe("isKillSwitchEnabled", () => {
  it("only enables for a true value, ignoring case and whitespace", () => {
    expect(isKillSwitchEnabled(" true ")).toBe(true);
    expect(isKillSwitchEnabled("TRUE")).toBe(true);
    expect(isKillSwitchEnabled("false")).toBe(false);
    expect(isKillSwitchEnabled(undefined)).toBe(false);
  });
});

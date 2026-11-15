import { describe, expect, it, vi } from "vitest";
import worker from "./index.ts";

describe("jobs Worker", () => {
  it("has a scheduled handler and no fetch handler", () => {
    expect(typeof worker.scheduled).toBe("function");
    expect("fetch" in worker).toBe(false);
  });

  it("does nothing when the kill switch is on", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await worker.scheduled({}, { KILL_SWITCH: "true" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]?.[0]).toContain('"status":"killed"');
    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });
});

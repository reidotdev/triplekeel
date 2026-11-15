import { describe, expect, it, vi } from "vitest";
import {
  ERROR_TEXT,
  KEEL_CHECK_PATH,
  keelCheckErrorText,
  requestKeelCheck,
} from "./request";

function respond(status: number, headers: Record<string, string> = {}) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({}), { status, headers }));
}

describe("requestKeelCheck", () => {
  it("posts to the keel check route", async () => {
    const fetchMock = respond(200);
    expect(await requestKeelCheck(fetchMock)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      KEEL_CHECK_PATH,
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("maps each error status to plain words", async () => {
    const cases: [number, Record<string, string>, string][] = [
      [409, {}, "Finish your profile first."],
      [
        429,
        { "Retry-After": "3600" },
        "You've reached today's keel checks. Try again tomorrow.",
      ],
      [503, {}, "Paused for maintenance."],
      [401, {}, "Couldn't build a keel check. Try again."],
      [500, {}, "Couldn't build a keel check. Try again."],
    ];
    for (const [status, headers, message] of cases) {
      expect(await requestKeelCheck(respond(status, headers))).toEqual({
        ok: false,
        message,
      });
    }
  });

  it("says try again when the request fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await requestKeelCheck(fetchMock)).toEqual({
      ok: false,
      message: ERROR_TEXT.failed,
    });
  });
});

describe("keelCheckErrorText", () => {
  it("falls back to try again for unknown codes", () => {
    expect(keelCheckErrorText(418)).toBe(ERROR_TEXT.failed);
  });
});

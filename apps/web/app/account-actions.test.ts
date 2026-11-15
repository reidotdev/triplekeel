import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE_ACCOUNT_MESSAGES } from "../src/lib/delete-account";

const calls: string[] = [];

const getToken = vi.fn(async () => "clerk-session-token");
const auth = vi.fn();
const deleteUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => auth(),
  clerkClient: async () => ({ users: { deleteUser } }),
}));

const rpc = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const { deleteAccount } = await import("./account-actions");

const USER_ID = "user_2delete";
const EMAIL = "someone@example.com";
const ANON_KEY = "anon-key-for-tests";

function form(confirmation: string | null = "DELETE"): FormData {
  const data = new FormData();
  if (confirmation !== null) data.set("confirmation", confirmation);
  return data;
}

function run(confirmation?: string | null) {
  return deleteAccount({ status: "idle" }, form(confirmation));
}

// A Clerk API error, with the kind of detail that must never be logged.
function clerkError(status: number) {
  return Object.assign(new Error(`Failed to delete ${USER_ID} <${EMAIL}>`), {
    status,
    errors: [
      {
        code: status === 404 ? "resource_not_found" : "internal_clerk_error",
        message: `User ${EMAIL} could not be deleted`,
      },
    ],
  });
}

let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-for-tests");
  calls.length = 0;
  auth.mockResolvedValue({ userId: USER_ID, getToken });
  rpc.mockImplementation(async (name: string) => {
    calls.push(`rpc:${name}`);
    return { data: null, error: null };
  });
  deleteUser.mockImplementation(async (id: string) => {
    calls.push(`clerk:${id}`);
    return { id };
  });
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function expectLogsAreCodesOnly() {
  for (const args of log.mock.calls) {
    expect(args).toHaveLength(2);
    const text = args.join(" ");
    expect(text).not.toContain(USER_ID);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain("DELETE");
  }
}

describe("deleteAccount", () => {
  it("requires a Clerk session", async () => {
    auth.mockResolvedValue({ userId: null, getToken });

    expect(await run()).toEqual({
      status: "error",
      message: DELETE_ACCOUNT_MESSAGES.signedOut,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it.each([null, "", "delete", " DELETE"])(
    "requires the typed confirmation (%j)",
    async (confirmation) => {
      expect(await run(confirmation)).toEqual({
        status: "error",
        message: DELETE_ACCOUNT_MESSAGES.notConfirmed,
      });
      expect(rpc).not.toHaveBeenCalled();
      expect(deleteUser).not.toHaveBeenCalled();
    },
  );

  it("deletes the data first, then the Clerk user", async () => {
    expect(await run()).toEqual({ status: "deleted" });
    expect(calls).toEqual(["rpc:delete_my_data", `clerk:${USER_ID}`]);
    expect(log).not.toHaveBeenCalled();
  });

  it("uses the Clerk session token, never the service role key", async () => {
    await run();

    expect(createClient).toHaveBeenCalledTimes(1);
    const [, key, options] = createClient.mock.calls[0] as [
      string,
      string,
      { accessToken: () => Promise<string | null> },
    ];
    expect(key).toBe(ANON_KEY);
    expect(await options.accessToken()).toBe("clerk-session-token");
  });

  it("keeps the Clerk user when the data can't be deleted", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: `permission denied for ${USER_ID}` },
    });

    expect(await run()).toEqual({
      status: "error",
      message: DELETE_ACCOUNT_MESSAGES.dataFailed,
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Account data deletion failed", "42501");
    expectLogsAreCodesOnly();
  });

  it("handles a thrown database call", async () => {
    rpc.mockRejectedValue(new Error(`fetch failed for ${EMAIL}`));

    expect(await run()).toEqual({
      status: "error",
      message: DELETE_ACCOUNT_MESSAGES.dataFailed,
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expectLogsAreCodesOnly();
  });

  it("says so when Clerk fails after the data is gone", async () => {
    deleteUser.mockRejectedValue(clerkError(500));

    expect(await run()).toEqual({
      status: "error",
      message: DELETE_ACCOUNT_MESSAGES.clerkFailed,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Clerk user deletion failed",
      "internal_clerk_error",
    );
    expectLogsAreCodesOnly();
  });

  it("can run again after a Clerk failure", async () => {
    deleteUser.mockRejectedValueOnce(clerkError(500));
    await run();

    expect(await run()).toEqual({ status: "deleted" });
    expect(calls).toEqual([
      "rpc:delete_my_data",
      "rpc:delete_my_data",
      `clerk:${USER_ID}`,
    ]);
  });

  it("treats a Clerk user that is already gone as deleted", async () => {
    deleteUser.mockRejectedValue(clerkError(404));

    expect(await run()).toEqual({ status: "deleted" });
    expect(log).not.toHaveBeenCalled();
  });
});

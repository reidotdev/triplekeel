// Device rows for the signed-in user. Every call goes through a Supabase
// client that sends the Clerk session token, so row level security applies.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDeviceToken, hashDeviceToken } from "./device-token";

export type DeviceRow = {
  id: string;
  created_at: string;
  revoked_at: string | null;
};

/** A user can have this many active devices. Revoke one to add another. */
export const MAX_ACTIVE_DEVICES = 10;

export type CreateDeviceResult =
  | { ok: true; token: string }
  | { ok: false; error: "too_many_devices" | "failed" };

/**
 * Creates a device for the user and returns its token once. Only the
 * token's hash is stored. The token is never logged.
 */
export async function createDevice(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreateDeviceResult> {
  const { count, error: countError } = await supabase
    .from("devices")
    .select("id", { count: "exact", head: true })
    .is("revoked_at", null);
  if (countError) return { ok: false, error: "failed" };
  if ((count ?? 0) >= MAX_ACTIVE_DEVICES) {
    return { ok: false, error: "too_many_devices" };
  }

  const token = createDeviceToken();
  const { error } = await supabase
    .from("devices")
    .insert({ user_id: userId, token_hash: await hashDeviceToken(token) });
  if (error) {
    console.error("Device create failed", error.code ?? "unknown");
    return { ok: false, error: "failed" };
  }
  return { ok: true, token };
}

export async function listDevices(
  supabase: SupabaseClient,
): Promise<DeviceRow[] | null> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, created_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error || !data) return null;
  return data as DeviceRow[];
}

/** Revokes one of the user's devices. Its next API call gets a 401. */
export async function revokeDevice(
  supabase: SupabaseClient,
  deviceId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: now.toISOString() })
    .eq("id", deviceId)
    .is("revoked_at", null);
  if (error) console.error("Device revoke failed", error.code ?? "unknown");
  return !error;
}

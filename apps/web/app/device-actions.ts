"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  type CreateDeviceResult,
  createDevice,
  revokeDevice,
} from "@/src/lib/devices";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";

/** Creates a device for the signed-in user. The connect page calls this. */
export async function connectDevice(): Promise<CreateDeviceResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "failed" };
  return createDevice(createSupabaseServerClient(), userId);
}

/** Revokes one of the signed-in user's devices. */
export async function revokeDeviceAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  const deviceId = formData.get("deviceId");
  if (!userId || typeof deviceId !== "string") return;
  await revokeDevice(createSupabaseServerClient(), deviceId);
  revalidatePath("/settings/devices");
}

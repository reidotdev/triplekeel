"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ProfileFormState, saveProfile } from "@/src/lib/profile";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";
import { getTrackCatalog } from "@/src/lib/tracks";

async function save(formData: FormData): Promise<ProfileFormState> {
  const { userId } = await auth();
  if (!userId) return { status: "error", message: "Sign in and try again." };
  return saveProfile(
    createSupabaseServerClient(),
    userId,
    formData,
    getTrackCatalog(),
  );
}

/** Saves the sign-up answers, then opens the dashboard. */
export async function completeOnboarding(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const state = await save(formData);
  if (state.status !== "saved") return state;
  redirect("/dashboard");
}

/** Saves profile changes from settings. */
export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const state = await save(formData);
  if (state.status === "saved") revalidatePath("/dashboard");
  return state;
}

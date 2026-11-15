"use server";

// REI-286: deletes the signed-in user's account and all their data.
// 1. public.delete_my_data() deletes the users row through the Clerk-token
//    client. Foreign keys cascade it to every user table. Never the service
//    role key.
// 2. Clerk deletes the sign-in account. Its user.deleted webhook then runs the
//    same delete again, which finds nothing and succeeds.
// Both steps are safe to run again, so after a failure the user just retries.
// This file logs error codes only.
// Relative imports keep the action testable without a path alias.
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  clerkErrorCode,
  DELETE_ACCOUNT_MESSAGES,
  DELETE_CONFIRMATION,
  type DeleteAccountState,
  isClerkNotFound,
} from "../src/lib/delete-account";
import { createSupabaseServerClient } from "../src/lib/supabase-server";

export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { userId } = await auth();
  if (!userId) {
    return { status: "error", message: DELETE_ACCOUNT_MESSAGES.signedOut };
  }
  if (formData.get("confirmation") !== DELETE_CONFIRMATION) {
    return { status: "error", message: DELETE_ACCOUNT_MESSAGES.notConfirmed };
  }

  try {
    const { error } = await createSupabaseServerClient().rpc("delete_my_data");
    if (error) {
      console.error("Account data deletion failed", error.code ?? "unknown");
      return { status: "error", message: DELETE_ACCOUNT_MESSAGES.dataFailed };
    }
  } catch {
    console.error("Account data deletion failed", "unavailable");
    return { status: "error", message: DELETE_ACCOUNT_MESSAGES.dataFailed };
  }

  try {
    await (await clerkClient()).users.deleteUser(userId);
  } catch (error) {
    if (!isClerkNotFound(error)) {
      console.error("Clerk user deletion failed", clerkErrorCode(error));
      return { status: "error", message: DELETE_ACCOUNT_MESSAGES.clerkFailed };
    }
  }

  return { status: "deleted" };
}

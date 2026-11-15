/** The word the user types to confirm that they want to delete their account. */
export const DELETE_CONFIRMATION = "DELETE";

export type DeleteAccountState =
  | { status: "idle" }
  | { status: "deleted" }
  | { status: "error"; message: string };

export const DELETE_ACCOUNT_MESSAGES = {
  signedOut: "Sign in and try again.",
  notConfirmed: `Type ${DELETE_CONFIRMATION} to confirm.`,
  dataFailed: "Couldn't delete your account. Nothing was deleted. Try again.",
  clerkFailed:
    "Your data is deleted, but we couldn't close your sign-in account. Try again.",
} as const;

/**
 * A short code for a failed Clerk API call, safe to log. Clerk errors carry
 * a code such as "resource_not_found" and an HTTP status. Never the message.
 */
export function clerkErrorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { errors, status } = error as {
      errors?: unknown;
      status?: unknown;
    };
    const first = Array.isArray(errors) ? errors[0] : undefined;
    const code =
      first && typeof first === "object"
        ? (first as { code?: unknown }).code
        : undefined;
    if (typeof code === "string" && /^[a-z_]{1,64}$/.test(code)) return code;
    if (typeof status === "number") return `status_${status}`;
  }
  return "unknown";
}

/** Clerk answers 404 when the user is already gone. That counts as done. */
export function isClerkNotFound(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { status?: unknown }).status === 404
  );
}

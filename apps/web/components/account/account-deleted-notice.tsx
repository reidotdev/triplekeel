"use client";

import { useSearchParams } from "next/navigation";

/** Shown on the homepage after an account is deleted. */
export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("account") !== "deleted") return null;
  return (
    <p
      className="mx-auto mt-6 w-fit max-w-[90%] rounded-card border border-[var(--line)] px-4 py-2 text-center text-sm"
      role="status"
    >
      Your account and all its data are deleted.
    </p>
  );
}

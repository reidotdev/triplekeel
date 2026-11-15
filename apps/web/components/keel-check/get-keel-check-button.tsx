"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { requestKeelCheck } from "./request";

export const BUTTON_TEXT = "Get my keel check";
export const PENDING_TEXT = "Building your keel check…";

/**
 * Builds a new card, then refreshes the dashboard so the server renders it.
 * The button stays pending until the refreshed page arrives.
 */
export function GetKeelCheckButton({
  request = requestKeelCheck,
}: {
  /** For tests. */
  request?: () => ReturnType<typeof requestKeelCheck>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPress = () => {
    setError(null);
    startTransition(async () => {
      const result = await request();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      startTransition(() => router.refresh());
    });
  };

  return (
    <div className="grid justify-items-start gap-2 sm:justify-items-end">
      <Button
        className="font-mono font-normal data-[pending]:cursor-wait data-[pending]:opacity-70"
        isPending={isPending}
        onPress={onPress}
      >
        {isPending ? PENDING_TEXT : BUTTON_TEXT}
      </Button>
      <p aria-live="polite" className="text-sm sm:text-right" role="status">
        {error}
      </p>
    </div>
  );
}

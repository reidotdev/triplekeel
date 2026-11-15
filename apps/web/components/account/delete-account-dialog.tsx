"use client";

import { useClerk } from "@clerk/nextjs";
import { useActionState, useEffect, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { Button, Dialog, TextField } from "@/components/ui";
import {
  DELETE_CONFIRMATION,
  type DeleteAccountState,
} from "@/src/lib/delete-account";

type DeleteAccountDialogProps = {
  action: (
    state: DeleteAccountState,
    formData: FormData,
  ) => Promise<DeleteAccountState>;
};

const DELETED_URL = "/?account=deleted";

export function DeleteAccountDialog({ action }: DeleteAccountDialogProps) {
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
  });
  const [typed, setTyped] = useState("");
  const { signOut } = useClerk();
  const isDeleted = state.status === "deleted";

  useEffect(() => {
    if (!isDeleted) return;
    // The Clerk user is gone. Clear the session in this browser too.
    signOut({ redirectUrl: DELETED_URL }).catch(() => {
      window.location.assign(DELETED_URL);
    });
  }, [isDeleted, signOut]);

  return (
    <Dialog title="Delete your account?" trigger="Delete account">
      <form action={formAction} className="grid gap-4">
        <p className="text-sm">This deletes, for good:</p>
        <ul className="m-0 grid list-disc gap-1 pl-5 text-sm">
          <li>your sign-in account</li>
          <li>your profile</li>
          <li>your score reports and levels</li>
          <li>your keel check cards</li>
          <li>your connected devices</li>
        </ul>
        <p className="text-sm">
          The extension disconnects. You can't undo this.
        </p>
        <TextField
          autoComplete="off"
          isDisabled={isPending || isDeleted}
          label={`Type ${DELETE_CONFIRMATION} to confirm`}
          name="confirmation"
          onChange={setTyped}
          value={typed}
        />
        {state.status === "error" ? (
          <p className="text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        {isDeleted ? (
          <p className="text-sm" role="status">
            Account deleted. Signing you out.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <AriaButton
            className="min-h-10 rounded-card border border-border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            isDisabled={isPending || isDeleted}
            slot="close"
          >
            Cancel
          </AriaButton>
          <Button
            isDisabled={typed !== DELETE_CONFIRMATION || isPending || isDeleted}
            type="submit"
          >
            {isPending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

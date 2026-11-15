import { auth } from "@clerk/nextjs/server";
import { deleteAccount } from "@/app/account-actions";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { Card, Link } from "@/components/ui";

export const dynamic = "force-dynamic";

// This page doesn't need a complete profile, so a user can always reach it,
// including to retry after a deletion that only half finished.
export default async function AccountSettingsPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-start gap-8 px-6 py-12">
      <header>
        <p className="text-sm text-muted">Settings</p>
        <h1 className="text-3xl font-semibold">Your account</h1>
        <p className="mt-2 text-sm">
          <Link href="/settings/profile">Profile</Link>
          {" · "}
          <Link href="/settings/devices">Devices</Link>
          {" · "}
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </header>
      <Card className="grid gap-3">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="text-sm">
          Deletes your sign-in account and all your data: your profile, score
          reports, levels, keel check cards and connected devices. The extension
          disconnects. You can't undo this.
        </p>
        <div>
          <DeleteAccountDialog action={deleteAccount} />
        </div>
      </Card>
    </main>
  );
}

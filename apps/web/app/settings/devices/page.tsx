import { auth } from "@clerk/nextjs/server";
import { revokeDeviceAction } from "@/app/device-actions";
import { Button, Card, Link } from "@/components/ui";
import { listDevices } from "@/src/lib/devices";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return `${dateFormat.format(new Date(value))} UTC`;
}

export default async function DevicesPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const devices = await listDevices(createSupabaseServerClient());

  return (
    <main className="mx-auto grid min-h-screen max-w-2xl content-start gap-6 px-6 py-12">
      <header>
        <p className="text-sm text-muted">Settings</p>
        <h1 className="text-3xl font-semibold">Devices</h1>
        <p className="mt-2 text-sm text-muted">
          Browsers connected to your account. A revoked device stops working at
          once.
        </p>
      </header>
      {devices === null ? (
        <Card>
          <p>Couldn't load your devices. Reload the page.</p>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <p>No devices yet.</p>
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {devices.map((device) => (
            <li key={device.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Browser extension</p>
                  <p className="text-sm text-muted">
                    Connected {formatDate(device.created_at)}
                    {device.revoked_at
                      ? `. Revoked ${formatDate(device.revoked_at)}`
                      : ""}
                  </p>
                </div>
                {device.revoked_at ? (
                  <p className="text-sm text-muted">Revoked</p>
                ) : (
                  <form action={revokeDeviceAction}>
                    <input type="hidden" name="deviceId" value={device.id} />
                    <Button type="submit">Revoke</Button>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        <Link href="/connect">Connect this browser</Link>
        {" · "}
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </main>
  );
}

import { auth } from "@clerk/nextjs/server";
import { BrandMark } from "@/components/brand-mark";
import { ConnectExtension } from "@/components/devices/connect-extension";
import { Card, Link } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID?.trim();

  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-start gap-6 px-6 py-12">
      <header>
        <BrandMark />
        <h1 className="text-3xl font-semibold">Connect the extension</h1>
      </header>
      <Card className="grid gap-4">
        {extensionId ? (
          <ConnectExtension extensionId={extensionId} />
        ) : (
          <p>The extension ID isn't set up on this server.</p>
        )}
        <p className="text-sm text-muted">
          This links the browser extension to your account. You can remove it
          any time in <Link href="/settings/devices">devices</Link>.
        </p>
      </Card>
    </main>
  );
}

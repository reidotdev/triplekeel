import { UserButton } from "@clerk/nextjs";
import { Card } from "@/components/ui";

export default function DashboardPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-4xl content-start gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">TripleKeel</p>
          <h1 className="text-3xl font-semibold">Your dashboard</h1>
        </div>
        <UserButton />
      </header>
      <Card>
        <h2 className="text-lg font-semibold">Your practice starts here</h2>
        <p className="mt-2 text-sm text-muted">
          Your skills and weekly suggestions will appear here.
        </p>
      </Card>
    </main>
  );
}

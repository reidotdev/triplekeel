import { Card, Link } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted">TripleKeel</p>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Practice better knowledge work.
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Get a private view of your skills and small suggestions for what to
        practice next.
      </p>
      <Card className="flex flex-wrap items-center gap-3">
        <Link
          href="/sign-up"
          className="inline-flex min-h-10 items-center rounded-card bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex min-h-10 items-center rounded-card border border-border px-4 py-2 text-sm font-medium text-foreground no-underline"
        >
          Sign in
        </Link>
      </Card>
    </main>
  );
}

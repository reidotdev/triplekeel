import { notFound } from "next/navigation";
import { SkillMatrix } from "@/components/skill-matrix";
import { Card } from "@/components/ui";
import { skillMatrixFixtures } from "@/src/lib/skill-matrix-fixtures";

export default function SkillMatrixPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto grid max-w-4xl gap-16 px-4 py-12 sm:px-6">
      <header>
        <p className="text-sm text-muted">Development only</p>
        <h1 className="text-3xl font-semibold">Skill matrix on fake data</h1>
        <nav
          aria-label="Profiles"
          className="mt-3 flex flex-wrap gap-4 text-sm"
        >
          {skillMatrixFixtures.map((fixture) => (
            <a
              className="underline underline-offset-4"
              href={`#${fixture.id}`}
              key={fixture.id}
            >
              {fixture.label}
            </a>
          ))}
        </nav>
      </header>
      {skillMatrixFixtures.map((fixture) => (
        <div
          className="grid scroll-mt-6 gap-4"
          id={fixture.id}
          key={fixture.id}
        >
          <p className="border-b border-dashed border-border pb-2 text-sm text-muted">
            Profile: {fixture.label}
          </p>
          <SkillMatrix
            data={fixture.data}
            keelCheckSlot={
              <Card className="border-dashed text-sm text-muted">
                The keel check card goes here (M3).
              </Card>
            }
          />
        </div>
      ))}
    </main>
  );
}

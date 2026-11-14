// Prints the agreement report when SCORER_REPORT is set, for example:
//   SCORER_REPORT=dev pnpm exec vitest run packages/scorer/eval
//   SCORER_REPORT=all pnpm exec vitest run packages/scorer/eval
// "dev" shows only the tuning set. Look at "all" only once tuning is done.
import { describe, it } from "vitest";
import { agreement } from "./agreement.js";
import { baselineAndRecall } from "./baseline.js";
import { DEV } from "./dev.js";
import { HOLDOUT } from "./holdout.js";

const mode = process.env.SCORER_REPORT;

function print(name: string, rows: typeof DEV, flag: boolean): void {
  const r = agreement(rows, flag);
  const lines = [
    `## ${name}, follow-up flag ${flag ? "given" : "guessed"}: ${r.correct}/${r.total} (${r.percent.toFixed(1)}%)`,
    ...r.perQuestion.map((x) => `  ${x.q.padEnd(18)} ${x.correct}/${x.total}`),
    "  mismatches:",
    ...r.mismatches.map(
      (m) => `    ${m.id} ${m.q}: expected ${m.expected}, got ${m.got}`,
    ),
  ];
  const b = baselineAndRecall(rows);
  if (flag) {
    lines.push(
      `  always-"no" baseline: ${b.alwaysNo.correct}/${b.alwaysNo.total}`,
      `  "yes" labels found: ${b.yes.found}/${b.yes.total}`,
      `  false "yes": ${b.falseYes.count}/${b.falseYes.of}`,
    );
  }
  console.log(lines.join("\n"));
}

describe.runIf(mode)("agreement report", () => {
  it("prints", () => {
    print("dev", DEV, true);
    print("dev", DEV, false);
    if (mode === "all") {
      print("holdout", HOLDOUT, true);
      print("holdout", HOLDOUT, false);
    }
  });
});

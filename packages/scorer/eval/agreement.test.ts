// Regression floors for the keyword scorer's agreement with hand labels.
// The floors sit a few points under the first measured run (2026-11-14), so a
// rule change that makes things clearly worse fails CI. Don't raise a floor by
// tuning rules against holdout.ts.
import { describe, expect, it } from "vitest";
import { agreement } from "./agreement.js";
import { baselineAndRecall } from "./baseline.js";
import { DEV } from "./dev.js";
import { HOLDOUT } from "./holdout.js";

describe("keyword scorer agreement", () => {
  it("stays above its floor on the dev set", () => {
    expect(agreement(DEV, true).percent).toBeGreaterThanOrEqual(88);
  });

  it("stays above its floor on the held-out set", () => {
    expect(agreement(HOLDOUT, true).percent).toBeGreaterThanOrEqual(90);
  });

  it("beats always answering 'no' on the held-out set", () => {
    const a = agreement(HOLDOUT, true);
    const b = baselineAndRecall(HOLDOUT);
    expect(a.correct).toBeGreaterThan(b.alwaysNo.correct);
    expect(b.yes.found / b.yes.total).toBeGreaterThanOrEqual(0.85);
  });
});

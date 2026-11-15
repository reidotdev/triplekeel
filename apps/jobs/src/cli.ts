// Runs the daily job once from Node, with the same code as the Worker.
// The manual GitHub workflow (.github/workflows/daily-job.yml) uses it:
//
//   node apps/jobs/src/cli.ts
//
// Needs EXA_API_KEY, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY and
// SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). KILL_SWITCH=true stops it.
// Prints counts only.
import { errorCode } from "./context.ts";
import { hasWriteErrors, runDailyJob } from "./job.ts";

try {
  const summary = await runDailyJob({
    EXA_API_KEY: process.env.EXA_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL:
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    KILL_SWITCH: process.env.KILL_SWITCH,
  });
  if (hasWriteErrors(summary)) process.exitCode = 1;
} catch (error) {
  console.error(`Daily job failed: ${errorCode(error)}`);
  process.exitCode = 1;
}

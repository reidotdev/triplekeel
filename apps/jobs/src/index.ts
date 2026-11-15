// The jobs Worker. It has no fetch handler, so nothing on the web can start
// the job. The daily Cron Trigger in wrangler.jsonc runs it.
import { hasWriteErrors, type JobEnv, runDailyJob } from "./job.ts";

export default {
  async scheduled(_controller: unknown, env: JobEnv): Promise<void> {
    const summary = await runDailyJob(env);
    // A failed write marks the cron run as failed in Workers Observability.
    if (hasWriteErrors(summary)) throw new Error("daily_job_write_failed");
  },
};

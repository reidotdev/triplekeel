// The daily job: for each skill area and kind, search Exa for recent podcast
// episodes and web posts, let Claude Haiku pick the best, and store them.
// The Worker's cron and the manual GitHub workflow both call runDailyJob.
//
// Only area names, descriptions and queries go to Exa and Claude. The job
// never reads user data. Logs hold counts and error codes only.
import { dedupeCandidates, toCandidates } from "./candidates.ts";
import { CONCURRENCY, MAX_ANTHROPIC_CALLS, MAX_EXA_CALLS } from "./config.ts";
import { Budget, errorCode, JobError, type RunContext } from "./context.ts";
import { exaSearch, exaTranscripts } from "./exa.ts";
import { askHaiku, createClient, type ModelPick } from "./haiku.ts";
import { buildAreaPlans, buildSearchRequest, windowStart } from "./queries.ts";
import {
  loadCatalog,
  replaceAreaPicks,
  type SupabaseConfig,
} from "./supabase.ts";
import { findHighlightTimestamp } from "./transcript.ts";
import type {
  AreaPlan,
  Candidate,
  FlagReason,
  Source,
  StoredPick,
} from "./types.ts";

export type JobEnv = {
  EXA_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  KILL_SWITCH?: string;
};

export type JobDeps = {
  fetch?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  limits?: { exa: number; anthropic: number };
};

export type JobSummary = {
  status: "done" | "killed";
  runDate: string;
  sets: number;
  setsStored: number;
  picksStored: number;
  podcastPicks: number;
  timestampsFound: number;
  flags: Partial<Record<FlagReason, number>>;
  exaCalls: number;
  anthropicCalls: number;
  errors: Record<string, number>;
};

/** Same rule as apps/web/src/lib/kill-switch.ts: on when "true". */
export function isKillSwitchEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

type SetResult =
  | { picks: StoredPick[]; flag: null }
  | { picks: []; flag: FlagReason };

type Keys = { exa: string; anthropic: string };

export async function runDailyJob(
  env: JobEnv,
  deps: JobDeps = {},
): Promise<JobSummary> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? ((line: string) => console.log(line));
  const runDate = now.toISOString().slice(0, 10);
  const summary: JobSummary = {
    status: "done",
    runDate,
    sets: 0,
    setsStored: 0,
    picksStored: 0,
    podcastPicks: 0,
    timestampsFound: 0,
    flags: {},
    exaCalls: 0,
    anthropicCalls: 0,
    errors: {},
  };

  if (isKillSwitchEnabled(env.KILL_SWITCH)) {
    summary.status = "killed";
    log(JSON.stringify({ event: "daily_job", ...summary }));
    return summary;
  }

  const missing = (
    [
      "EXA_API_KEY",
      "ANTHROPIC_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ] as const
  ).filter((name) => !env[name]);
  if (missing.length > 0) {
    log(
      JSON.stringify({
        event: "daily_job_failed",
        code: "missing_config",
        missing,
      }),
    );
    throw new JobError("missing_config");
  }
  const keys: Keys = {
    exa: env.EXA_API_KEY as string,
    anthropic: env.ANTHROPIC_API_KEY as string,
  };
  const supabase: SupabaseConfig = {
    url: env.SUPABASE_URL as string,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
  };

  const budget = new Budget(
    deps.limits ?? { exa: MAX_EXA_CALLS, anthropic: MAX_ANTHROPIC_CALLS },
  );
  const fetchImpl = deps.fetch ?? ((input, init) => fetch(input, init));
  const ctx: RunContext = {
    fetch: fetchImpl,
    sleep:
      deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    budget,
    now,
    count: (code) => {
      summary.errors[code] = (summary.errors[code] ?? 0) + 1;
    },
  };
  const finish = () => {
    summary.exaCalls = budget.used.exa;
    summary.anthropicCalls = budget.used.anthropic;
  };

  let plans: AreaPlan[];
  try {
    // This read, and the writes below, are the daily database request that
    // ADR-0013 relies on to keep the Free project from pausing.
    plans = buildAreaPlans(await loadCatalog(ctx, supabase));
  } catch (error) {
    const code = errorCode(error);
    log(JSON.stringify({ event: "daily_job_failed", code: `catalog_${code}` }));
    throw new JobError(`catalog_${code}`);
  }
  summary.sets = plans.length;
  const client = createClient(keys.anthropic, fetchImpl);

  await mapLimit(plans, CONCURRENCY, async (plan) => {
    let result: SetResult;
    try {
      result = await pickForPlan(ctx, keys, client, plan, summary);
    } catch (error) {
      ctx.count(errorCode(error));
      result = { picks: [], flag: "model_error" };
    }
    try {
      await replaceAreaPicks(ctx, supabase, {
        runDate,
        trackId: plan.trackId,
        areaId: plan.areaId,
        kind: plan.kind,
        picks: result.picks,
        flag: result.flag,
      });
    } catch (error) {
      ctx.count(`db_${errorCode(error)}`);
      return;
    }
    if (result.flag) {
      summary.flags[result.flag] = (summary.flags[result.flag] ?? 0) + 1;
    } else {
      summary.setsStored += 1;
      summary.picksStored += result.picks.length;
    }
  });

  finish();
  log(JSON.stringify({ event: "daily_job", ...summary }));
  return summary;
}

/** True when any area and kind failed to save. */
export function hasWriteErrors(summary: JobSummary): boolean {
  return Object.keys(summary.errors).some((code) => code.startsWith("db_"));
}

async function pickForPlan(
  ctx: RunContext,
  keys: Keys,
  client: ReturnType<typeof createClient>,
  plan: AreaPlan,
  summary: JobSummary,
): Promise<SetResult> {
  const window = { start: windowStart(ctx.now), end: ctx.now };
  const found: Candidate[] = [];
  let searched = 0;
  let capped = false;
  // Podcasts first, then posts and talks from the web.
  for (const source of ["podcast", "web"] as const satisfies Source[]) {
    try {
      const results = await exaSearch(
        ctx,
        keys.exa,
        buildSearchRequest(plan, source, ctx.now),
      );
      found.push(...toCandidates(results, source, window));
      searched += 1;
    } catch (error) {
      const code = errorCode(error);
      if (code === "exa_cap_reached") capped = true;
      else ctx.count(code);
    }
  }
  if (searched === 0) {
    return { picks: [], flag: capped ? "cap_reached" : "search_error" };
  }
  const candidates = dedupeCandidates(found);
  if (candidates.length === 0) return { picks: [], flag: "no_candidates" };

  if (!ctx.budget.take("anthropic")) return { picks: [], flag: "cap_reached" };
  let chosen: ModelPick[];
  try {
    chosen = await askHaiku(client, plan, candidates);
  } catch (error) {
    ctx.count(errorCode(error));
    return { picks: [], flag: "model_error" };
  }
  if (chosen.length === 0) return { picks: [], flag: "no_good_picks" };

  const byUrl = new Map(candidates.map((c) => [c.url, c]));
  const picked = chosen.flatMap((pick) => {
    const candidate = byUrl.get(pick.url);
    return candidate ? [{ candidate, why: pick.why_line }] : [];
  });
  const transcripts = await podcastTranscripts(
    ctx,
    keys,
    picked.map((p) => p.candidate),
  );

  const picks = picked.map(({ candidate, why }): StoredPick => {
    let seconds: number | null = null;
    if (candidate.source === "podcast") {
      summary.podcastPicks += 1;
      const text = transcripts.get(candidate.url);
      seconds =
        text && candidate.highlight
          ? findHighlightTimestamp(text, candidate.highlight)
          : null;
      if (seconds !== null) summary.timestampsFound += 1;
    }
    return {
      title: candidate.title,
      url: candidate.url,
      publisher: candidate.publisher,
      published_at: candidate.publishedAt,
      podcast_timestamp_seconds: seconds,
      source: candidate.source,
      why_line: why,
    };
  });
  return { picks, flag: null };
}

/** Full text only for the podcast picks kept, in one call. */
async function podcastTranscripts(
  ctx: RunContext,
  keys: Keys,
  picked: readonly Candidate[],
): Promise<Map<string, string>> {
  const urls = picked
    .filter((candidate) => candidate.source === "podcast")
    .map((candidate) => candidate.url);
  if (urls.length === 0) return new Map();
  try {
    return await exaTranscripts(ctx, keys.exa, urls);
  } catch (error) {
    // Picks are still stored, without a timestamp.
    ctx.count(
      errorCode(error) === "exa_cap_reached"
        ? "timestamps_capped"
        : `transcript_${errorCode(error)}`,
    );
    return new Map();
  }
}

async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next] as T;
        next += 1;
        await run(item);
      }
    },
  );
  await Promise.all(workers);
}

// Exa `/search` and `/contents` over fetch. Every attempt counts against the
// run's Exa cap.
import { z } from "zod";
import { EXA_BASE_URL } from "./config.ts";
import { JobError, type RunContext } from "./context.ts";

const ExaResultSchema = z.object({
  id: z.string().nullish(),
  url: z.string(),
  title: z.string().nullish(),
  publishedDate: z.string().nullish(),
  highlights: z.array(z.string()).nullish(),
  text: z.string().nullish(),
});

export type ExaResult = z.infer<typeof ExaResultSchema>;

const ExaResponseSchema = z.object({ results: z.array(ExaResultSchema) });

const TIMEOUT_MS = 30_000;

async function exaPost(
  ctx: RunContext,
  apiKey: string,
  path: "/search" | "/contents",
  body: Record<string, unknown>,
): Promise<ExaResult[]> {
  for (let attempt = 1; ; attempt++) {
    if (!ctx.budget.take("exa")) throw new JobError("exa_cap_reached");
    const response = await ctx.fetch(`${EXA_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      const parsed = ExaResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new JobError("exa_bad_response");
      return parsed.data.results;
    }
    // Retry once on rate limits and server errors.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 2 || !ctx.budget.has("exa")) {
      throw new JobError(`exa_http_${response.status}`);
    }
    await ctx.sleep(2000);
  }
}

export function exaSearch(
  ctx: RunContext,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<ExaResult[]> {
  return exaPost(ctx, apiKey, "/search", body);
}

/** Full transcripts for the podcast picks, by URL. Missing ones are left out. */
export async function exaTranscripts(
  ctx: RunContext,
  apiKey: string,
  urls: readonly string[],
): Promise<Map<string, string>> {
  const results = await exaPost(ctx, apiKey, "/contents", {
    urls,
    text: true,
  });
  const byUrl = new Map<string, string>();
  for (const result of results) {
    if (!result.text) continue;
    byUrl.set(result.url, result.text);
    if (result.id) byUrl.set(result.id, result.text);
  }
  return byUrl;
}

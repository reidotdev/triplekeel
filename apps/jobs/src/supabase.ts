// Supabase REST calls with the service-role key. New-style keys
// (sb_secret_...) are not JWTs and the API rejects them as a Bearer token, so
// they go only in `apikey`. Legacy JWT keys also go in `Authorization`, like
// supabase-js does.
import { z } from "zod";
import { JobError, type RunContext } from "./context.ts";
import type {
  CatalogArea,
  FlagReason,
  Kind,
  Level,
  StoredPick,
} from "./types.ts";

export type SupabaseConfig = { url: string; serviceRoleKey: string };

export function isJwt(key: string): boolean {
  return key.split(".").length === 3 && key.startsWith("eyJ");
}

export function supabaseHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    "content-type": "application/json",
  };
  if (isJwt(key)) headers.authorization = `Bearer ${key}`;
  return headers;
}

async function rest(
  ctx: RunContext,
  config: SupabaseConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  const response = await ctx.fetch(
    `${config.url.replace(/\/+$/, "")}/rest/v1/${path}`,
    {
      method: init.method,
      headers: supabaseHeaders(config.serviceRoleKey),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new JobError(`supabase_http_${response.status}`);
  return response.json();
}

const QueriesSchema = z.object({
  junior: z.array(z.string()),
  mid: z.array(z.string()),
  senior: z.array(z.string()),
});

const AreaRowSchema = z.object({
  id: z.string(),
  track_id: z.string(),
  name: z.string(),
  junior_description: z.string(),
  mid_description: z.string(),
  senior_description: z.string(),
  exa_queries: QueriesSchema,
});

const TrackRowSchema = z.object({ id: z.string(), name: z.string() });

/** Every skill area with its track name and Exa queries. */
export async function loadCatalog(
  ctx: RunContext,
  config: SupabaseConfig,
): Promise<CatalogArea[]> {
  const tracks = z.array(TrackRowSchema).safeParse(
    await rest(ctx, config, "tracks?select=id,name&order=id.asc", {
      method: "GET",
    }),
  );
  const areas = z
    .array(AreaRowSchema)
    .safeParse(
      await rest(
        ctx,
        config,
        "skill_areas?select=id,track_id,name,junior_description,mid_description,senior_description,exa_queries&order=track_id.asc,id.asc",
        { method: "GET" },
      ),
    );
  if (!tracks.success || !areas.success) {
    throw new JobError("catalog_bad_response");
  }
  const names = new Map(tracks.data.map((track) => [track.id, track.name]));
  return areas.data.flatMap((row) => {
    const trackName = names.get(row.track_id);
    if (!trackName) return [];
    const descriptions: Record<Level, string> = {
      junior: row.junior_description,
      mid: row.mid_description,
      senior: row.senior_description,
    };
    return [
      {
        trackId: row.track_id,
        trackName,
        areaId: row.id,
        areaName: row.name,
        descriptions,
        exaQueries: row.exa_queries,
      },
    ];
  });
}

/** Stores one area and kind's picks, or a flag when `picks` is empty. */
export async function replaceAreaPicks(
  ctx: RunContext,
  config: SupabaseConfig,
  args: {
    runDate: string;
    trackId: string;
    areaId: string;
    kind: Kind;
    picks: readonly StoredPick[];
    flag: FlagReason | null;
  },
): Promise<void> {
  await rest(ctx, config, "rpc/replace_area_picks", {
    method: "POST",
    body: {
      p_run_date: args.runDate,
      p_track_id: args.trackId,
      p_area_id: args.areaId,
      p_kind: args.kind,
      p_picks: args.picks,
      p_flag_reason: args.picks.length > 0 ? null : args.flag,
    },
  });
}

// Syncs the track catalog (tracks, skill areas, questions) from tracks/ into a
// Supabase database. Node 22 runs this TypeScript file directly.
//
//   node scripts/sync-catalog.mts               upsert, then check
//   node scripts/sync-catalog.mts --check       check only, change nothing
//   node scripts/sync-catalog.mts --write-seed  regenerate supabase/seed.sql
//
// Sync needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The check
// reads with NEXT_PUBLIC_SUPABASE_ANON_KEY, like the extension does.
// Nothing secret is printed.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildCatalog,
  type Catalog,
  catalogSeedSql,
} from "../packages/schema/src/catalog.ts";
import { loadAllTracks } from "../packages/schema/src/track-files.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const catalog = buildCatalog(loadAllTracks(`${root}tracks`));
const mode = process.argv[2] ?? "--sync";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function rest(path: string, key: string, init?: RequestInit) {
  const url = `${env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${path}`;
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  return fetch(url, { ...init, headers });
}

async function sync(): Promise<void> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  // Retry briefly: right after `db push` the API may not know the function yet.
  for (let attempt = 1; ; attempt++) {
    const response = await rest("rpc/sync_track_catalog", key, {
      method: "POST",
      body: JSON.stringify({ p_catalog: catalog }),
    });
    if (response.ok) {
      console.log("Synced:", JSON.stringify(await response.json()));
      return;
    }
    const body = await response.text();
    if (attempt >= 5 || !body.includes("PGRST202")) {
      console.error(`Sync failed with HTTP ${response.status}: ${body}`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
  }
}

type Row = Record<string, unknown>;

async function select(table: string, columns: string): Promise<Row[]> {
  const response = await rest(
    `${table}?select=${columns}&order=id`,
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
  if (!response.ok) {
    console.error(`Reading ${table} failed with HTTP ${response.status}`);
    process.exit(1);
  }
  return (await response.json()) as Row[];
}

/** JSON with sorted keys, so jsonb key order doesn't matter. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function byId(rows: Row[]): Map<string, string> {
  return new Map(rows.map((row) => [String(row.id), canonical(row)]));
}

/** Lists every row in tracks/ that the database lacks or has different. */
function diff(table: string, expected: Row[], actual: Row[]): string[] {
  const have = byId(actual);
  const problems: string[] = [];
  for (const [id, row] of byId(expected)) {
    const found = have.get(id);
    if (!found) problems.push(`${table}.${id}: missing in the database`);
    else if (found !== row) {
      problems.push(`${table}.${id}: differs\n  want ${row}\n  have ${found}`);
    }
  }
  return problems;
}

async function check(expected: Catalog): Promise<void> {
  const tracks = expected.tracks.map(({ id, name, alt_titles }) => ({
    id,
    name,
    alt_titles,
  }));
  const areas = expected.tracks.flatMap((track) =>
    track.areas.map((area) => ({ ...area, track_id: track.id })),
  );
  const questions = expected.tracks.flatMap((track) =>
    track.questions.map((question) => ({ ...question, track_id: track.id })),
  );
  const read = (table: string, like: Row[]) =>
    select(table, Object.keys(like[0] ?? { id: 1 }).join(","));
  const problems = [
    ...diff("tracks", tracks, await read("tracks", tracks)),
    ...diff("skill_areas", areas, await read("skill_areas", areas)),
    ...diff("questions", questions, await read("questions", questions)),
  ];
  if (problems.length > 0) {
    console.error(
      `The database catalog does not match tracks/:\n${problems.join("\n")}`,
    );
    process.exit(1);
  }
  console.log(
    `Catalog matches tracks/: ${tracks.length} tracks, ${areas.length} areas, ${questions.length} questions.`,
  );
}

if (mode === "--write-seed") {
  writeFileSync(`${root}supabase/seed.sql`, catalogSeedSql(catalog));
  console.log("Wrote supabase/seed.sql");
} else if (mode === "--check") {
  await check(catalog);
} else if (mode === "--sync") {
  await sync();
  await check(catalog);
} else {
  console.error(`Unknown option ${mode}`);
  process.exit(1);
}

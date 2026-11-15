// The database catalog: what public.sync_track_catalog(p_catalog jsonb)
// expects. Pure, so it runs anywhere. Area thresholds are not stored in the
// database yet, so they are left out.
import type { Track } from "./track.ts";

export type CatalogArea = {
  id: string;
  name: string;
  junior_description: string;
  mid_description: string;
  senior_description: string;
  exa_queries: { junior: string[]; mid: string[]; senior: string[] };
};

export type CatalogQuestion = {
  id: string;
  area_id: string;
  question_text: string;
  polarity: "good" | "bad";
  answers: string[];
};

export type CatalogTrack = {
  id: string;
  name: string;
  alt_titles: string[];
  areas: CatalogArea[];
  questions: CatalogQuestion[];
};

export type Catalog = { tracks: CatalogTrack[] };

/** Builds the sync payload from validated tracks, in file order. */
export function buildCatalog(tracks: readonly Track[]): Catalog {
  return {
    tracks: tracks.map(({ track, skillAreas, questions }) => ({
      id: track.id,
      name: track.name,
      alt_titles: [...track.alt_titles],
      areas: skillAreas.areas.map((area) => ({
        id: area.id,
        name: area.name,
        junior_description: area.levels.junior.description,
        mid_description: area.levels.mid.description,
        senior_description: area.levels.senior.description,
        exa_queries: {
          junior: [...area.levels.junior.exa_queries],
          mid: [...area.levels.mid.exa_queries],
          senior: [...area.levels.senior.exa_queries],
        },
      })),
      questions: questions.questions.map((question) => ({
        id: question.id,
        area_id: question.area,
        question_text: question.text,
        polarity: question.polarity,
        answers: [...question.answers],
      })),
    })),
  };
}

const SEED_TAG = "$catalog$";

/** The generated supabase/seed.sql. `supabase db reset` runs it. */
export function catalogSeedSql(catalog: Catalog): string {
  const json = JSON.stringify(catalog, null, 2);
  if (json.includes(SEED_TAG)) {
    throw new Error(`Track text must not contain ${SEED_TAG}`);
  }
  return [
    "-- Generated from tracks/ by `node scripts/sync-catalog.mts --write-seed`.",
    "-- Do not edit by hand. A test fails when this file is out of date.",
    "-- Production gets the same catalog from the deploy job (REI-311).",
    `select public.sync_track_catalog(${SEED_TAG}${json}${SEED_TAG}::jsonb);`,
    "",
  ].join("\n");
}

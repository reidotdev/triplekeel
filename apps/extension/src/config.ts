// The build replaces these names with values from the environment
// (scripts/build.mjs). No domain is written in the source.
declare const __TRIPLEKEEL_API_BASE__: string | undefined;
declare const __TRIPLEKEEL_APP_URL__: string | undefined;

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/** Base URL for API calls, from the `TRIPLEKEEL_API_BASE` build variable. */
export const API_BASE = clean(
  typeof __TRIPLEKEEL_API_BASE__ === "string" ? __TRIPLEKEEL_API_BASE__ : "",
);

/** Web app URL, from `APP_URL` at build time. Defaults to the API base. */
export const APP_URL =
  clean(
    typeof __TRIPLEKEEL_APP_URL__ === "string" ? __TRIPLEKEEL_APP_URL__ : "",
  ) || API_BASE;

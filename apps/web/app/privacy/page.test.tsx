import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";

const html = renderToStaticMarkup(<PrivacyPage />);
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

function headings(level: "h1" | "h2"): string[] {
  const pattern = new RegExp(`<${level}[^>]*>(.*?)</${level}>`, "g");
  return [...html.matchAll(pattern)].map((match) =>
    match[1].replace(/<[^>]+>/g, ""),
  );
}

describe("privacy page", () => {
  it("has a heading for each required section", () => {
    expect(headings("h1")).toEqual(["Privacy notice"]);
    expect(headings("h2")).toEqual(
      expect.arrayContaining([
        "What the extension reads",
        "What leaves your browser",
        "What we store",
        "Who processes data",
        "Personal only",
        "Delete your account",
        "Open source",
      ]),
    );
  });

  it("links to the repo", () => {
    expect(html).toContain('href="https://github.com/reidotdev/triplekeel"');
  });

  it("shows the last updated date", () => {
    expect(html).toContain('dateTime="2026-11-15"');
  });

  it("names every processor", () => {
    for (const name of [
      "Clerk",
      "Supabase",
      "Cloudflare",
      "Exa",
      "Anthropic",
    ]) {
      expect(text).toContain(name);
    }
  });

  it("lists the report fields and the 20-message cap", () => {
    expect(text).toContain("up to the last 20");
    expect(text).toContain("the hour it was scored");
    expect(text).toContain("a length bucket");
    expect(text).toContain("an import key");
  });
});

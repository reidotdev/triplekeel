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

  it("explains how to delete an account and what goes", () => {
    expect(html).toContain('href="/settings/account"');
    expect(text).toContain("Delete account");
    expect(text).not.toContain("There is no delete button yet");
    expect(text).toContain("your profile, score reports and levels");
    expect(text).toContain("your connected devices");
    expect(text).toContain("your sign-in account at Clerk");
    expect(text).toContain("The extension disconnects");
  });

  it("describes live capture as shipped", () => {
    expect(text).not.toContain("Live scoring is being built");
    expect(text).toContain("each prompt you send on claude.ai or chatgpt.com");
    expect(text).toContain(
      "The last 20 scored prompts are kept only in your browser",
    );
    expect(text).toContain("anything that looks personal");
  });

  it("lists the report fields and the 20-message cap", () => {
    expect(text).toContain("up to the last 20");
    expect(text).toContain("the hour it was scored");
    expect(text).toContain("a length bucket");
    expect(text).toContain("an import key");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  juniorWithGapsMatrix,
  nearlyMidMatrix,
  newUserMatrix,
} from "../../src/lib/skill-matrix-fixtures";
import { EXTENSION_INSTALL_URL } from "./format";
import { SkillMatrix } from "./skill-matrix";

function rowFor(html: string, areaName: string): string {
  const start = html.indexOf(areaName);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf("</li>", start);
  return html.slice(start, end);
}

describe("SkillMatrix", () => {
  it("shows the track, levels and prompt count in the header", () => {
    const html = renderToStaticMarkup(
      <SkillMatrix data={juniorWithGapsMatrix} />,
    );
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("Product manager · junior →to mid");
    expect(text).toContain("Based on 38 prompts");
  });

  it("says gap in words for a gap area", () => {
    const html = renderToStaticMarkup(
      <SkillMatrix data={juniorWithGapsMatrix} />,
    );
    const row = rowFor(html, "Problem discovery and user research");
    expect(row).toContain("0.4 · junior");
    expect(row).toContain("Gap: 1 level");
    expect(row).toContain("Low confidence · 5 prompts");
  });

  it("says when there isn't enough evidence", () => {
    const html = renderToStaticMarkup(
      <SkillMatrix data={juniorWithGapsMatrix} />,
    );
    const row = rowFor(html, "Strategy and vision");
    expect(row).toContain("Not enough evidence yet");
    expect(row).not.toContain("Gap");
  });

  it("does not call an area at or above target a gap", () => {
    const html = renderToStaticMarkup(<SkillMatrix data={nearlyMidMatrix} />);
    const row = rowFor(html, "Working with AI agents day to day");
    expect(row).toContain("2.2 · senior");
    expect(row).toContain("At target");
    expect(row).not.toContain("Gap");
  });

  it("shows the empty state with install and connect links", () => {
    const html = renderToStaticMarkup(
      <SkillMatrix data={newUserMatrix} keelCheckSlot={<p>Keel check</p>} />,
    );
    expect(html).toContain(
      "Score a past chat in the extension to see where you stand",
    );
    expect(html).toContain(`href="${EXTENSION_INSTALL_URL}"`);
    expect(html).toContain('href="/connect"');
    expect(html).not.toContain("Based on");
    expect(html).toContain("Keel check");
  });
});

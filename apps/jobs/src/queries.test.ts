import { describe, expect, it } from "vitest";
import {
  areaPhrase,
  buildAreaPlans,
  buildSearchRequest,
  fallbackQuery,
  queryKind,
  uniqueQueries,
} from "./queries.ts";
import type { CatalogArea } from "./types.ts";

const discovery: CatalogArea = {
  trackId: "product-manager",
  trackName: "Product manager",
  areaId: "problem_discovery",
  areaName: "Problem discovery and user research",
  descriptions: { junior: "J.", mid: "M.", senior: "S." },
  exaQueries: {
    junior: [
      "product managers talking about user interviews and continuous discovery",
      "mistakes product managers make with user research",
      "how junior product managers run user interviews now",
    ],
    mid: [
      "product managers talking about user interviews and continuous discovery",
      "mistakes product managers make with user research",
      "how mid-level product managers run user interviews now",
    ],
    senior: [
      "product managers talking about user interviews and continuous discovery",
      "mistakes product managers make with user research",
      "how senior product managers run user interviews now",
    ],
  },
};

const delivery: CatalogArea = {
  ...discovery,
  areaId: "eng_design_collab",
  areaName: "Delivery with engineering and design",
  exaQueries: {
    junior: ["how PMs work with designers"],
    mid: [
      "how PMs work with designers",
      "product manager and engineering lead relationship",
    ],
    senior: ["shipping with your engineering team"],
  },
};

describe("queryKind", () => {
  it("sends mistake and failure wording to Stop", () => {
    expect(queryKind("mistakes product managers make with A/B tests")).toBe(
      "mistake",
    );
    expect(queryKind("why product roadmaps fail")).toBe("mistake");
    expect(queryKind("common PRD mistakes engineers complain about")).toBe(
      "mistake",
    );
    expect(queryKind("when not to use AI in a product")).toBe("mistake");
  });

  it("sends everything else to Test and Keep", () => {
    expect(queryKind("product managers talking about metrics")).toBe(
      "practice",
    );
    expect(queryKind("LLM product decisions")).toBe("practice");
  });
});

describe("buildAreaPlans", () => {
  it("makes two plans per area, one per kind", () => {
    const plans = buildAreaPlans([discovery, delivery]);
    expect(plans.map((plan) => `${plan.areaId}:${plan.kind}`)).toEqual([
      "problem_discovery:practice",
      "problem_discovery:mistake",
      "eng_design_collab:practice",
      "eng_design_collab:mistake",
    ]);
  });

  it("uses the first query for podcasts and the second for the web", () => {
    const [practice, mistake] = buildAreaPlans([discovery]);
    expect(practice?.podcastQuery).toBe(
      "product managers talking about user interviews and continuous discovery",
    );
    expect(practice?.webQuery).toBe(
      "how mid-level product managers run user interviews now",
    );
    expect(mistake?.podcastQuery).toBe(
      "mistakes product managers make with user research",
    );
    expect(mistake?.webQuery).toBe(mistake?.podcastQuery);
  });

  it("falls back to a mistakes query when an area has none", () => {
    const mistake = buildAreaPlans([delivery]).find(
      (plan) => plan.kind === "mistake",
    );
    expect(mistake?.podcastQuery).toBe(
      fallbackQuery(
        "mistake",
        "Product manager",
        "Delivery with engineering and design",
      ),
    );
    expect(mistake?.podcastQuery).toBe(
      "mistakes product managers make with delivery with engineering and design",
    );
    expect(mistake?.podcastQuery).not.toContain("product trio");
  });

  it("keeps acronyms in area names", () => {
    expect(areaPhrase("AI product sense")).toBe("AI product sense");
    expect(areaPhrase("Working with AI agents day to day")).toBe(
      "working with AI agents day to day",
    );
  });

  it("removes repeated queries across levels", () => {
    expect(uniqueQueries(delivery)).toEqual([
      "how PMs work with designers",
      "product manager and engineering lead relationship",
      "shipping with your engineering team",
    ]);
  });
});

describe("buildSearchRequest", () => {
  const now = new Date("2026-11-15T04:17:00.000Z");
  const [plan] = buildAreaPlans([discovery]);
  if (!plan) throw new Error("no plan");

  it("limits podcast searches to the Exa podcast library and the last 90 days", () => {
    const body = buildSearchRequest(plan, "podcast", now);
    expect(body.includeDomains).toEqual(["exa.ai/library/podcast"]);
    expect(body).not.toHaveProperty("category");
    expect(body.startPublishedDate).toBe("2026-08-17T04:17:00.000Z");
    expect(body.endPublishedDate).toBe("2026-11-15T04:17:00.000Z");
    expect(body.query).toBe(plan.podcastQuery);
    expect(body.contents).toEqual({
      highlights: true,
      text: { maxCharacters: 800 },
    });
  });

  it("searches the web without the podcast library", () => {
    const body = buildSearchRequest(plan, "web", now);
    expect(body).not.toHaveProperty("includeDomains");
    expect(body.excludeDomains).toEqual(["exa.ai"]);
    expect(body.query).toBe(plan.webQuery);
    expect(body.contents).toEqual({ highlights: true });
    expect(body.startPublishedDate).toBe("2026-08-17T04:17:00.000Z");
  });

  it("asks for the right kind of material", () => {
    const [, mistake] = buildAreaPlans([discovery]);
    if (!mistake) throw new Error("no plan");
    expect(String(buildSearchRequest(mistake, "web", now).objective)).toContain(
      "common mistakes and what to do instead",
    );
    expect(String(buildSearchRequest(plan, "web", now).objective)).toContain(
      "from a product manager's point of view",
    );
  });
});

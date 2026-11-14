import { describe, expect, it } from "vitest";
import { DEFAULT_TRACKS, routeTrack, TRACK_KEYWORDS } from "./index.js";

describe("routeTrack", () => {
  it("routes product prompts to the PM track", () => {
    for (const prompt of [
      "Write a PRD for a habit tracker",
      "Prioritize this backlog for the MVP",
      "Which metrics should we track for onboarding?",
      "Build me a landing page for my SaaS app",
      "Draft user stories with acceptance criteria",
    ]) {
      expect(routeTrack(prompt), prompt).toBe("product-manager");
    }
  });

  it("drops off-topic prompts", () => {
    for (const prompt of [
      "What's the capital of Peru?",
      "Write a haiku about autumn",
      "Translate 'good morning' into Finnish",
      "",
    ]) {
      expect(routeTrack(prompt), prompt).toBe("none");
    }
  });

  it("drops personal prompts, even with track keywords", () => {
    for (const prompt of [
      "My therapist says I should talk to my manager about the product launch",
      "How do I tell my wife I want to quit my product job?",
      "What are the symptoms of burnout for a PM building an app?",
    ]) {
      expect(routeTrack(prompt), prompt).toBe("none");
    }
  });

  it("matches whole words, not parts of words", () => {
    expect(routeTrack("I love apples and happy users")).toBe("product-manager");
    expect(routeTrack("I love apples and happiness")).toBe("none");
  });

  it("is case-insensitive", () => {
    expect(routeTrack("WRITE A PRD")).toBe("product-manager");
  });

  it("uses the tracks it's given", () => {
    expect(routeTrack("write a prd", [])).toBe("none");
    expect(
      routeTrack("write a prd", [{ id: "product-manager", keywords: ["prd"] }]),
    ).toBe("product-manager");
  });

  it("has keywords for every default track", () => {
    for (const track of DEFAULT_TRACKS) {
      expect(TRACK_KEYWORDS[track.id].length).toBeGreaterThan(0);
    }
  });
});

"use client";

import { useEffect, useState } from "react";

const ROTATION_MS = 5600;

const steps = [
  {
    label: "Signal capture",
    title: "Your everyday work is the starting point.",
    description:
      "As you use Claude or ChatGPT, Triplekeel scores your prompts on your device and keeps only the skill signals.",
    mockup: "prompt signals",
  },
  {
    label: "Skill gap monitoring",
    title: "Track skills as they grow.",
    description:
      "Triplekeel brings your prompt scores together over time to show your strengths and the skills you can build next.",
    mockup: "your skill picture",
  },
  {
    label: "Nudging",
    title: "Put your next practice to work.",
    description:
      "Get a weekly suggestion that targets a skill gap and fits the work you already have to do.",
    mockup: "weekly practice",
  },
];

export function ProcessTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(query.matches);
    updateMotionPreference();
    query.addEventListener("change", updateMotionPreference);
    return () => query.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((activeIndex + 1) % steps.length);
    }, ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion]);

  const activeStep = steps[activeIndex];

  return (
    <section
      aria-label="Auto-advancing feature overview"
      className="feature-tabs-layout"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        aria-label="How Triplekeel works"
        className="feature-tab-list"
        role="tablist"
        aria-orientation="vertical"
      >
        {steps.map((step, index) => {
          const selected = index === activeIndex;
          return (
            <button
              aria-controls="feature-panel"
              aria-selected={selected}
              className={`feature-tab${selected ? " is-active" : ""}`}
              id={`feature-tab-${index}`}
              key={step.label}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setActiveIndex((index + 1) % steps.length);
                  document
                    .getElementById(`feature-tab-${(index + 1) % steps.length}`)
                    ?.focus();
                }
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const previousIndex =
                    (index - 1 + steps.length) % steps.length;
                  setActiveIndex(previousIndex);
                  document
                    .getElementById(`feature-tab-${previousIndex}`)
                    ?.focus();
                }
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <span className="feature-tab-heading">
                <span className="feature-number">0{index + 1}</span>
                <span>{step.label}</span>
              </span>
              {selected && (
                <span aria-hidden="true" className="feature-tab-detail">
                  <span className="feature-tab-title">{step.title}</span>
                  <span className="feature-tab-description">
                    {step.description}
                  </span>
                </span>
              )}
              <span aria-hidden="true" className="tab-progress-track">
                {selected && !paused && !reducedMotion && (
                  <span
                    className="tab-progress-fill"
                    key={activeIndex}
                    style={{ animationDuration: `${ROTATION_MS}ms` }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`feature-tab-${activeIndex}`}
        className="feature-mockup-panel"
        id="feature-panel"
        key={activeIndex}
        role="tabpanel"
      >
        <span className="sr-only">
          {activeStep.title} {activeStep.description}
        </span>
        <div
          aria-hidden="true"
          className="dotted-placeholder feature-placeholder"
        >
          <span className="placeholder-label">Product preview</span>
          <div className="mockup-window">
            <div className="mockup-window-top">
              <i />
              <i />
              <i />
              <span>{activeStep.mockup}</span>
            </div>
            <div className="mockup-window-body">
              <span className="mockup-line mockup-line-short" />
              <span className="mockup-line" />
              <span className="mockup-line mockup-line-mid" />
              <span className="mockup-chart">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="mockup-line mockup-line-mid" />
            </div>
          </div>
          <span className="preview-caption">{activeStep.mockup}</span>
        </div>
      </div>
    </section>
  );
}

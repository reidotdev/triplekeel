import { ArrowUpRight } from "lucide-react";
import { type CSSProperties, type ReactNode, useId } from "react";
import type {
  SkillMatrixArea,
  SkillMatrixData,
} from "../../src/lib/skill-matrix";
import { Card } from "../ui/card";
import { Link } from "../ui/link";
import {
  barDescription,
  basedOnText,
  CONNECT_PATH,
  confidenceText,
  EXTENSION_INSTALL_URL,
  gapText,
  isGapArea,
  levelText,
  markerLabelAlign,
  promptsText,
  scorePercent,
  targetPercent,
} from "./format";

export type SkillMatrixProps = {
  data: SkillMatrixData;
  /** The keel check card. Filled in M3. */
  keelCheckSlot?: ReactNode;
  /** Where "Install the extension" goes. Defaults to the install steps. */
  installHref?: string;
};

export function SkillMatrix({
  data,
  keelCheckSlot,
  installHref = EXTENSION_INSTALL_URL,
}: SkillMatrixProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="grid gap-8 font-mono">
      <header className="grid gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">
          Skill matrix
        </p>
        <h2
          className="font-display text-3xl font-normal leading-tight tracking-[-0.03em] sm:text-4xl"
          id={titleId}
        >
          {data.trackName} ·{" "}
          <span className="whitespace-nowrap">
            {data.currentLevel} <span aria-hidden="true">→</span>
            <span className="sr-only">to</span> {data.targetLevel}
          </span>
        </h2>
        {data.kind === "levels" ? (
          <p className="text-sm text-muted">{basedOnText(data.totalPrompts)}</p>
        ) : null}
      </header>

      {data.kind === "empty" ? (
        <EmptyState installHref={installHref} />
      ) : (
        <div className="grid gap-4">
          <Legend />
          <ol className="grid border-b border-border">
            {data.areas.map((area) => (
              <AreaRow area={area} key={area.id} />
            ))}
          </ol>
        </div>
      )}

      {keelCheckSlot ? <div>{keelCheckSlot}</div> : null}
    </section>
  );
}

function EmptyState({ installHref }: { installHref: string }) {
  return (
    <Card className="grid gap-5 p-6 sm:p-8">
      <h3 className="max-w-xl font-display text-2xl font-normal leading-tight tracking-[-0.02em]">
        Score a past chat in the extension to see where you stand
      </h3>
      <ol className="grid list-decimal gap-2 pl-5 text-sm leading-relaxed">
        <li>
          <Link href={installHref}>
            Install the extension
            <ArrowUpRight
              aria-hidden="true"
              className="ml-1 inline align-[-2px]"
              size={14}
            />
          </Link>
        </li>
        <li>
          <Link href={CONNECT_PATH}>Connect it to your account</Link>
        </li>
        <li>Open a past chat and choose Score this chat.</li>
      </ol>
      <p className="text-xs text-muted">
        Your prompt text stays on your device. Only scores are sent.
      </p>
    </Card>
  );
}

function Legend() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted"
    >
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-6 rounded-full bg-matrix-bar" />
        Your level
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-0.5 rounded-full bg-matrix-target" />
        Target level
      </span>
      <span>Scale 0 to 3</span>
    </div>
  );
}

function AreaRow({ area }: { area: SkillMatrixArea }) {
  const gap = gapText(area.gap);
  const hasGap = isGapArea(area);
  const details = [
    confidenceText(area.confidence),
    area.nPrompts === null ? null : promptsText(area.nPrompts),
  ].filter((part): part is string => part !== null);

  return (
    <li className="grid gap-3 border-t border-border py-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_12rem] md:items-center md:gap-x-6">
      <div className="grid gap-1">
        <h3 className="text-sm font-normal leading-snug">{area.name}</h3>
        {details.length > 0 ? (
          <p className="text-xs text-muted">{details.join(" · ")}</p>
        ) : null}
      </div>

      <LevelBar area={area} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:items-end">
        <p
          className={`text-sm md:text-right ${
            area.level === null ? "text-muted" : "tabular-nums"
          }`}
        >
          {levelText(area.score, area.level)}
        </p>
        {gap === null ? null : hasGap ? (
          <p className="rounded-full border border-matrix-gap bg-matrix-gap-surface px-2 py-0.5 text-xs text-matrix-gap">
            {gap}
          </p>
        ) : (
          <p className="text-xs text-muted">{gap}</p>
        )}
      </div>
    </li>
  );
}

const labelAlign: Record<ReturnType<typeof markerLabelAlign>, string> = {
  start: "translateX(0)",
  center: "translateX(-50%)",
  end: "translateX(-100%)",
};

function LevelBar({ area }: { area: SkillMatrixArea }) {
  const target = targetPercent(area.thresholds, area.targetLevel);
  const labelStyle: CSSProperties = {
    left: `${target}%`,
    transform: labelAlign[markerLabelAlign(target)],
  };

  return (
    <div>
      <p className="sr-only">{barDescription(area)}</p>
      <div aria-hidden="true" className="relative pt-6">
        <span
          className="absolute top-0 whitespace-nowrap text-xs leading-none text-muted"
          style={labelStyle}
        >
          Target: {area.targetLevel}
        </span>
        <div
          className={`relative h-2.5 rounded-full ${
            area.score === null
              ? "border border-dashed border-border"
              : "bg-matrix-track"
          }`}
        >
          {area.score === null ? null : (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-matrix-bar"
              style={{ width: `${scorePercent(area.score)}%` }}
            />
          )}
          <div
            className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-matrix-target ring-2 ring-background"
            style={{ left: `${target}%` }}
          />
        </div>
      </div>
    </div>
  );
}

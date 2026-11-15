import { type ReactNode, useId } from "react";
import type { KeelCheckHistoryResult } from "../../src/lib/keel-check";
import { Card } from "../ui/card";
import { EMPTY_TEXT, FIRST_CHECK_PROMPTS, formatDate } from "./format";
import { GetKeelCheckButton } from "./get-keel-check-button";
import { KeelCheckCardView, type RenderReplies } from "./keel-check-card";
import { KeelCheckHistory } from "./keel-check-history";

export const INTRO_TEXT =
  "Get one thing to keep doing, one to stop and one to test, from your recent prompts.";
export const LOAD_FAILED_TEXT = "Couldn't load your keel check. Try again.";

export type KeelCheckPanelProps = {
  /** The user's cards, newest first. The first is the latest card. */
  history: KeelCheckHistoryResult;
  /** Prompts scored so far. Before the first card, few prompts get the empty state. */
  totalPrompts: number;
  /** Where REI-283 adds the reply buttons for the latest card's items. */
  renderReplies?: RenderReplies;
};

/** The latest keel check card, the button for a new one, and earlier cards. */
export function KeelCheckPanel({
  history,
  totalPrompts,
  renderReplies,
}: KeelCheckPanelProps) {
  const titleId = useId();
  const [latest, ...earlier] = history.status === "ok" ? history.cards : [];
  const latestDate = latest ? formatDate(latest.created_at) : null;

  let body: ReactNode;
  if (history.status === "failed") {
    body = <p className="text-sm">{LOAD_FAILED_TEXT}</p>;
  } else if (latest) {
    body = <KeelCheckCardView card={latest} renderReplies={renderReplies} />;
  } else {
    body = (
      <p className="text-sm leading-relaxed">
        {totalPrompts < FIRST_CHECK_PROMPTS ? EMPTY_TEXT : INTRO_TEXT}
      </p>
    );
  }

  return (
    <Card aria-labelledby={titleId} className="grid gap-6 font-mono sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Keel check
          </p>
          <h2
            className="font-display text-2xl font-normal leading-tight tracking-[-0.02em] sm:text-3xl"
            id={titleId}
          >
            What to keep, stop and test
          </h2>
          {latestDate ? (
            <p className="text-sm text-muted">From {latestDate}</p>
          ) : null}
        </div>
        <GetKeelCheckButton />
      </header>
      {body}
      <KeelCheckHistory cards={earlier} />
    </Card>
  );
}

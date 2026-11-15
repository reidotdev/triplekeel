import { ChevronRight } from "lucide-react";
import { useId } from "react";
import type { KeelCheckCard } from "../../src/lib/keel-check";
import { formatDate, itemsSummary } from "./format";
import { KeelCheckCardView } from "./keel-check-card";

/** Earlier cards, newest first. Each opens to show its items. */
export function KeelCheckHistory({ cards }: { cards: KeelCheckCard[] }) {
  const titleId = useId();
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="grid gap-3">
      <h3
        className="text-xs uppercase tracking-[0.14em] text-muted"
        id={titleId}
      >
        Earlier keel checks
      </h3>
      <ul className="grid border-b border-border">
        {cards.map((card) => (
          <li className="border-t border-border" key={card.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  className="shrink-0 text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  size={14}
                />
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>{formatDate(card.created_at) ?? "Earlier"}</span>
                  <span className="text-muted">{itemsSummary(card.items)}</span>
                </span>
              </summary>
              <div className="pb-5 pt-1">
                <KeelCheckCardView card={card} headingLevel="h4" />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

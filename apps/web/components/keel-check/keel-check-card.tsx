import { ArrowUpRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type {
  KeelCheckCard,
  KeelCheckItem,
  KeelCheckPick,
} from "../../src/lib/keel-check";
import { Link } from "../ui/link";
import {
  EMPTY_TEXT,
  isWebUrl,
  itemText,
  KIND_LABEL,
  sourceParts,
} from "./format";

/**
 * Renders an item's reply buttons. REI-283 adds them. Until then nothing
 * passes this and no reply buttons render.
 */
export type RenderReplies = (
  item: KeelCheckItem,
  card: KeelCheckCard,
) => ReactNode;

/** Colour only adds to the Keep doing, Stop doing and Test words. */
const KIND_ACCENT: Record<KeelCheckItem["kind"], string> = {
  keep: "border-matrix-bar",
  stop: "border-matrix-gap",
  test: "border-matrix-target",
};

/** "Lenny's Podcast · Title ↗ · 12 Oct 2026 · Podcast at 16:15". */
export function SourceLine({ pick }: { pick: KeelCheckPick }) {
  const { before, after } = sourceParts(pick);
  const title = isWebUrl(pick.url) ? (
    <Link href={pick.url} rel="noopener noreferrer" target="_blank">
      {pick.title}
      <ArrowUpRight
        aria-hidden="true"
        className="ml-1 inline align-[-2px]"
        size={14}
      />
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  ) : (
    <span>{pick.title}</span>
  );
  // Keep "12 Oct 2026" and "Podcast at 16:15" on one line each.
  const meta = after.map((part) => (
    <span className="whitespace-nowrap" key={part}>
      {part}
    </span>
  ));
  const parts: ReactNode[] = [...before, title, ...meta];
  return (
    <p className="break-words text-xs leading-relaxed text-muted">
      {parts.map((part, index) => (
        // The parts never change order, so the index is a stable key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
        <Fragment key={index}>
          {index > 0 ? " · " : null}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

/** Shows "→" to sighted users and reads it as "to". */
function WithArrows({ text }: { text: string }) {
  const pieces = text.split(" → ");
  return (
    <>
      {pieces.map((piece, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are fixed text.
        <Fragment key={index}>
          {index > 0 ? (
            <>
              {" "}
              <span aria-hidden="true">→</span>
              <span className="sr-only">to</span>{" "}
            </>
          ) : null}
          {piece}
        </Fragment>
      ))}
    </>
  );
}

type HeadingLevel = "h3" | "h4";

export function KeelCheckItemView({
  item,
  replies,
  headingLevel: Heading = "h3",
}: {
  item: KeelCheckItem;
  /** The reply buttons from REI-283. Left out until then. */
  replies?: ReactNode;
  headingLevel?: HeadingLevel;
}) {
  return (
    <li
      className={`grid gap-2 border-l-2 py-1 pl-4 ${KIND_ACCENT[item.kind]}`}
      data-kind={item.kind}
    >
      <Heading className="text-xs uppercase tracking-[0.14em]">
        {KIND_LABEL[item.kind]}
      </Heading>
      <p className="text-sm leading-relaxed">
        <WithArrows text={itemText(item)} />
      </p>
      <SourceLine pick={item.pick} />
      <p className="text-sm leading-relaxed">{item.pick.why_line}</p>
      {replies ? <div data-slot="keel-check-replies">{replies}</div> : null}
    </li>
  );
}

/** A card's items, or the empty state when it has none. */
export function KeelCheckCardView({
  card,
  renderReplies,
  headingLevel,
}: {
  card: KeelCheckCard;
  /** Where REI-283 adds each item's reply buttons. */
  renderReplies?: RenderReplies;
  headingLevel?: HeadingLevel;
}) {
  if (card.items.length === 0) {
    return <p className="text-sm leading-relaxed">{EMPTY_TEXT}</p>;
  }
  return (
    <ol className="grid gap-6">
      {card.items.map((item) => (
        <KeelCheckItemView
          headingLevel={headingLevel}
          item={item}
          // An item's kind is unique per card.
          key={item.kind}
          replies={renderReplies?.(item, card)}
        />
      ))}
    </ol>
  );
}

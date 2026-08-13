/**
 * Signal Desk · the shared pieces.
 *
 * Every component here is a server component. The direction ships no client
 * JavaScript at all: depth is `<details>`, selection is the URL, and the only
 * motion is one CSS animation on one element.
 */

import type { ReactNode } from "react";
import type {
  Disclosure,
  HomeCopy,
  HomeStateName,
  Provenance,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";

/**
 * The mark vocabulary. Seven shapes, one ink, and `broken` is the only one that
 * touches the spine itself.
 *
 * Nothing here is the sole carrier of anything: every entry that takes a mark
 * also renders the shell's own sentence for the same fact. The mark is a way of
 * reading fifty rows at a glance, not a way of saying something the words do
 * not.
 */
export type MarkKind =
  | "now"
  | "soon"
  | "waiting"
  | "held"
  | "reading"
  | "broken"
  | "plain";

export const MARK_LEGEND: readonly Readonly<{ mark: MarkKind; text: string }>[] = [
  { mark: "now", text: "Asking for you today, or already late." },
  { mark: "soon", text: "Dated, and still ahead of you." },
  { mark: "waiting", text: "Waiting on somebody or something else." },
  { mark: "held", text: "Handled, cleared or archived. It is closed." },
  { mark: "reading", text: "A reading taken from several items, not one item." },
  { mark: "plain", text: "No mark. It is in the list with nothing pressing about it." },
  { mark: "broken", text: "The line breaks here. This could not be read." },
];

/** A project that did not resolve breaks the line, whatever else is true. */
export function markForProvenance(provenance: Provenance, fallback: MarkKind): MarkKind {
  return provenance.projectName === null ? "broken" : fallback;
}

export function Entry({
  mark,
  children,
  id,
}: {
  mark: MarkKind;
  children: ReactNode;
  id?: string;
}) {
  return (
    <li className="dk-entry" data-mark={mark} id={id}>
      {children}
    </li>
  );
}

/**
 * The metadata line. Provenance, timing and state, side by side, separated by a
 * rule rather than by a punctuation glyph a screen reader would read aloud.
 *
 * It never drops a part at a narrow width. Content parity is D-HX08 and the
 * live product's own review row breaks it today.
 */
export function Meta({ parts }: { parts: readonly (string | null | undefined)[] }) {
  const kept = parts.filter((part): part is string => Boolean(part));
  if (kept.length === 0) return null;
  return (
    <p className="dk-meta">
      {kept.map((part, index) => (
        <span className="dk-meta-part" key={`${index}-${part}`}>
          {part}
        </span>
      ))}
    </p>
  );
}

export function whenText(due: WhenLabel | null): string | null {
  if (!due) return null;
  return `${due.relative}, ${due.absolute}`;
}

/**
 * What a row offers, and what it does not.
 *
 * Rendered as a statement rather than as controls. The lab writes nothing: a
 * button here would either do nothing, which is a dead control, or claim an
 * outcome the source never confirmed, which D-HX06 forbids outright. An action
 * that carries a real href is a real link; everything else is disclosed as what
 * it is, including the reason it is unavailable.
 */
export function Offers({ actions }: { actions: readonly RowAction[] }) {
  if (actions.length === 0) return null;
  const open = actions.filter((action) => action.available);
  const shut = actions.filter((action) => !action.available);
  return (
    <div className="dk-offer-set">
      {open.length > 0 ? (
        <div>
          <p className="dk-key">Open to you here</p>
          <ul className="dk-offers">
            {open.map((action) => (
              <li key={action.id} data-available="true">
                {action.href ? <a href={action.href}>{action.label}</a> : <b>{action.label}</b>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {shut.length > 0 ? (
        <div>
          <p className="dk-key">Not open to you here</p>
          <ul className="dk-offers">
            {shut.map((action) => (
              <li key={action.id} data-available="false">
                <b>{action.label}</b>
                {action.unavailableReason ? <span>{action.unavailableReason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="dk-said dk-said-quiet">
        The lab writes nothing. Nothing here is marked done until the source says it is.
      </p>
    </div>
  );
}

/**
 * The strip under the `h1` on a read that is not complete, and the link down to
 * the notes that say why.
 *
 * It never summarises what it has not read: it names that there are limits and
 * points at them. A count of limits is a fact about the disclosures in hand, so
 * it is safe to state.
 */
export function LimitFlag({
  count,
  state,
  copy,
  href,
}: {
  count: number;
  state: HomeStateName;
  copy: HomeCopy;
  href: string;
}) {
  if (count === 0) return null;
  return (
    <a className="dk-flag" data-state={state} href={href}>
      {/* The state name leads only when the read is NOT ordinary. On a complete
          read the strip is a pointer to the notes, not an alarm. */}
      {state === "ready" ? null : <span className="dk-key">{copy.states[state]}</span>}
      {count === 1
        ? "One note at the foot says what this read could not see."
        : `${count} notes at the foot say what this read could not see.`}
    </a>
  );
}

/**
 * The notes at the foot. Every disclosure the mode was handed, in full, with the
 * state it is the voice of, plus the mark legend.
 *
 * A direction chooses whether a disclosure is on the surface or one interaction
 * away. It does not choose whether it exists. This is the surface that makes
 * that true for every mode, and the flag above is what makes it reachable in one
 * move from the top of the read.
 */
export function Limits({
  id,
  copy,
  disclosures,
  extra,
}: {
  id: string;
  copy: HomeCopy;
  disclosures: readonly Disclosure[];
  extra?: readonly (string | null)[];
}) {
  const notes = (extra ?? []).filter((note): note is string => Boolean(note));
  return (
    <section className="dk-limits" id={id} aria-labelledby={`${id}-heading`}>
      <h2 className="dk-h2" id={`${id}-heading`} data-plain="true">
        What this read could not see
      </h2>
      <ul>
        {disclosures.map((disclosure) => (
          <li key={disclosure.id}>
            <span className="dk-key">{copy.states[disclosure.state]}</span>
            <p>{disclosure.text}</p>
          </li>
        ))}
        {notes.map((note) => (
          <li key={note}>
            <span className="dk-key">About this read</span>
            <p>{note}</p>
          </li>
        ))}
      </ul>
      <details className="dk-fold">
        <summary>What the marks mean</summary>
        <div className="dk-fold-body">
          <ul className="dk-legend-list">
            {MARK_LEGEND.map((entry) => (
              <li key={entry.mark}>
                <span className="dk-glyph" data-mark={entry.mark} aria-hidden="true" />
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

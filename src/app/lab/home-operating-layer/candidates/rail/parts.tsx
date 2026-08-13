/**
 * Context Rail · the shared pieces every mode is built from.
 *
 * Nothing here writes a sentence the shell already publishes. What it owns is
 * WEIGHT and PLACEMENT: which fact sits on the surface, which sits one
 * interaction away, and what rhythm the facts fall into.
 *
 * The one rule that governs the whole file: a value that could not be read is
 * never allowed to occupy the slot a number would have occupied. Where the
 * shell hands back nothing, the sentence that explains it takes the slot
 * instead, at the same weight. That is why there is no fallback string, no
 * dash and no zero anywhere below.
 */

import type { ReactNode } from "react";
import { Fragment } from "react";
import type {
  Disclosure,
  InboxView,
  Provenance,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";

/** A small caps label. The rail's own voice, used sparingly in the content. */
export function Label({ children }: { children: ReactNode }) {
  return <p className="rl-label">{children}</p>;
}

/**
 * The one `h1` in the document, and the mode's opening line.
 *
 * D-HX02 requires the mode name to reach the accessible text of the `h1`. Both
 * permitted patterns work; this takes the eyebrow, because the rail already
 * carries the mode as a place and the heading should carry the day as a
 * statement. Read aloud it is "Today. What is asking for you now."
 *
 * `lead` is the mode's own opening sentence and it is always the shell's:
 * Today opens on whether this is an all clear, Analytics on what a number is
 * allowed to mean.
 */
export function Masthead({
  eyebrow,
  line,
  lead,
  children,
}: {
  eyebrow: string;
  line: string;
  lead?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="rl-masthead">
      <h1 className="rl-h1">
        <span className="rl-h1-eyebrow">{eyebrow}</span>
        <span className="rl-h1-line">{line}</span>
      </h1>
      {lead ? <p className="rl-lead">{lead}</p> : null}
      {children}
    </header>
  );
}

/** The middot between metadata items. Decorative, so it is hidden. */
function Sep() {
  return (
    <span className="rl-sep" aria-hidden="true">
      ·
    </span>
  );
}

/**
 * Provenance, always. `text` is the composed form and D-HX08 makes it a hard
 * rule that no width may drop it, so it is never abbreviated, never truncated
 * and never moved behind a disclosure.
 */
export function Prov({ provenance }: { provenance: Provenance }) {
  return <span className="rl-prov">{provenance.text}</span>;
}

/**
 * A date the reader can act on. The relative form leads because that is what
 * decides anything; the absolute form follows so the relative one can be
 * checked. Lateness is carried by the words first and the colour second.
 */
export function When({ when }: { when: WhenLabel }) {
  return (
    <span className="rl-when" data-overdue={when.overdue ? "yes" : undefined}>
      <span className="rl-when-rel">{when.relative}</span>
      <Sep />
      <time className="rl-when-abs" dateTime={when.iso}>
        {when.absolute}
      </time>
    </span>
  );
}

/**
 * A metadata line, separated for the eye rather than for the reader. Items
 * arrive as an array with the absent ones already null, so a row that has no
 * date does not render a gap where one would have been.
 */
export function Meta({ items }: { items: readonly (ReactNode | null)[] }) {
  const shown = items.filter((item): item is ReactNode => item !== null && item !== undefined);
  if (shown.length === 0) return null;
  return (
    <p className="rl-meta">
      {/* The list is a fixed composition of named slots in source order, never
          reordered and never keyed by data, so the position is the identity. */}
      {shown.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <Sep /> : null}
          {item}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * Disclosures, on the surface.
 *
 * A direction chooses whether a disclosure is immediate or one interaction
 * away, never whether it exists. This one puts every disclosure the shell
 * hands over immediately under the heading, because the whole thesis is
 * persistent orientation: a reader who has to open something to find out that
 * a project did not answer has already read the numbers.
 *
 * Tone drives the mark on the left, and the mark is never the only carrier.
 * The sentence itself always names the state.
 */
export function Notices({
  items,
  heading,
}: {
  items: readonly Disclosure[];
  heading: string;
}) {
  if (items.length === 0) return null;
  return (
    <aside className="rl-notices" aria-label={heading}>
      <ul className="rl-notice-list">
        {items.map((item) => (
          <li className="rl-notice" data-tone={item.tone} key={item.id}>
            {item.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** One sentence that is its own notice. Same weight, no list around it. */
export function Notice({
  tone,
  children,
}: {
  tone: Disclosure["tone"];
  children: ReactNode;
}) {
  return (
    <p className="rl-notice rl-notice-single" data-tone={tone}>
      {children}
    </p>
  );
}

const SOURCE_NOTE =
  "This is sent to the product that owns the item. Nothing here is settled until that product answers.";
const HOME_NOTE = "This changes what Home shows you. The work itself is untouched.";

/**
 * What a row lets you do, and what it does not.
 *
 * AN HONEST LIMIT, STATED WHERE IT BITES. The lab is a pure function of the
 * URL: no store, no server action, no writeback, so no direction can make
 * "Mark as read" actually mark anything. The choice is between a control that
 * looks live and does nothing, and a control that opens and tells the reader
 * exactly what it would do and where. This takes the second: every action is a
 * real, keyboard-operable disclosure that names its destination and its
 * consequence.
 *
 * An unavailable action still renders, with its reason. A control that
 * vanishes tells the reader nothing about why it went.
 */
export function Actions({
  actions,
  snooze,
  heading,
}: {
  actions: readonly RowAction[];
  snooze?: InboxView["snoozeOptions"];
  heading: string;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="rl-actions">
      <Label>{heading}</Label>
      <ul className="rl-action-list">
        {actions.map((action) => (
          <li className="rl-action" key={action.id}>
            {action.href !== null ? (
              <a className="rl-action-open" href={action.href}>
                {action.label}
              </a>
            ) : action.available ? (
              <details className="rl-action-details">
                <summary className="rl-action-summary">{action.label}</summary>
                <div className="rl-action-body">
                  <p>{action.needsSourceConfirmation ? SOURCE_NOTE : HOME_NOTE}</p>
                  {action.id === "snooze" && snooze && snooze.length > 0 ? (
                    <ul className="rl-snooze-list">
                      {snooze.map((option) => (
                        <li className="rl-snooze" key={option.id}>
                          <span className="rl-snooze-label">{option.label}</span>
                          <span className="rl-snooze-when">{option.resurfaceLine}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            ) : (
              <div className="rl-action-refused">
                <span className="rl-action-name">{action.label}</span>
                <span className="rl-action-why">{action.unavailableReason}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The read itself, one interaction away.
 *
 * Accounting, standing platform limits and the exact records belong to a
 * reader who asks for them. They do not belong above the three decisions of
 * the day, which is the whole argument for putting them here. Every one of
 * them is still in the document, still reachable by keyboard, and one click
 * deep rather than one page away.
 */
export function ReadPanel({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="rl-read-panel">
      <summary className="rl-read-summary">{summary}</summary>
      <div className="rl-read-body">{children}</div>
    </details>
  );
}

/** A term and its value, for panels that are genuinely a list of facts. */
export function Facts({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="rl-facts">
      {rows.map(([term, value]) => (
        <div className="rl-fact" key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

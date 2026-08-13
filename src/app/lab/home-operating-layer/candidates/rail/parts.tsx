/**
 * Context Rail · the shared pieces every mode is built from.
 *
 * Nothing here writes a sentence the shell already publishes. What it owns is
 * WEIGHT and PLACEMENT: which fact sits on the surface, which sits one
 * interaction away, and what rhythm the facts fall into.
 *
 * TWO RULES GOVERN THE WHOLE FILE.
 *
 * 1. A value that could not be read is never allowed to occupy the slot a
 *    number would have occupied. Where the shell hands back nothing, the
 *    sentence that explains it takes the slot instead, at the same weight.
 *    That is why there is no fallback string, no dash and no zero below.
 *
 * 2. Rules, alignment, type and whitespace before containers. Nothing in this
 *    file draws a box. Every band, notice, panel and detail region is set off
 *    by a rule and by space, so no piece of this direction can be mistaken for
 *    a dashboard widget.
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
import { bandOf, bandOfDisclosure, bySeverity } from "./state";

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
 * checked.
 *
 * LATENESS IS NOT RED TEXT. It was, and #ef4444 on white is 3.76:1, which
 * fails AA for running text and puts the loudest colour on the page into a
 * word rather than into a mark. The words now sit at full ink and a short red
 * rule stands in front of them, so the hue is a mark, the contrast is 16:1,
 * and forced colours keep both.
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
 * Disclosures, on the surface, worst first.
 *
 * A direction chooses whether a disclosure is immediate or one interaction
 * away, never whether it exists. This one puts every disclosure the shell
 * hands over immediately under the heading, because the whole thesis is
 * persistent orientation: a reader who has to open something to find out that
 * a project did not answer has already read the numbers.
 *
 * THE RULE IN FRONT OF EACH ONE IS SET BY `state`, NEVER BY `tone`. Tone is a
 * subject; state is a severity. Two disclosures in the shell share the tone
 * "scope": one says Home could not read any project at all, the other says the
 * scope was changed. Grading by tone made the total failure the calmest band
 * in the set, which is the exact inversion the governing rule forbids.
 *
 * `plain` lines are facts that qualify the list without limiting it. They
 * carry no rule, so a reader can see at a glance how many real limits there
 * are without counting sentences.
 */
export function Notices({
  items,
  heading,
  plain = [],
}: {
  items: readonly Disclosure[];
  heading: string;
  plain?: readonly string[];
}) {
  if (items.length === 0 && plain.length === 0) return null;
  return (
    <aside className="rl-notices" aria-label={heading}>
      <ul className="rl-notice-list">
        {bySeverity(items).map((item) => (
          <li className="rl-notice" data-band={bandOfDisclosure(item)} key={item.id}>
            {item.text}
          </li>
        ))}
        {plain.map((line) => (
          <li className="rl-notice-plain" key={line}>
            {line}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** One sentence that is its own notice. Same weight, no list around it. */
export function Notice({
  state,
  children,
}: {
  state: Disclosure["state"];
  children: ReactNode;
}) {
  return (
    <p className="rl-notice rl-notice-single" data-band={bandOf(state)}>
      {children}
    </p>
  );
}

/**
 * What could not be read, printed rather than filed.
 *
 * These are standing platform limits: a kind of work that has no producer at
 * all. They used to sit inside the "How this read was taken" disclosure, which
 * meant that on a quiet day the two things the day was not an all clear about
 * were one click away behind a label that did not say it held them. A known
 * unknown may not cost an interaction, so they are on the surface, above the
 * decisions they qualify, in every world.
 */
export function Unsupported({ items }: { items: readonly Disclosure[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rl-unsupported" aria-labelledby="rl-h-unsupported">
      <p className="rl-label" id="rl-h-unsupported">
        Not connected yet
      </p>
      <ul className="rl-unsupported-list">
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </section>
  );
}

const SOURCE_NOTE =
  "This is sent to the product that owns the item. Nothing here is settled until that product answers.";
const HOME_NOTE = "This changes what Home shows you. The work itself is untouched.";

/**
 * What a row lets you do, and what it does not.
 *
 * AN HONEST LIMIT, STATED WHERE IT BITES. The lab is a pure function of the
 * URL. `LabViewState` carries thirteen fields and not one of them is a
 * disposition, there is no store and no server action, so no direction can
 * make "Mark as read" actually mark anything. The choice is between a control
 * that looks live and does nothing, and a control that opens and tells the
 * reader exactly what it would do and where. This takes the second: every
 * action is a real, keyboard-operable disclosure that names its destination
 * and its consequence.
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
                    <Fields
                      rows={snooze.map(
                        (option) => [option.label, option.resurfaceLine] as const,
                      )}
                    />
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
 * A term and its value, set in the page's own rules and type.
 *
 * This replaced a bordered, rounded, tinted panel. The facts are the same; the
 * container is gone, and a hairline under each row does the work the border
 * was doing badly.
 */
export function Fields({
  rows,
}: {
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <dl className="rl-fields">
      {/* Keyed by position: two snooze choices share the label "Pick a time"
          and differ only in the instant they come back, so the term is not
          unique and may not be the key. */}
      {rows.map(([term, value], index) => (
        <div className="rl-field" key={index}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Meridian · the pieces every mode is built from.
 *
 * Nothing here writes a sentence the shell already publishes. What this file
 * owns is WHEN a fact is: which column of the page it falls in, which side of
 * the two rules it sits on, and whether it is on the clock at all.
 *
 * THREE RULES GOVERN THE WHOLE FILE.
 *
 * 1. Nothing is placed at a time it does not have. An entry with no date is not
 *    guessed at, not sorted to the end of the dated ones and not given a blank
 *    where a time would go. It goes below the horizon, under a caption saying
 *    so, and its gutter prints "No date" at full weight. A direction whose
 *    structure is time is exactly the direction most tempted to invent one.
 *
 * 2. No container. There is not a box, a card, a panel or a shadow in this
 *    direction. Two full-bleed horizontal rules, one right-aligned column of
 *    times, and space. Everything else is type.
 *
 * 3. A value that could not be read never occupies the slot a number would
 *    have occupied. Where the shell hands back nothing, the sentence that
 *    explains it takes the slot instead, at the same weight.
 */

import type { ReactNode } from "react";
import { Fragment } from "react";
import type {
  Disclosure,
  FirstRunView,
  HomeCandidateProps,
  InboxView,
  Provenance,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";
import { bandOf, bandOfDisclosure, bySeverity, type Band, type Reading } from "./reading";

/**
 * What every mode file is handed. `here` is this mode's read, already resolved
 * to the worst state it can be shown to be in, so no mode re-derives it and no
 * two modes can disagree about the same fact.
 */
export type ModeArgs = Readonly<{ props: HomeCandidateProps; here: Reading }>;

/** The mark on the lower rule. One phrase, every mode, so it reads as one idea. */
export const HORIZON_MARK = "The edge of this read";

/** "Taken from 4 items" — the denominator a derived reading was drawn from. */
export const takenFrom = (count: number): string =>
  count === 1 ? "Taken from 1 item" : `Taken from ${count} items`;

/** A mono small-caps label. Used for structure, never for content. */
export function Label({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="mr-label" id={id}>
      {children}
    </p>
  );
}

/**
 * The one `h1`, and the mode's opening line.
 *
 * D-HX02 requires the mode name to reach the accessible text of the `h1`. Both
 * permitted patterns work; this takes the eyebrow, so the heading reads aloud
 * as "Today. What is asking for you now."
 */
export function Masthead({
  eyebrow,
  line,
  lead,
}: {
  eyebrow: string;
  line: string;
  lead?: string | null;
}) {
  return (
    <div className="mr-masthead">
      <h1 className="mr-h1">
        <span className="mr-h1-eyebrow">{eyebrow}</span>
        <span className="mr-h1-line">{line}</span>
      </h1>
      {lead ? <p className="mr-lead">{lead}</p> : null}
    </div>
  );
}

/**
 * THE MERIDIAN. One rule across the whole page, marking the instant the read
 * was taken. Everything under it is the read; the page runs forward from here.
 *
 * It is drawn rather than described, and it is the only full-bleed element in
 * the direction apart from its opposite number below.
 */
export function Meridian({ when }: { when: string }) {
  return (
    <p className="mr-meridian">
      <span className="mr-meridian-mark">Now</span>
      <span className="mr-meridian-when">{when}</span>
    </p>
  );
}

/**
 * THE HORIZON. The far edge of what this read reached. Above it is inside the
 * read; below it is outside — further out than the window looked, off the clock
 * altogether, or not yet answerable.
 *
 * The label is the shell's own window sentence wherever the shell publishes
 * one, which is why the two rules can never drift from the read they bracket.
 */
export function Horizon({ line, mark }: { line: string | null; mark: string }) {
  return (
    <p className="mr-horizon">
      <span className="mr-horizon-mark">{mark}</span>
      {line ? <span className="mr-horizon-line">{line}</span> : null}
    </p>
  );
}

/**
 * The space between the two rules, and what its emptiness means.
 *
 * `material` is the direction's answer to the governing rule. A read that
 * finished leaves open paper: the emptiness is the shape of the time nothing is
 * asking for. A read that was refused leaves RULED paper: the time is still
 * there and Home could not see into it. The two are told apart from across a
 * room, before a word is read, and the words are printed either way.
 */
export function Field({
  material,
  children,
}: {
  material: Band;
  children: ReactNode;
}) {
  return (
    <div className="mr-field" data-material={material}>
      {children}
    </div>
  );
}

/**
 * The sentence that stands directly under the meridian when the read did not
 * finish. Set at heading size, at full ink, across the measure — the one place
 * this direction raises its voice, and it raises it only for this.
 */
export function ReadNotice({
  band,
  children,
}: {
  band: Band;
  children: ReactNode;
}) {
  return (
    <p className="mr-read-notice" data-band={band}>
      {/* The sentence carries its own paper, so on the ruled ground below it is
          read off clean white rather than through a line. */}
      <span className="mr-read-notice-text">{children}</span>
    </p>
  );
}

/** The middot between metadata items. Decorative, so it is hidden. */
function Sep() {
  return (
    <span className="mr-sep" aria-hidden="true">
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
  return <span className="mr-prov">{provenance.text}</span>;
}

/**
 * A metadata line. Items arrive with the absent ones already null, so a row
 * with no date does not render a gap where one would have been.
 */
export function Meta({ items }: { items: readonly (ReactNode | null)[] }) {
  const shown = items.filter((item): item is ReactNode => item !== null && item !== undefined);
  if (shown.length === 0) return null;
  return (
    <p className="mr-meta">
      {/* A fixed composition of named slots in source order, never reordered
          and never keyed by data, so the position is the identity. */}
      {shown.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <Sep /> : null}
          {item}
        </Fragment>
      ))}
    </p>
  );
}

/** What the gutter prints when the thing genuinely has no time on it. */
export const NO_TIME = "No date";

/**
 * ONE ENTRY, HUNG BY ITS TIME.
 *
 * The gutter is the axis. It carries the shell's own temporal sentence for this
 * entry and nothing else: how late it is, when it arrived, when it comes back,
 * how long it has been quiet. Right-aligned in mono so the times form a column
 * a reader can run down without reading a single title, which is the whole
 * argument for the width it takes.
 *
 * LATENESS IS A MARK, NOT RED TEXT. The words sit at full ink and a short heavy
 * rule stands in front of them. The hue is redundant: "2 days late" already
 * says it, and forced colours keep the rule.
 *
 * Below 640px the gutter rotates: the time becomes the entry's first line, in
 * the same mono, above the title. The phone keeps the whole argument.
 */
export function Entry({
  time,
  overdue = false,
  selected = false,
  children,
}: {
  time: string | null;
  overdue?: boolean;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className="mr-entry"
      data-overdue={overdue ? "yes" : undefined}
      data-selected={selected ? "yes" : undefined}
    >
      <p className="mr-time">{time ?? NO_TIME}</p>
      <div className="mr-body">{children}</div>
    </li>
  );
}

/** The entry's own line. A link when it opens something, plain text when not. */
export function EntryTitle({ href, children }: { href: string | null; children: ReactNode }) {
  if (href === null) return <p className="mr-title">{children}</p>;
  return (
    <a className="mr-title mr-title-link" href={href}>
      {children}
    </a>
  );
}

/** The absolute date, printed beside the relative one so it can be checked. */
export function Absolute({ when }: { when: WhenLabel }) {
  return (
    <time className="mr-abs" dateTime={when.iso}>
      {when.absolute}
    </time>
  );
}

/** A run of entries. Semantic list, never a rich-row listbox. */
export function Entries({ children }: { children: ReactNode }) {
  return <ul className="mr-entries">{children}</ul>;
}

/**
 * A named stretch of the page, with its heading and, where the shell publishes
 * one, the window it covers.
 */
export function Band_({
  id,
  heading,
  note,
  children,
}: {
  id: string;
  heading: string;
  note?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="mr-band" aria-labelledby={id}>
      <h2 className="mr-h2" id={id}>
        {heading}
      </h2>
      {note ? <p className="mr-band-note">{note}</p> : null}
      {children}
    </section>
  );
}

/**
 * THE READ, as a standing column at the right of the page from 1120px up, and
 * as a full-width block directly under the meridian below that.
 *
 * It is the answer to what the rest of a 1440 screen is for, and it is a
 * temporal object rather than a navigation one: it is the state of the whole
 * system at the instant printed on the meridian. Every director on two rounds
 * asked for this material to be near the top rather than at the foot, and this
 * is the only column in the direction that never scrolls past it.
 */
export function TheRead({ children }: { children: ReactNode }) {
  return (
    <aside className="mr-record" aria-labelledby="mr-record-label">
      <Label id="mr-record-label">The read</Label>
      {children}
    </aside>
  );
}

/**
 * Disclosures, on the surface, worst first.
 *
 * A direction chooses whether a disclosure is immediate or one interaction
 * away, never whether it exists. These are immediate, in the column that
 * accounts for the read, at the top of the page.
 *
 * THE MARK IS SET BY `state`, NEVER BY `tone`, with the single exception of a
 * source that refused. See `reading.ts`.
 */
export function Notices({ items }: { items: readonly Disclosure[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mr-notices">
      {bySeverity(items).map((item) => (
        <li className="mr-notice" data-band={bandOfDisclosure(item)} key={item.id}>
          {item.text}
        </li>
      ))}
    </ul>
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
    <p className="mr-notice mr-notice-alone" data-band={bandOf(state)}>
      {children}
    </p>
  );
}

/**
 * What has no source at all, printed rather than filed.
 *
 * These are standing platform limits, not news about this morning, so they sit
 * in the column that accounts for the read rather than in the day. A known
 * unknown may not cost an interaction, so they are on the surface in every
 * world.
 */
export function Unsupported({ items }: { items: readonly Disclosure[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mr-unsupported">
      <Label>Nothing produces this yet</Label>
      <ul className="mr-unsupported-list">
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </div>
  );
}

const SOURCE_NOTE =
  "This is sent to the product that owns the item. Nothing here is settled until that product answers.";
const HOME_NOTE = "This changes what Home shows you. The work itself is untouched.";

/**
 * What an entry lets you do, and what it does not.
 *
 * AN HONEST LIMIT, STATED WHERE IT BITES. The lab is a pure function of the
 * URL: `LabViewState` carries thirteen fields and not one of them is a
 * disposition, there is no store and no server action, so no direction can make
 * "Mark as read" actually mark anything. The choice is between a control that
 * looks live and does nothing, and a control that opens and says exactly what
 * it would do and where. This takes the second, and it takes it ON THE ROW at
 * arrival rather than behind an Open link, so a reader can see the whole
 * disposition vocabulary without leaving the queue.
 *
 * An unavailable action still renders, with its reason. A control that vanishes
 * tells the reader nothing about why it went.
 */
export function Actions({
  actions,
  snooze,
}: {
  actions: readonly RowAction[];
  snooze?: InboxView["snoozeOptions"];
}) {
  if (actions.length === 0) return null;
  /* What you can do, then what you cannot. Both are printed; a control that
     vanishes tells the reader nothing about why it went, and a refusal set at
     the same weight as an offer makes the offers hard to find. */
  const ordered = [
    ...actions.filter((action) => action.href !== null || action.available),
    ...actions.filter((action) => action.href === null && !action.available),
  ];
  return (
    <ul className="mr-actions">
      {ordered.map((action) => (
        <li className="mr-action" data-refused={action.available ? undefined : "yes"} key={action.id}>
          {action.href !== null ? (
            <a className="mr-act-open" href={action.href}>
              {action.label}
            </a>
          ) : action.available ? (
            <details className="mr-act">
              <summary className="mr-act-summary">{action.label}</summary>
              <div className="mr-act-body">
                <p>{action.needsSourceConfirmation ? SOURCE_NOTE : HOME_NOTE}</p>
                {action.id === "snooze" && snooze && snooze.length > 0 ? (
                  <Fields
                    rows={snooze.map((option) => [option.label, option.resurfaceLine] as const)}
                  />
                ) : null}
              </div>
            </details>
          ) : (
            <span className="mr-act-refused">
              <span className="mr-act-name">{action.label}</span>
              <span className="mr-act-why">{action.unavailableReason}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A term and its value, set in the page's own type. No border, no tint, no
 * panel: a hairline under each row does the work a box would do badly.
 */
export function Fields({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className="mr-fields">
      {/* Keyed by position: two snooze choices share the label "Pick a time"
          and differ only in the instant they come back, so the term is not
          unique and may not be the key. */}
      {rows.map(([term, value], index) => (
        <div className="mr-field-row" key={index}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A PERSON'S FIRST EVER SCREEN.
 *
 * It sits between the two rules, where the day would be, because that is the
 * truthful place for it: the fourteen days are there, they are simply empty,
 * and the reason is that nothing has been made yet. Nothing about this screen
 * says a read failed, and it carries a real move rather than a caption.
 *
 * The link leaves the lab on purpose. A reader with no Project has nowhere to
 * go inside Home, and work lives in a Project.
 */
export function FirstRun({ view }: { view: FirstRunView }) {
  return (
    <section className="mr-first" aria-labelledby="mr-first-h">
      <h2 className="mr-h2" id="mr-first-h">
        {view.heading}
      </h2>
      <p className="mr-first-line">{view.line}</p>
      <p className="mr-first-next">{view.nextLine}</p>
      <p className="mr-first-actions">
        {view.actions.map((action) => (
          <a className="mr-first-do" href={action.href} key={action.id}>
            {action.label}
          </a>
        ))}
      </p>
    </section>
  );
}

/**
 * THE COMPOSITION EVERY MODE IS BUILT ON, written once so the five surfaces
 * cannot drift apart.
 *
 *      ─────────────────────────────────────────────  the meridian, now
 *        the stream                    the read
 *        (entries, hung by time)       (what this read covered,
 *                                       and what it could not see)
 *      ─────────────────────────────────────────────  the horizon
 *        what the read does not reach
 *
 * The two rules are the only full-bleed elements in the direction. Everything
 * between them is inside the read; everything below the horizon is outside it.
 * A reader can see the shape of what is coming before reading a word, and on a
 * quiet day the space between the rules is genuinely open, which is the point:
 * the emptiness is the amount of time nothing is asking for.
 */
export function Chronology({
  when,
  material,
  notice,
  stream,
  record,
  wide,
  horizonMark,
  horizonLine,
  beyond,
}: {
  when: string;
  material: Band;
  notice?: ReactNode;
  stream: ReactNode;
  record: ReactNode;
  /**
   * The one thing per mode that is allowed to break the measure, and in this
   * direction only one thing ever asks: the Project ledger, which is genuinely
   * tabular and reads worse squeezed into a reading width than it does given
   * the page.
   */
  wide?: ReactNode;
  horizonMark: string;
  horizonLine: string | null;
  beyond?: ReactNode;
}) {
  return (
    <>
      <Meridian when={when} />
      <Field material={material}>
        {notice ?? null}
        <div className="mr-columns">
          <div className="mr-stream">{stream}</div>
          {record}
        </div>
        {wide ? <div className="mr-wide">{wide}</div> : null}
      </Field>
      <Horizon mark={horizonMark} line={horizonLine} />
      {beyond ? <div className="mr-beyond">{beyond}</div> : null}
    </>
  );
}

/**
 * What this read covered, in every mode.
 *
 * The column that accounts for a read is exactly as long as that read's limits
 * are, so on a clean day it is short — and a short account is information, not
 * a gap. What it may never be is absent, so this closes it in every world: the
 * scope the read was taken at, and where it fell short of covering that scope.
 */
export function ScopeAccount({
  scopeLabel,
  coverageLine,
}: {
  scopeLabel: string;
  coverageLine: string | null;
}) {
  return (
    <div className="mr-scope-account">
      <Fields
        rows={[
          ["What was read", scopeLabel],
          ...(coverageLine ? ([["How much", coverageLine]] as const) : []),
        ]}
      />
    </div>
  );
}

/** The caption over an empty stretch of time, and what the emptiness means. */
export function EmptyField({ children }: { children: ReactNode }) {
  return <p className="mr-empty">{children}</p>;
}

/** Where the selected entry would open in the product. Shown, never followed. */
export function SourcePath({ path, close }: { path: string; close: string | null }) {
  return (
    <p className="mr-source">
      <span className="mr-source-label">Where this lives</span>
      <span className="mr-source-path">{path}</span>
      {close ? (
        <a className="mr-close" href={close}>
          Close
        </a>
      ) : null}
    </p>
  );
}

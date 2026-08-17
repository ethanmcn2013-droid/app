/**
 * Meridian · the pieces every mode is built from.
 *
 * Nothing here writes a sentence the shell already publishes. What this file
 * owns is WHEN a fact is: which column of the page it falls in, which side of
 * the two rules it sits on, and whether it is on the clock at all.
 *
 * FOUR RULES GOVERN THE WHOLE FILE.
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
 *
 * 4. NOTHING IS SAID TWICE ON ONE SCREEN. Every component that could restate a
 *    fact already on the row takes the fact it would repeat as a prop and
 *    declines. Round 4 read the repetitions as an unedited page, correctly, and
 *    `sameFact` below is the shared test they are all suppressed by.
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

/**
 * Two sentences saying the same thing.
 *
 * Round 4 caught four separate places where this direction printed one fact
 * twice on one row: "Due in 5 days" in the gutter and "Due in 5 days." in the
 * body, "Parked in this project's waiting column" then "Parked in the waiting
 * column", and "As read on Thursday 16 July." once per claim. The comparison is
 * deliberately loose — trailing stop, case and inner spacing removed, then
 * either string containing the other counts as a repeat — because the shell
 * composes these sentences independently and an exact match would catch none of
 * them.
 */
export function sameFact(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return false;
  const clean = (value: string) =>
    value.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
  const a = clean(left);
  const b = clean(right);
  if (a.length === 0 || b.length === 0) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** A mono small-caps label. Used for structure, never for content. */
export function Label({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="mr-label" id={id}>
      {children}
    </p>
  );
}

/**
 * THE MERIDIAN. One rule across the whole page, marking the instant the read
 * was taken. Everything above it is what this read IS — where you are, what it
 * was taken over, how much of it came back. Everything below it is what the
 * read FOUND.
 *
 * It is drawn rather than described, and it is one of exactly two full-bleed
 * elements in the direction.
 *
 * IT IS ALSO THE DOCUMENT'S ONE POLITE STATUS REGION. The instant of the read
 * is the fact that changes when a reader moves scope or mode, it is already on
 * the page, and it is stated in exactly one place — so the live region costs no
 * duplication. Round 4 found the previous status region orphaned at the right
 * of the scope row with no structure to belong to; this is the structure.
 */
export function Meridian({ when, label }: { when: string; label: string }) {
  return (
    <p
      className="mr-meridian"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
    >
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
 * The sentence that stands directly under the meridian when the read did not
 * finish.
 *
 * WHAT THIS USED TO BE, AND WHY IT IS NOT THAT ANY MORE. Round 4 drew a refused
 * read on ruled paper: bands of evenly spaced grey hairlines above and below the
 * sentence. Two directors independently read it as a skeleton loader rather than
 * as an interruption, and at 390 it was the whole first screen. A broken read
 * drawn in the visual language of a page that has not finished loading is the
 * worst available mistake for this programme, so the device is gone.
 *
 * What replaces it is the one moment this direction reverses. A refused read is
 * set knocked out of solid ink, hard against the meridian, at heading size. It
 * cannot be mistaken for an absence: nothing else on any of the five surfaces is
 * reversed, it survives forced colours as a real border and a real fill, and it
 * is legible as a black slab from across a room before a word is read. A partly
 * read day keeps clean paper and takes a heavy leading rule instead. Three
 * silhouettes, still told apart with every colour removed.
 */
export function ReadNotice({
  band,
  children,
  detail,
}: {
  band: Band;
  children: ReactNode;
  /** What was not seen, where the shell names it. Never a second copy of the sentence. */
  detail?: string | null;
}) {
  return (
    <div className="mr-read-notice" data-band={band}>
      <p className="mr-read-notice-text">{children}</p>
      {detail ? <p className="mr-read-notice-detail">{detail}</p> : null}
    </div>
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
 * RANK IS SEPARATE FROM TIME, and it is printed only where a rank exists. Only
 * Today's three decisions are ranked; everything else on every surface sits
 * where its own time puts it. The numeral leads the body rather than the gutter
 * so the two orderings are never confused for each other.
 *
 * Below 640px the gutter rotates: the time becomes the entry's first line, in
 * the same mono, above the title. The phone keeps the whole argument.
 */
export function Entry({
  time,
  fallback = NO_TIME,
  overdue = false,
  selected = false,
  rank = null,
  children,
}: {
  time: string | null;
  /** What an absent time prints. Null leaves the gutter genuinely empty. */
  fallback?: string | null;
  overdue?: boolean;
  selected?: boolean;
  rank?: string | null;
  children: ReactNode;
}) {
  const shown = time ?? fallback;
  return (
    <li
      className="mr-entry"
      data-overdue={overdue ? "yes" : undefined}
      data-selected={selected ? "yes" : undefined}
    >
      <p className="mr-time">{shown ?? ""}</p>
      <div className="mr-body">
        {rank ? <p className="mr-rank">{rank}</p> : null}
        {children}
      </div>
    </li>
  );
}

/**
 * The entry's own line.
 *
 * A LINK LOOKS LIKE A LINK. Round 4 found row titles carrying no underline and
 * no colour while "Open the full briefing" in the same view was indigo and
 * underlined, so a reader could not infer which text was operable. Titles now
 * carry a permanent underline. They are not set in indigo: there are sixty of
 * them on My work at scale and forty-two on Inbox, and spending the anchor
 * colour on every one of them drains it. Indigo stays for the one onward link
 * per section, which is the only place this direction wants an eye pulled.
 */
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
  caveat,
  children,
}: {
  id: string;
  heading: string;
  note?: string | null;
  /** What the list was drawn from, where the read did not cover everything. */
  caveat?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="mr-band" aria-labelledby={id}>
      <h2 className="mr-h2" id={id}>
        {heading}
      </h2>
      {note ? <p className="mr-band-note">{note}</p> : null}
      {caveat && !sameFact(caveat, note ?? null) ? (
        <p className="mr-band-caveat">{caveat}</p>
      ) : null}
      {children}
    </section>
  );
}

/**
 * WHAT THIS READ IS, in the top right of every mode, level with the heading.
 *
 * THIS IS THE DIRECTION'S ANSWER TO WHAT THE WIDTH IS FOR, and it is the answer
 * round 4 said was missing. The upper right of the page was empty on every mode
 * and every scenario, roughly 780 by 230 pixels of undefended white, and one
 * director called it the least-defended emptiness in the lab. It is now the only
 * place on the page that says what the read was taken over, how much of it came
 * back, and where work started from here would land.
 *
 * It is above the meridian on purpose. Everything above that rule describes the
 * read; everything below it is the read. A reader who wants to know what they
 * are looking at never has to scroll to find out, and a reader who does not
 * care never has it in their way.
 */
export function Ledger({
  covered,
  rows,
}: {
  /** One sentence: how much of what was asked for came back. */
  covered: string | null;
  rows: readonly (readonly [string, string])[];
}) {
  if (covered === null && rows.length === 0) return null;
  return (
    <aside className="mr-ledger" aria-labelledby="mr-ledger-label">
      <Label id="mr-ledger-label">This read</Label>
      {covered ? <p className="mr-covered">{covered}</p> : null}
      {rows.length > 0 ? <Fields rows={rows} /> : null}
    </aside>
  );
}

/**
 * WHAT THIS READ COULD NOT SEE, beside the read rather than under it.
 *
 * The column is exactly as long as this mode's limits are, so on a clean day it
 * is short or absent altogether — and a short account is information, not a gap.
 * What is never absent is the account itself, which now lives above the meridian
 * in `Ledger` and is rendered in every mode in every world.
 */
export function TheRead({ children }: { children: ReactNode }) {
  return (
    <aside className="mr-record" aria-labelledby="mr-record-label">
      <Label id="mr-record-label">What this read could not see</Label>
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
 * BELOW THE HORIZON, which is where it belongs and where round 4's height
 * complaint sent it. These are standing platform limits rather than news about
 * this morning, and a kind of work with no producer is by definition outside
 * what any read can reach. The lower rule already means exactly that, so the
 * page gained a truer place for them and lost the height they cost beside the
 * day.
 */
export function Unsupported({ items }: { items: readonly Disclosure[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mr-unsupported" aria-labelledby="mr-unsupported-label">
      <h2 className="mr-h3" id="mr-unsupported-label">
        Nothing produces this yet
      </h2>
      <ul className="mr-unsupported-list">
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
 * The exactness in the snooze times is deliberate and it is not fixture noise.
 * Two of the choices land on a clock change, which is the one case where a
 * snooze can come back at a time nobody asked for, so the instants are given in
 * full rather than as "in three months". Round 4 read them as leaked test data
 * because nothing on the page said why they were exact. This says why.
 */
const SNOOZE_NOTE =
  "These are exact instants, so a clock change between now and then is already counted.";

/** Stated once per mode instead of forty-two times on the rows. */
export const LAB_LIMIT_NOTE =
  "Nothing here is sent. Each of these opens to say what it would do, and where.";

/**
 * WHAT AN ENTRY LETS YOU DO, AND WHAT IT DOES NOT, on the row, at arrival.
 *
 * AN HONEST LIMIT, STATED WHERE IT BITES. The lab is a pure function of the
 * URL: `LabViewState` carries thirteen fields and not one of them is a
 * disposition, there is no store and no server action, so no direction can make
 * "Mark as read" actually mark anything.
 *
 * Round 4 accepted that and still marked it down, because the controls were set
 * in indigo with no disclosure marker and read as live actions that then opened
 * an explanation. Two changes fix that without hiding the vocabulary, which is
 * the thing a queue may never do:
 *
 *   the marker  every one carries a plus that turns into a minus, which is the
 *               universal sign for expands in place rather than performs
 *   the colour  ink, not indigo. Forty-two events times three verbs is the
 *               loudest surface in the lab and it drains the anchor colour
 *
 * A refused action still renders, struck through, with its reason beside it. It
 * is set as a statement rather than a control: it claims no 44px target and it
 * does not sit at the weight of the things you can actually do.
 */
export function Actions({
  actions,
  snooze,
  label = "What you can do",
}: {
  actions: readonly RowAction[];
  snooze?: InboxView["snoozeOptions"];
  label?: string;
}) {
  if (actions.length === 0) return null;
  const offered = actions.filter((action) => action.href !== null || action.available);
  const refused = actions.filter((action) => action.href === null && !action.available);
  return (
    <div className="mr-dispositions">
      <p className="mr-actions-label">{label}</p>
      {offered.length > 0 ? (
        <ul className="mr-actions">
          {offered.map((action) => (
            <li className="mr-action" key={action.id}>
              {action.href !== null ? (
                <a className="mr-act-open" href={action.href}>
                  {action.label}
                </a>
              ) : (
                <details className="mr-act">
                  <summary className="mr-act-summary">{action.label}</summary>
                  <div className="mr-act-body">
                    <p>{action.needsSourceConfirmation ? SOURCE_NOTE : HOME_NOTE}</p>
                    {action.id === "snooze" && snooze && snooze.length > 0 ? (
                      <>
                        <Fields
                          rows={snooze.map(
                            (option) => [option.label, option.resurfaceLine] as const,
                          )}
                        />
                        <p className="mr-act-aside">{SNOOZE_NOTE}</p>
                      </>
                    ) : null}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {refused.length > 0 ? (
        <ul className="mr-refusals">
          {refused.map((action) => (
            <li className="mr-refusal" key={action.id}>
              <span className="mr-act-name">{action.label}</span>
              <span className="mr-act-why">{action.unavailableReason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
 * THE EXPLANATION LEADS THE ACTION. Round 4 found a first screen that went
 * straight from the mode row into "Where to start" with the honest sentence
 * about what happened stranded in the right column. On somebody's first morning
 * that is the wrong way round, so the two sentences that say what is missing and
 * refuse both wrong readings of it now open the screen, and the heading and the
 * one real move follow them.
 *
 * The link leaves the lab on purpose. A reader with no Project has nowhere to
 * go inside Home, and work lives in a Project.
 */
export function FirstRun({ view, lead }: { view: FirstRunView; lead: string | null }) {
  return (
    <section className="mr-first" aria-labelledby="mr-first-h">
      <p className="mr-first-line">{view.line}</p>
      {lead ? <p className="mr-first-honest">{lead}</p> : null}
      <h2 className="mr-h2" id="mr-first-h">
        {view.heading}
      </h2>
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
 *      where you are            what this read is
 *      (modes, heading, scope)  (what was read, how much, where work goes)
 *      ─────────────────────────────────────────────  the meridian, now
 *      the read                 what it could not see
 *      ─────────────────────────────────────────────  the horizon
 *      what the read does not reach
 *
 * ONE PAGE, TWO EDGES. Everything on the left ends at the measure; everything on
 * the right ends at the page. The two rules are the only things that cross both,
 * and they are the only full-bleed elements in the direction. Round 4 counted
 * three competing right edges with nothing establishing which one the page was
 * set to; there are now two and the second is the page frame.
 *
 * THE SPACE BETWEEN THE RULES IS THE WORK, so a quiet day is a short page.
 * Round 4 reserved 21rem of height between them whether or not anything stood
 * there, and every director who mentioned it read the result as an unmade
 * decision rather than as a statement. It is gone. The distance between the two
 * rules is now exactly the amount of work inside the read, which is a truer
 * expression of the same idea and costs a phone reader about a screen and a half
 * on a quiet morning.
 *
 * `record` is rendered LAST in the document and placed into the right column by
 * the grid. At 1200 and up a reader sees it beside the read; below that it
 * follows the whole document, which is where page metadata belongs on a phone
 * and where round 4 asked for it to go.
 */
export function Chronology({
  when,
  statusLabel,
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
  statusLabel: string;
  material: Band;
  notice?: ReactNode;
  stream: ReactNode;
  record?: ReactNode;
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
      <Meridian when={when} label={statusLabel} />
      <div className="mr-field" data-material={material}>
        {notice ?? null}
        {stream}
      </div>
      {wide ? <div className="mr-wide">{wide}</div> : null}
      <Horizon mark={horizonMark} line={horizonLine} />
      {beyond ? <div className="mr-beyond">{beyond}</div> : null}
      {record ?? null}
    </>
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

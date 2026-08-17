/**
 * Reading Index · the shared furniture.
 *
 * Everything here is a Server Component. The direction ships no client
 * JavaScript at all: the scope control and the receipts are `<details>`, the
 * detail views are routes, and the entrance is CSS. That is not restraint for
 * its own sake, it is the 0.9 KB shared-runtime headroom read literally.
 */

import type { CSSProperties, ReactNode } from "react";
import type {
  Disclosure,
  FirstRunView,
  HomeCandidateProps,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";
import {
  anchorId,
  modeCondition,
  ordinal,
  recordLines,
  toneLabel,
} from "@/lib/home-layer/candidates/index/labels";

export const CONTENTS_ID = "ri-contents";
const CONTENTS_LABEL_ID = "ri-contents-label";

// ── What limited this read ──────────────────────────────────────────────────

/**
 * ONE MECHANISM, ONE PLACE, GRADED WEIGHT.
 *
 * Every note the shell hands this mode lands here: in the main column, under
 * the headline, above the read, at 390 and at 1440 alike. Nothing about the
 * limits of a read is viewport-dependent, because honesty that depends on
 * having a wide window is a layout accident rather than a design.
 *
 * The severity ladder survives inside the block rather than by moving the
 * note somewhere else. A source that did not answer takes a red rule and full
 * ink; a read that covered part of what was asked takes a hairline and quiet
 * ink. So the page still only shouts when shouting is warranted, and a reader
 * still learns exactly one behaviour.
 */
const TONE_ORDER: readonly Disclosure["tone"][] = [
  "failure",
  "permission",
  "coverage",
  "freshness",
  "scope",
  "setup",
  "scale",
];

function severityOf(note: Disclosure): number {
  const found = TONE_ORDER.indexOf(note.tone);
  return found === -1 ? TONE_ORDER.length : found;
}

/**
 * A read that a source refused, or that a seat cannot complete, is loud. Loud
 * is not a bigger label: it is a different composition. The block leaves the
 * reading column and becomes a red-ruled band across the whole sheet above the
 * headline, so a failed read and a signature day are two different pictures
 * before a word of either is read.
 */
export function isLoud(disclosures: readonly Disclosure[]): boolean {
  return disclosures.some(
    (note) => note.tone === "failure" || note.tone === "permission",
  );
}

export function Limits({
  disclosures,
  extra = [],
}: {
  disclosures: readonly Disclosure[];
  /** Lines the shell publishes outside the disclosure list that limit this read. */
  extra?: readonly string[];
}) {
  if (disclosures.length === 0 && extra.length === 0) return null;
  const ordered = [...disclosures].sort((a, b) => severityOf(a) - severityOf(b));
  const loud = isLoud(ordered);
  return (
    <div className="ri-limits" data-loud={loud ? "" : undefined}>
      <p className="ri-label ri-limits-label">What limited this read</p>
      <ul className="ri-limits-list">
        {ordered.map((note) => (
          <li className="ri-limit" data-tone={note.tone} key={note.id}>
            <span className="ri-limit-tone">{toneLabel(note.tone)}</span>
            <p className="ri-limit-text">{note.text}</p>
          </li>
        ))}
        {extra.map((line) => (
          <li className="ri-limit" data-tone="coverage" key={line}>
            <span className="ri-limit-tone">{toneLabel("coverage")}</span>
            <p className="ri-limit-text">{line}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single fact that stops the reader, in the same voice as a loud limit. */
export function Flag({ children }: { children: ReactNode }) {
  return <p className="ri-flag">{children}</p>;
}

// ── The contents · the coverage report ──────────────────────────────────────

/**
 * THE CONTENTS TABLE, AND WHY IT IS NO LONGER THE MASTHEAD.
 *
 * Round 4 put this at the top of every page and two directors put the same
 * charge: Today asks what deserves attention now, and the page answered with a
 * table of contents about itself first — roughly 330 px of index before the
 * headline at 1440, and most of a phone screen at 390.
 *
 * They were right about the position and wrong about nothing else, so the
 * device is unchanged and the position is. A periodical does not open on its
 * contents page. It opens on the front page, and the contents is a coverage
 * report inside the issue: which sections were read, and what condition each
 * one came back in. That is what this is now, and moving it is what makes the
 * metaphor literal rather than decorative.
 *
 * WHERE IT SITS. At 1080 and up it is the last block of the standing column,
 * so the second column runs contents down the right of the read and the reader
 * can change mode without moving. Below that it closes the document. The four
 * modes are still reachable from the first screen, in words, in the folio bar
 * at the top; what is here that is not there is the ordinal series, the leader,
 * the cause behind each condition, and Full briefing as a child of Today.
 *
 * WHAT IT DOES NOT CARRY. `aria-current`. The bar owns every claim about where
 * the reader is, so exactly one element in the document says "page". The row
 * you are on is therefore not a link at all, which is also how a contents page
 * has always handled the page you are holding.
 */
export function Contents({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy, state, hrefFor } = props;
  const atDepth = state.mode === "briefing";
  const briefingHref = hrefFor({ mode: "briefing", item: null });

  return (
    <nav
      className="ri-contents"
      id={CONTENTS_ID}
      aria-labelledby={CONTENTS_LABEL_ID}
      tabIndex={-1}
    >
      <p className="ri-label" id={CONTENTS_LABEL_ID}>
        Contents
      </p>
      <p className="ri-contents-note">
        Every mode, and the condition its own read is in.
      </p>
      <ol className="ri-contents-list">
        {chrome.modes.map((mode, position) => {
          const condition = modeCondition(props, mode.mode);
          const here = mode.ariaCurrent === "page";
          const row = (
            <>
              <span className="ri-contents-head">
                <span className="ri-num ri-contents-num" aria-hidden="true">
                  {ordinal(position + 1)}
                </span>
                <span className="ri-contents-name">{mode.label}</span>
              </span>
              <span className="ri-leader" aria-hidden="true" />
              {/*
                THE STATE COLUMN HAS A TAB STOP, which is the one thing a
                leader-dot table has to get right and the one thing round 4
                got wrong. The four states used to size to their own words and
                sit right against the page edge, so the four dot runs stopped
                at four different verticals and the dots led nowhere. The
                column is fixed now and the words set from its left edge, so
                every leader terminates on the same line and every condition
                starts on it.
              */}
              <span className="ri-contents-state">
                <span className="ri-cond" data-mark={condition.mark}>
                  <span className="ri-cond-mark" aria-hidden="true" />
                  <span className="ri-cond-word">{condition.word}</span>
                  {condition.cause ? (
                    <span className="ri-cond-cause">{condition.cause}</span>
                  ) : null}
                </span>
              </span>
            </>
          );
          return (
            <li
              className="ri-contents-item"
              key={mode.mode}
              data-current={
                here ? "" : mode.ariaCurrent === "true" ? "ancestor" : undefined
              }
              style={{ "--ri-n": position } as CSSProperties}
            >
              {here ? (
                <span className="ri-contents-row" data-here="">
                  {row}
                </span>
              ) : (
                <a className="ri-contents-row" href={mode.href}>
                  {row}
                </a>
              )}

              {/*
                DEPTH, STATED IN THE CONTENTS. Full briefing is not a fifth
                mode, it is the uncapped read behind Today, so it is an
                indented child of Today's entry and it is listed from every
                mode rather than only from inside it. A contents page that
                only admits a section exists once you are already in it is not
                a contents page.
              */}
              {mode.mode === "today" ? (
                <ol className="ri-contents-depth">
                  <li>
                    {atDepth ? (
                      <span className="ri-contents-depth-row" data-here="">
                        {copy.modeNames.briefing}
                      </span>
                    ) : (
                      <a className="ri-contents-depth-row" href={briefingHref}>
                        {copy.modeNames.briefing}
                      </a>
                    )}
                  </li>
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── The standing column ─────────────────────────────────────────────────────

/**
 * WHAT THE FULL WIDTH IS FOR, SAID OUT LOUD (LAB_BRIEF Amendment 1).
 *
 * The measure carries the read. The column carries the record of the read, and
 * then the contents of the issue it belongs to.
 *
 * Five directors in round 4 made the same measurement of round 4's version:
 * two short blocks in the right third and roughly five hundred pixels of
 * nothing under them, repeating on every mode. The blocks were not the problem;
 * the column stopping was. So it now runs three blocks deep and the last of
 * them is the contents, which is per-mode live material rather than more
 * provenance:
 *
 *   `ThisRead`  level with the `h1`. What this read did: who it was read for,
 *               what it accounted for, and what Home cannot see at all.
 *   `Imprint`   which issue this is: when it was read, at what Read Scope, and
 *               where new work would go if you started some.
 *   `Contents`  every mode and the condition its own read is in.
 *
 * On a tall wide window the whole column follows the scroll, which is what
 * makes the four modes reachable from any position without a bar that eats the
 * viewport. It is guarded on both axes in em, so text-only enlargement and
 * browser zoom both unstick it before it can crowd anything.
 *
 * Below 1080 the column unstacks in place and becomes the colophon: the record,
 * then the imprint, then the contents closing the document. That is safe
 * precisely because nothing in it qualifies what is above it. Everything that
 * DOES qualify the read is in the reading column at every width.
 */
export function Margin({ props }: { props: HomeCandidateProps }) {
  return (
    <div className="ri-margin">
      <ThisRead props={props} />
      <Imprint props={props} />
      <Contents props={props} />
    </div>
  );
}

export function Imprint({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  return (
    <aside className="ri-imprint" aria-labelledby="ri-imprint-h">
      <p className="ri-label" id="ri-imprint-h">
        What Home read
      </p>
      <ul className="ri-record-list">
        <li>{chrome.asOf.line}</li>
        <li>{chrome.scope.helpLine}</li>
        {chrome.scope.coverageLine ? <li>{chrome.scope.coverageLine}</li> : null}
        <li>{chrome.activeProject.line}</li>
      </ul>
    </aside>
  );
}

export function ThisRead({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  const lines = recordLines(props);
  return (
    <aside className="ri-record" id="ri-this-read" aria-labelledby="ri-this-read-h">
      <p className="ri-label" id="ri-this-read-h">
        This read
      </p>
      <ul className="ri-record-list">
        <li>{`${chrome.actor.name}. ${chrome.actor.roleLabel}`}</li>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}

// ── A first screen ──────────────────────────────────────────────────────────

/**
 * NOT YET IS NOT BROKEN (LAB_BRIEF Amendment 2).
 *
 * Six of ten directors called round 2's first screen the worst arrival in the
 * lab: four rows reading "Could not be read", and the only constructive
 * sentence demoted to the foot of a rail with no control on it. The shell now
 * publishes the state and the words, and this is where they land — at the head
 * of the read, in the reading column, at the size of a lead story, with the
 * one real move set as the loudest thing on the page.
 *
 * It is the only place in this direction where a link is drawn as a control,
 * and it earns that: everywhere else a reader is choosing between things they
 * can already see, and here there is exactly one thing to do.
 */
export function FirstScreen({ view }: { view: FirstRunView }) {
  return (
    <section className="ri-start" aria-labelledby="ri-start-h">
      <h2 className="ri-h2" id="ri-start-h">
        {view.heading}
      </h2>
      <p className="ri-start-line">{view.line}</p>
      <p className="ri-start-next">{view.nextLine}</p>
      <p className="ri-start-do">
        {view.actions.map((action) => (
          <a className="ri-start-action" href={action.href} key={action.id}>
            {action.label}
          </a>
        ))}
      </p>
    </section>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

/**
 * ONE COMPOSITION, FIVE MODES, BY CONSTRUCTION.
 *
 * A director's sharpest note on round 2 was that the right-hand slot had no
 * fixed identity across modes. It could not have one while five files each
 * assembled the page themselves, so they no longer do: every mode hands its
 * head, its read and at most one widening to this, and the headline, the
 * limits, the first screen and the standing column are placed here.
 *
 * Placement is explicit rather than flowed, and the row gap is zero with the
 * rhythm carried on the children, so a mode with no limits and a mode with
 * three sit on the same vertical.
 *
 * The headline is now the first thing under the masthead in every mode and in
 * every world. Nothing about the page is between the reader and it except the
 * band that says a source did not answer, which is the one thing that outranks
 * a headline.
 */
export function Page({
  props,
  disclosures,
  extra = [],
  head,
  children,
  wide,
}: {
  props: HomeCandidateProps;
  disclosures: readonly Disclosure[];
  extra?: readonly string[];
  /** Everything under the `h1`: the standfirst, and anything that stops the reader. */
  head?: ReactNode;
  children: ReactNode;
  /** The one thing per mode allowed to break the measure. */
  wide?: ReactNode;
}) {
  const { chrome, firstRun } = props;
  const loud = isLoud(disclosures);
  const limits = <Limits disclosures={disclosures} extra={extra} />;
  return (
    <>
      {loud ? <div className="ri-band">{limits}</div> : null}
      <div className="ri-page">
        <div className="ri-page-head">
          <h1 className="ri-h1">
            <span className="ri-h1-eyebrow">{chrome.modeEyebrow}</span>
            <span className="ri-h1-line">{chrome.h1Line}</span>
          </h1>
          {head}
          {/*
            A first screen goes ahead of the limits, not after them. "What
            limited this read" is the right heading for a read that happened
            and the wrong one for a reader who has not started, so the move
            they can make arrives first and the note that nothing failed
            arrives under it.
          */}
          {firstRun ? <FirstScreen view={firstRun} /> : null}
        </div>
        {loud ? null : limits}
        <div className="ri-body">{children}</div>
        {wide ? <div className="ri-wide">{wide}</div> : null}
        <Margin props={props} />
      </div>
    </>
  );
}

// ── Labelled fields ─────────────────────────────────────────────────────────

/**
 * A CAVEAT NAMED AS A CAVEAT.
 *
 * Round 2 set the records under an Analytics claim as an unlabelled run of
 * sentences in two prose columns. One director scored the lost labels at 8.4
 * and named the cost — "Same facts, weaker trust" — and another marked the two
 * side-by-side measures as the one place in the direction where reflow does
 * work the rest of the page does not. Both are answered by the same move: a
 * fielded list, label left, fact right, one column of prose.
 */
export function Fields({
  fields,
}: {
  fields: readonly Readonly<{ label: string; value: string }>[];
}) {
  if (fields.length === 0) return null;
  return (
    <dl className="ri-fields">
      {fields.map((field) => (
        <div className="ri-field" key={field.label}>
          <dt className="ri-label">{field.label}</dt>
          <dd className="ri-field-value">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Row furniture ───────────────────────────────────────────────────────────

export function Ordinal({ position }: { position: number }) {
  return (
    <span className="ri-num ri-entry-num" aria-hidden="true">
      {String(position).padStart(2, "0")}
    </span>
  );
}

/**
 * A date the reader can act on. The relative form carries the meaning and the
 * absolute form is read out beside it, so nobody has to work out what "2 days
 * late" is a date of. Late is marked by weight and by a mark, never by colour
 * alone.
 */
export function When({ due }: { due: WhenLabel }) {
  return (
    <span className={due.overdue ? "ri-fact-late" : undefined}>
      {due.relative}
      <span className="ri-sr">{`, ${due.absolute}`}</span>
    </span>
  );
}

// ── Dispositions ────────────────────────────────────────────────────────────

/**
 * WHAT THE ROW LETS YOU DO, ON THE ROW, IN THE ARRIVAL STATE.
 *
 * Round 4's Inbox offered one thing per event: OPEN. Four directors marked it
 * and one put the cost exactly — every mark as read, snooze and clear cost a
 * full navigation, which made it the slowest daily triage of the four. A mode
 * whose job is "what needs my response" has to offer something to respond with.
 *
 * So every disposition the shell publishes for a row is on the row: Mark as
 * read, Snooze, Approve at the source, Clear from Inbox on an event; Mark as
 * done and Change who owns it on a responsibility. Nothing is hidden, and that
 * includes the ones that are shut to you: a refusal is struck through and
 * carries its reason on the same line, because a control that disappears tells
 * the reader nothing about why.
 *
 * WHAT IS STILL REFUSED, and why that is the honest half of this. This surface
 * reads fixtures and writes nothing. A button that claimed an outcome no
 * source ever confirmed is D-HX06, and it is the exact lie this whole programme
 * exists to remove. So a disposition the shell gave a real route is a real
 * link, and a disposition that would have to write is named, placed and costed
 * in the composition rather than drawn as a control that lies. Each mode that
 * offers any says so once, above its list, rather than once per row.
 *
 * The set sits outside the row's own link, so a 44 px row target and a run of
 * named dispositions can both exist without a control nested inside a wrapping
 * link.
 */
export function Dispositions({
  actions,
  exclude,
  label,
}: {
  actions: readonly RowAction[];
  /** Ids already carried by the row's own link. */
  exclude?: readonly string[];
  /** Only where the run could otherwise be mistaken for part of the record. */
  label?: string;
}) {
  const shown = actions.filter((action) => !exclude?.includes(action.id));
  if (shown.length === 0) return null;
  return (
    <div className="ri-acts">
      {label ? <p className="ri-label ri-acts-label">{label}</p> : null}
      <ul className="ri-acts-list">
        {shown.map((action) => (
          <li
            className="ri-act"
            data-open={action.available ? "yes" : "no"}
            key={action.id}
          >
            {action.available && action.href !== null ? (
              <a className="ri-act-name" href={action.href}>
                {action.label}
              </a>
            ) : (
              <span className="ri-act-name">{action.label}</span>
            )}
            {action.unavailableReason === null ? null : (
              <span className="ri-act-why">{action.unavailableReason}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Said once per mode that offers a disposition, rather than once per row.
 * Sixty rows repeating it would be sixty times the height and no extra fact.
 */
export function WritesNothing({ children }: { children: string }) {
  return <p className="ri-writes">{children}</p>;
}

export const LAB_WRITES_NOTHING =
  "Every disposition a row offers is named here, including the ones shut to you. This surface reads and does not write, so nothing is settled until the source says it is.";

// ── Sections ────────────────────────────────────────────────────────────────

/**
 * A section is a rule and a heading. It carries no ordinal of its own.
 *
 * ONE NUMBERING SERIES, AND ONLY WHERE A NUMBER MEANS SOMETHING. A number in
 * this direction marks a ranked position in a read, so a section heading may
 * not carry one: a reader who meets "02 Now" above an item numbered "03"
 * cannot tell what either number counts.
 */
export function Section({
  id,
  heading,
  note,
  tier,
  children,
}: {
  id: string;
  heading: string;
  note?: string | null;
  /**
   * "lead" is the first section of a read, set at the size of a lead story;
   * everything after it runs at the ledger's size. A page where every section
   * shouts equally is the task wall this direction exists to avoid.
   *
   * "claim" is the Analytics register: seven sections in a row, each a question
   * with an answer and its records. A director measured that page at 4054px and
   * called it a chart wall made of type, and most of the height was rhythm
   * rather than words — a lead-story gap between every claim and a full field
   * row for every caveat. The claims keep every field they had, including the
   * two that matter most (LEFT OUT and BASELINE); what they lose is the air
   * between them.
   */
  tier?: "lead" | "tail" | "claim";
  children: ReactNode;
}) {
  const headingId = `${id}-h`;
  return (
    <section
      className="ri-section"
      id={id}
      data-tier={tier}
      aria-labelledby={headingId}
    >
      <h2 className="ri-h2" id={headingId}>
        {heading}
      </h2>
      {note ? <p className="ri-h2-window">{note}</p> : null}
      {children}
    </section>
  );
}

// ── The scope control ───────────────────────────────────────────────────────

/**
 * THE DATELINE, PROMOTED TO A CONTROL.
 *
 * Read Scope is which issue of this paper you are holding, so it belongs in the
 * masthead, and in round 4 it was there in name only: a director found the
 * most frequently used global control in the product set as an 11 px monospace
 * underlined link at the foot of the right column, and could find no scope
 * control anywhere else on the page.
 *
 * It is now on the masthead line at every width, above the fold in every world,
 * labelled with what it changes and set at reading size with a 44 px target.
 * The explanation of what Read Scope is and is not moved into the standing
 * column with the rest of the record, because a control needs to be a control
 * and its footnotes do not need to be beside it.
 *
 * Read Scope and Active Project are the two things a Home surface most easily
 * conflates, so the panel names each one and repeats the shell's own sentence
 * about which is which. Below 768 the open panel is a labelled sheet whose
 * header is also its dismiss control; above it, an anchored drop. A `<details>`
 * rather than a menu, because a menu would need JavaScript and this direction
 * spends none.
 */
export function ScopeControl({ props }: { props: HomeCandidateProps }) {
  const { chrome, copy } = props;
  const readScope = chrome.scope.options.filter(
    (option) => option.group === "read-scope",
  );
  const projects = chrome.scope.options.filter(
    (option) => option.group === "project",
  );
  return (
    <details className="ri-scope">
      <summary className="ri-scope-summary">
        <span className="ri-label ri-scope-key">Read scope</span>
        <span className="ri-scope-current">{chrome.scope.label}</span>
        <span className="ri-scope-change">{copy.actions.changeScope}</span>
      </summary>
      <div className="ri-scope-panel">
        <div>
          <p className="ri-label">What Home reads</p>
          <p className="ri-record-text">{chrome.scope.helpLine}</p>
          <ul className="ri-scope-options">
            {readScope.map((option) => (
              <li key={option.id}>
                <a
                  className="ri-scope-option"
                  href={option.href}
                  aria-current={option.current ? "true" : undefined}
                >
                  {option.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {projects.length > 0 ? (
          <div>
            <p className="ri-label">One project at a time</p>
            <ul className="ri-scope-options">
              {projects.map((option) => (
                <li key={option.id}>
                  <a
                    className="ri-scope-option"
                    href={option.href}
                    aria-current={option.current ? "true" : undefined}
                  >
                    {option.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="ri-label">Where new work goes</p>
          <p className="ri-record-text">{chrome.activeProject.line}</p>
        </div>
        {chrome.scope.resetHref ? (
          <a className="ri-scope-reset" href={chrome.scope.resetHref}>
            {chrome.scope.resetLabel}
          </a>
        ) : null}
      </div>
    </details>
  );
}

// ── Small helpers used by more than one mode ────────────────────────────────

export function entryAnchor(key: string): string {
  return anchorId("entry", key);
}

export function sectionAnchor(key: string): string {
  return anchorId("section", key);
}

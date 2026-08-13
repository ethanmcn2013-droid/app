/**
 * Reading Index · the shared furniture.
 *
 * Everything here is a Server Component. The direction ships no client
 * JavaScript at all: the scope control and the receipts are `<details>`, the
 * detail views are routes, and the entrance is CSS. That is not restraint for
 * its own sake, it is the 0.9 KB shared-runtime headroom read literally.
 */

import type { ReactNode } from "react";
import type {
  Disclosure,
  FirstRunView,
  HomeCandidateProps,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";
import {
  anchorId,
  recordLines,
  toneLabel,
} from "@/lib/home-layer/candidates/index/labels";

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
 * reading column, becomes a red-ruled band across the whole sheet above the
 * headline, and takes a wash of the same red with it, so a failed read and a
 * signature day are two different pictures before a word of either is read.
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

// ── The standing column ─────────────────────────────────────────────────────

/**
 * WHAT THE FULL WIDTH IS FOR, SAID OUT LOUD (LAB_BRIEF Amendment 1).
 *
 * The measure carries the read. The column carries the imprint of the read.
 *
 * Round 2 hung one short block in the right third with five hundred pixels of
 * nothing above it, and eight of ten directors called the arrival screen
 * unfinished. They were right, and the fault was not that the block existed —
 * it was that the block was flow-positioned against a full-width heading, so
 * its top edge landed wherever the headline happened to end.
 *
 * So the page is now two columns from the top rule of the masthead to the
 * foot, and the second one is continuously occupied:
 *
 *   `Imprint`   level with the masthead. Which issue this is: when it was
 *               read, what Read Scope it was read at, and where new work
 *               would go if you started some.
 *   `ThisRead`  level with the `h1`. What this read did: who it was read for,
 *               what it accounted for, and what Home cannot see at all.
 *
 * Both are ruled blocks on one right edge, so the column reads as a column
 * rather than as two orphans. Neither is sticky and neither is fixed: a rail
 * that follows the reader is a layout-thrash surface and it eats the viewport
 * at 400% zoom, which a director measured against this direction and was
 * right about.
 *
 * Below 1080 the column unstacks in place: the imprint stays in the front
 * matter where the dateline belongs, and the record becomes a colophon at the
 * foot, which is safe precisely because nothing in it qualifies what is above
 * it. Everything that DOES qualify the read is in the reading column at every
 * width.
 */
export function Imprint({ props }: { props: HomeCandidateProps }) {
  const { chrome } = props;
  return (
    <div className="ri-imprint">
      <p className="ri-label">What Home read</p>
      <p className="ri-imprint-line">{chrome.asOf.line}</p>
      <ScopeControl props={props} />
      <p className="ri-imprint-line">{chrome.scope.helpLine}</p>
      {chrome.scope.coverageLine ? (
        <p className="ri-imprint-line">{chrome.scope.coverageLine}</p>
      ) : null}
      <p className="ri-imprint-line">{chrome.activeProject.line}</p>
    </div>
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
        <ThisRead props={props} />
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

/**
 * What a row lets you do, and what it does not.
 *
 * `restrictions` is the ledger rhythm: sixty rows that all allow the same two
 * things say nothing by saying so, while a row that refuses one has to say
 * why. `all` is the queue rhythm: on a decision you are about to make, the
 * shape of the decision is the content.
 *
 * Nothing here is a control. This surface reads fixtures and writes nothing,
 * so an affordance that looked like a button would be the exact dead control
 * the brief forbids. Names and reasons, in text, inside the row's own link.
 */
export function Perms({
  actions,
  show,
  label,
}: {
  actions: readonly RowAction[];
  show: "all" | "restrictions";
  /** Only where the list could otherwise be mistaken for a row of controls. */
  label?: string;
}) {
  const shown = actions.filter(
    (action) =>
      action.href === null && (show === "all" || action.available === false),
  );
  if (shown.length === 0) return null;
  return (
    <>
      {label ? <p className="ri-label ri-perms-label">{label}</p> : null}
      <ul className="ri-perms">
      {shown.map((action) => (
        <li
          className="ri-perm"
          data-open={action.available ? "yes" : "no"}
          key={action.id}
        >
          <span className="ri-perm-name">{action.label}</span>
          {action.unavailableReason === null ? null : (
            <span className="ri-perm-why">{action.unavailableReason}</span>
          )}
        </li>
      ))}
      </ul>
    </>
  );
}

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
   */
  tier?: "lead" | "tail";
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
 * THE DATELINE. Not a form field, and not in the reading path.
 *
 * Read Scope is which issue of this paper you are holding, so it is set as a
 * dateline in the masthead and opens from there. It used to sit between the
 * headline and the first sentence, drawn as a select: administrative chrome
 * placed ahead of the read, and the loudest thing on the page at the exact
 * point where the day's first decision should be.
 *
 * Read Scope and Active Project are the two things a Home surface most easily
 * conflates, so the panel names each one and repeats the shell's own sentence
 * about which is which. Below 768 the open panel is a labelled sheet whose
 * header is also its dismiss control; above it, an anchored drop. A
 * `<details>` rather than a menu, because a menu would need JavaScript and
 * this direction spends none.
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
        <span className="ri-scope-current">{chrome.scope.label}</span>
        <span className="ri-scope-change">{copy.actions.changeScope}</span>
      </summary>
      <div className="ri-scope-panel">
        <div>
          <p className="ri-label">What Home reads</p>
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

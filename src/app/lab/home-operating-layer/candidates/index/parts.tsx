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
  HomeCandidateProps,
  RowAction,
  WhenLabel,
} from "@/lib/home-layer/lab-shell";
import { anchorId, toneLabel } from "@/lib/home-layer/candidates/index/labels";

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
  const loud = ordered.some(
    (note) => note.tone === "failure" || note.tone === "permission",
  );
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

// ── The margin ──────────────────────────────────────────────────────────────

/**
 * THE RIGHT COLUMN, AND THE ONE THING IT IS.
 *
 * It is the record of this read: who it was read for, what the read did, what
 * it left out, what Home cannot see at all, and where new work would go. Not
 * navigation, not caveats that change whether to believe the page — those are
 * above the read, in the reading path, where they belong.
 *
 * It is the same block in all five modes, so the reader learns one place, and
 * it is never empty: the actor and the Active Project are facts about every
 * read there is. At 1080 and above it sits in the margin beside the read; below
 * that it is a colophon at the foot, which is where a colophon belongs and is
 * safe precisely because nothing in it qualifies what is above it.
 */
export function ThisRead({
  props,
  lines = [],
}: {
  props: HomeCandidateProps;
  lines?: readonly (string | null)[];
}) {
  const { chrome } = props;
  const shown = lines.filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  );
  return (
    <div className="ri-record" id="ri-this-read">
      <p className="ri-label">This read</p>
      <ul className="ri-record-list">
        <li>{`${chrome.actor.name}. ${chrome.actor.roleLabel}`}</li>
        {shown.map((line) => (
          <li key={line}>{line}</li>
        ))}
        <li>{chrome.activeProject.line}</li>
      </ul>
    </div>
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
        <p className="ri-record-text">{chrome.scope.helpLine}</p>
        {chrome.scope.coverageLine ? (
          <p className="ri-record-text">{chrome.scope.coverageLine}</p>
        ) : null}
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

// ── The heading block ───────────────────────────────────────────────────────

export function PageHead({
  props,
  children,
}: {
  props: HomeCandidateProps;
  children?: ReactNode;
}) {
  const { chrome } = props;
  return (
    <div className="ri-page-head">
      <h1 className="ri-h1">
        <span className="ri-h1-eyebrow">{chrome.modeEyebrow}</span>
        <span className="ri-h1-line">{chrome.h1Line}</span>
      </h1>
      {children}
    </div>
  );
}

// ── Small helpers used by more than one mode ────────────────────────────────

export function entryAnchor(key: string): string {
  return anchorId("entry", key);
}

export function sectionAnchor(key: string): string {
  return anchorId("section", key);
}

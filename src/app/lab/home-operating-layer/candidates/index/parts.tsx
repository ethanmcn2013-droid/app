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

// ── The margin ──────────────────────────────────────────────────────────────

/**
 * The notes on this read, set in the margin at 1080 and above and directly
 * under the heading below it.
 *
 * Every disclosure the shell hands over is rendered. None is behind a control:
 * the direction's whole argument is that a document tells you what it could
 * not see before it tells you what it saw, and a note that has to be opened is
 * a note a reader at 7am does not open. The cost is real and it is paid in the
 * worlds that deserve it, because an ordinary day carries none of these.
 */
export function Notes({
  disclosures,
  heading,
}: {
  disclosures: readonly Disclosure[];
  heading: string;
}) {
  if (disclosures.length === 0) return null;
  return (
    <div className="ri-notes-block">
      <p className="ri-label">{heading}</p>
      <ul className="ri-notes-list">
        {disclosures.map((note) => (
          <li className="ri-note" data-tone={note.tone} key={note.id}>
            <span className="ri-note-tone">{toneLabel(note.tone)}</span>
            <p className="ri-note-text">{note.text}</p>
          </li>
        ))}
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

// ── The section index ───────────────────────────────────────────────────────

/**
 * The contents page, one level down. It renders only when the page has two or
 * more places to go, which is the same rule the mode index answers to: an
 * index of one entry is furniture.
 *
 * It lives in the margin, so at 1080 and above it is a vertical contents list
 * beside the read and at narrower widths it is a wrapped strip under the
 * heading. Same links, same words, same order, in both.
 */
export function SectionIndex({
  entries,
  label,
}: {
  entries: readonly Readonly<{ id: string; heading: string }>[];
  label: string;
}) {
  if (entries.length < 2) return null;
  return (
    <nav className="ri-sections" aria-label={label}>
      <p className="ri-label ri-sections-label" aria-hidden="true">
        On this page
      </p>
      <ul className="ri-sections-list">
        {entries.map((entry, position) => (
          <li key={entry.id}>
            <a className="ri-sections-link" href={`#${entry.id}`}>
              <span className="ri-num" aria-hidden="true">
                {String(position + 1).padStart(2, "0")}
              </span>
              {entry.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The margin. It carries the contents list and the notes on the read, and it
 * does not exist at all when it would carry neither — an empty grid cell
 * spends two gaps of vertical space at 390 and gives nothing back.
 */
export function Margin({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="ri-notes" id="ri-margin">
      {children}
    </div>
  );
}

/**
 * WHICH NOTES ARE FRONT MATTER AND WHICH ARE MARGINALIA.
 *
 * Measured at 390: with every note above the read, My work's first
 * responsibility sat 1,078 px down the page. That is not honesty, it is a
 * reader who never reaches their work.
 *
 * So the split is by what the note is for. A note that says the read cannot be
 * trusted — a source that did not answer, a seat that cannot see everything —
 * changes whether you should believe the next screen, and stays above it at
 * every width. A note that says what the read left out is a margin note: beside
 * the text where there is a margin, after it where there is not. Neither is
 * ever behind a control, and the index leader lines carry the condition of all
 * four modes at the top of every viewport regardless.
 */
export function splitNotes(disclosures: readonly Disclosure[]) {
  const blocking = disclosures.filter(
    (note) => note.tone === "failure" || note.tone === "permission",
  );
  const marginal = disclosures.filter(
    (note) => note.tone !== "failure" && note.tone !== "permission",
  );
  return { blocking, marginal };
}

// ── Sections ────────────────────────────────────────────────────────────────

export function Section({
  id,
  heading,
  position,
  note,
  tier,
  children,
}: {
  id: string;
  heading: string;
  position: number;
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
        <span className="ri-num" aria-hidden="true">
          {String(position).padStart(2, "0")}
        </span>
        {heading}
      </h2>
      {note ? <p className="ri-h2-window">{note}</p> : null}
      {children}
    </section>
  );
}

// ── The scope control ───────────────────────────────────────────────────────

/**
 * One control, two axes, said apart.
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
        <span className="ri-label">{copy.actions.changeScope}</span>
        <span className="ri-scope-current">{chrome.scope.label}</span>
        <span className="ri-scope-mark" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="ri-scope-panel">
        <p className="ri-note-text">{chrome.scope.helpLine}</p>
        {chrome.scope.coverageLine ? (
          <p className="ri-note-text">{chrome.scope.coverageLine}</p>
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
          <p className="ri-note-text">{chrome.activeProject.line}</p>
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
      <ScopeControl props={props} />
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

/**
 * Signal Desk · the shared pieces.
 *
 * Every component here is a server component. The direction ships no client
 * JavaScript at all: depth is `<details>`, selection is the URL, and the only
 * motion is one CSS animation on one element.
 *
 * ROUND 2. The read state used to be a tinted band that appeared in every world,
 * so its presence said nothing and a quiet day and a broken provider arrived as
 * the same picture. The band is gone. What replaced it is a rule — the readline
 * — drawn immediately under the headline, whose GEOMETRY is the state:
 *
 *   complete   an unbroken rule across the whole sheet
 *   partial    the same rule with a hole cut in it
 *   refused    the rule runs a third of the way and stops, in one alarm ink
 *
 * ROUND 3 adds the fourth, and it is the one the whole lab got wrong:
 *
 *   notyet     a dashed rule, in the quiet ink. The line has not been drawn
 *              because there is nothing to draw it for.
 *
 * A reader with no Project has not suffered a failed read. Dressing their first
 * morning in the refusal's red rule and the refusal's words is this programme's
 * governing rule pointed backwards, so `first-run` takes its own silhouette, its
 * own sentence and the only control this direction ever draws as a control.
 *
 * That is the spine's own grammar turned on its side: a line that breaks where
 * the read broke. It carries no tint, no box and no container, it differs before
 * a word is read, and the four states are still four different silhouettes in
 * greyscale, in forced colours and with every colour removed.
 */

import type { ReactNode } from "react";
import type {
  Disclosure,
  FirstRunView,
  HomeChrome,
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
  { mark: "broken", text: "The line breaks here. This could not be read." },
  { mark: "now", text: "Asking for you today, or already late." },
  { mark: "soon", text: "Dated, and still ahead of you." },
  { mark: "waiting", text: "Waiting on somebody or something else." },
  { mark: "held", text: "Handled, cleared or archived. It is closed." },
  { mark: "reading", text: "A reading taken from several items, not one item." },
  { mark: "plain", text: "No mark. It is in the list with nothing pressing about it." },
];

/**
 * WHEN A PAGE IS ALLOWED TO CARRY A KEY, and why the number is three.
 *
 * Round 2 printed the whole seven-mark legend at the foot of every page,
 * including the quiet day, where not one marked row existed and the key was the
 * largest block on the screen. That is the exact thing the brief rejects on
 * sight — empty furniture used to fill a quiet day — and it was being spent on
 * the emptiest screen in the product.
 *
 * The legend is now built from the marks THIS page actually drew, and it renders
 * only when three or more distinct marks are on it. Below three, a reader can
 * hold the shapes against the words beside them without a reference; the key
 * would be teaching a system that is not on the page. A quiet day has no marked
 * rows at all, so it carries no key, and the fifty-row scale world carries a key
 * of exactly the marks it used.
 *
 * `plain` is the absence of a mark, so it is never counted toward the three. It
 * is still listed when it is on the page, because "this row deliberately has no
 * mark" is a fact worth stating once a key exists.
 */
const LEGEND_MIN_MARKS = 3;

const drawnMarkCount = (marks: ReadonlySet<MarkKind>): number =>
  [...marks].filter((mark) => mark !== "plain").length;

export function legendEntries(
  marks: ReadonlySet<MarkKind>,
): readonly Readonly<{ mark: MarkKind; text: string }>[] {
  if (drawnMarkCount(marks) < LEGEND_MIN_MARKS) return [];
  return MARK_LEGEND.filter((entry) => marks.has(entry.mark));
}

/** A project that did not resolve breaks the line, whatever else is true. */
export function markForProvenance(provenance: Provenance, fallback: MarkKind): MarkKind {
  return provenance.projectName === null ? "broken" : fallback;
}

// ── The read state, classified ──────────────────────────────────────────────

/**
 * FOUR CLASSES, AND WHY THE SHELL'S OWN `state` IS NOT ENOUGH.
 *
 * `today.state` is `partial` on BOTH the partial-coverage world and the
 * provider-failure world, which is exactly why round 1 rendered them as the same
 * picture. The two are told apart one level down, in the disclosures the shell
 * hands over: a source that answered incompletely arrives as `tone: "coverage"`,
 * and a source that refused entirely arrives as `tone: "failure"` with a
 * different sentence. So the class is derived from the notes, not from the name.
 *
 *   complete   nothing about THIS read is unresolved
 *   partial    something answered for part of what was asked
 *   refused    something did not answer at all, or could not be reached
 *   notyet     there is no Project, so no read was attempted
 */
export type ReadClass = "complete" | "partial" | "refused" | "notyet";

export type ReadVerdict = Readonly<{
  klass: ReadClass;
  /** The class word, in the reader's own vocabulary. Leads the readline. */
  word: string;
  /** Every live note, in full. These are printed at the top, not counted. */
  notes: readonly Disclosure[];
  /** True only when the mode's own state is the ordinary one. */
  clean: boolean;
}>;

/** `scope-changed` is a note about the read, not a limit on it. */
const isLive = (note: Disclosure): boolean => note.state !== "ready";

const isRefusal = (note: Disclosure): boolean =>
  note.tone === "failure" || note.state === "unavailable" || note.state === "failed";

/**
 * One class word per note, used at the top of the read and again at the foot.
 *
 * `coverage-source-failed` arrives with `state: "partial"` and `tone: "failure"`,
 * so reading the state alone labelled a refusal "Partly read" in the notes while
 * the readline above it said "Did not answer". One derivation, used in both
 * places, is the only way those two stay the same word.
 */
export function noteWord(note: Disclosure, copy: HomeCopy): string {
  if (note.state === "unavailable" || note.state === "failed") return copy.states[note.state];
  if (note.tone === "failure") return "Did not answer";
  return copy.states[note.state];
}

export function readVerdict(
  state: HomeStateName,
  disclosures: readonly Disclosure[],
  copy: HomeCopy,
): ReadVerdict {
  /**
   * Before every other test, and it cannot be reached by looking at the notes.
   *
   * The shell's first-run disclosure is `tone: "setup"`, which the partial
   * branch below would have swept up and labelled with the ordinary limited
   * vocabulary. A reader who has not started is not a reader whose read came
   * back short, so the state name decides it and nothing else gets a vote.
   */
  if (state === "first-run") {
    return { klass: "notyet", word: copy.states["first-run"], notes: [], clean: false };
  }

  const notes = disclosures.filter(isLive);
  const refusal = notes.find(isRefusal);

  if (refusal) {
    /* "Did not answer" is lifted from the shell's own failure sentence rather
       than invented: a source that refused is not the same fact as a source
       that could not be reached, and the two take different words. */
    return { klass: "refused", word: noteWord(refusal, copy), notes, clean: false };
  }

  const first = notes[0];
  if (first) {
    return { klass: "partial", word: copy.states[first.state], notes, clean: false };
  }

  return {
    klass: "complete",
    word: copy.states[state],
    notes: [],
    clean: state === "ready",
  };
}

/**
 * THE READLINE. The whole of the read's state, in the second-most prominent
 * position on the page, said as a sentence rather than pointed at as a count.
 *
 * Round 1 put a pointer here — "3 notes at the foot say what this read could not
 * see" — which made the most important fact on the page a 1,700px scroll. The
 * substance is now printed where the reader is standing, in the shell's own
 * words, and the foot still holds the complete ledger for anyone who wants it.
 *
 * The rule above it is drawn by `desk.css` from `data-read`, and it is the only
 * thing on this page that has to be seen rather than read.
 */
export function ReadLine({
  verdict,
  chrome,
  standing,
  statusLabel,
  lead,
  legendHref,
}: {
  verdict: ReadVerdict;
  chrome: HomeChrome;
  /**
   * Limits that are true of every read, every day, for every reader — a kind of
   * work with no source at all. They are named in the metadata line and printed
   * in full at the foot, and they never raise the alarm, because a warning that
   * fires every morning stops being a warning by the time it matters.
   */
  standing: readonly Disclosure[];
  statusLabel: string;
  /** Replaces the composed sentence. The first screen's own line uses it. */
  lead?: string | null;
  /**
   * Set only when this page actually drew enough marks to earn a key. Round 2
   * left the key discoverable after 2,400px of scroll; six unexplained shapes
   * preceded their own explanation on every read.
   */
  legendHref?: string | null;
}) {
  const standingLine =
    standing.length === 0
      ? null
      : standing.length === 1
        ? "One kind of work has no source connected."
        : `${standing.length} kinds of work have no source connected.`;

  const note = verdict.notes[0] ?? null;
  const rest = verdict.notes.slice(1);

  return (
    <div
      className="dk-readline"
      id="dk-read"
      data-read={verdict.klass}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      <p className="dk-readstate">
        <b className="dk-readword">{verdict.word}.</b>{" "}
        {lead
          ? lead
          : note
            ? note.text
            : verdict.clean
              ? `Every project at this scope answered.${standingLine ? ` ${standingLine}` : ""}`
              : (standingLine ?? "")}
      </p>

      {rest.map((entry) => (
        <p className="dk-readnote" key={entry.id}>
          {entry.text}
        </p>
      ))}

      {/* When there IS news, the standing fact is subordinate to it and is set
          that way. It is still on the first screen, because it is still true. */}
      {!lead && note && standingLine ? (
        <p className="dk-readnote dk-readstanding">{standingLine}</p>
      ) : null}

      <p className="dk-meta dk-readmeta">
        <span className="dk-meta-part">{chrome.scope.label}</span>
        <span className="dk-meta-part">{chrome.asOf.line}</span>
        {verdict.notes.length > 0 || standing.length > 0 ? (
          <span className="dk-meta-part">
            <a href="#dk-limits">Every note on this read</a>
          </span>
        ) : null}
        {legendHref ? (
          <span className="dk-meta-part">
            <a href={legendHref}>How to read the line</a>
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * The local caveat. A section drawn from a read that did not finish says so on
 * itself, rather than relying on one page-level line the reader met a screen
 * ago. A short list and an empty list are not the same claim.
 */
export function SectionCaveat({ limited }: { limited: boolean }) {
  if (!limited) return null;
  return (
    <p className="dk-caveat">
      Some sources did not answer, so this list can be short. Short is not empty.
    </p>
  );
}

// ── The first screen ────────────────────────────────────────────────────────

/**
 * WHERE TO START, and the only control this direction ever draws as a control.
 *
 * Everything else here is a link in running text or a native disclosure, because
 * every other page in this direction is a read and a read has no primary action.
 * A first screen has exactly one, so it gets the one drawn affordance in the
 * whole system, and the singularity is the emphasis. There is nothing else on
 * the page competing with it.
 *
 * `line` is not repeated here. It is already the sentence in the readline above,
 * which is where a reader is standing when they arrive, and printing the same
 * fact twice in two registers is what the panel marked the quiet day down for.
 */
export function FirstRun({ view }: { view: FirstRunView }) {
  return (
    <section className="dk-first" id="dk-first" aria-labelledby="dk-first-heading">
      <h2 className="dk-h2" id="dk-first-heading" data-plain="true">
        {view.heading}
      </h2>
      <p className="dk-first-line">{view.nextLine}</p>
      <p className="dk-first-acts">
        {view.actions.map((action) => (
          <a className="dk-act" href={action.href} key={action.id}>
            {action.label}
          </a>
        ))}
      </p>
    </section>
  );
}

// ── The index in the margin ─────────────────────────────────────────────────

export type IndexItem = Readonly<{
  id: string;
  label: string;
  /**
   * Null where a section is not a count of anything, and null rather than zero
   * where a section renders for a reason other than its rows — a bare 0 beside
   * a heading in a contents column is the shape this programme spends its whole
   * effort refusing.
   */
  count: number | null;
  /** The ranked section. Exactly one per read, or none. */
  lead?: boolean;
}>;

/** Zero rows is not a count worth printing in a margin. */
export const indexCount = (rows: number): number | null => (rows > 0 ? rows : null);

/**
 * WHAT THE OTHER SIX HUNDRED PIXELS ARE FOR. LAB_BRIEF Amendment 1, answered.
 *
 * This direction's answer is that the full width is the DESK and the measure is
 * the SHEET lying on it, so the margin is a material rather than a leftover. The
 * left desk then carries the one thing that belongs beside a document and not
 * inside it: the read's own index, with a count against every section.
 *
 * It does three jobs that the page itself cannot do:
 *
 *   1. It states the shape of the read before the reader scrolls it. Today's cap
 *      of three stops being an arbitrary section limit and becomes a visible
 *      ranking — 3 against 2, 4 and 4 — because the counts sit in one column,
 *      one under the other, with the ranked section set a weight above the rest.
 *   2. It is the only navigation of the read that exists, so a founder can go
 *      straight to Moving well without passing the decisions again.
 *   3. It is absent when it would be furniture. A read with fewer than two
 *      sections renders no index at all, so the quiet day and the first screen
 *      keep their bare desk.
 *
 * It is a `nav` rather than an `aside` because it is navigation, and it carries
 * no heading, so the heading tree is identical at every viewport where the CSS
 * shows or hides it.
 */
export function ReadIndex({
  label,
  items,
}: {
  label: string;
  items: readonly IndexItem[];
}) {
  if (items.length < 2) return null;
  return (
    <nav className="dk-index" aria-label={label}>
      <p className="dk-key">In this read</p>
      <ul>
        {items.map((item) => (
          <li data-lead={item.lead ? "true" : undefined} key={item.id}>
            <a href={`#${item.id}`}>
              <span className="dk-index-label">{item.label}</span>
              {item.count === null ? null : (
                <span className="dk-index-count">
                  {item.count}
                  <span className="dk-sr">{item.count === 1 ? " item" : " items"}</span>
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Rows ────────────────────────────────────────────────────────────────────

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
 * A metadata field, and whether it is a late one.
 *
 * Lateness used to be set in the same ink as everything beside it, so an overdue
 * row and an on-time row read identically along the one line a reader actually
 * scans. It now takes the direction's single alarm ink and one weight step. The
 * words still say it, so the colour is a second channel rather than the only one.
 */
export type MetaPart = string | null | undefined | Readonly<{ text: string; late: true }>;

export function late(text: string | null): MetaPart {
  return text ? ({ text, late: true } as const) : null;
}

/**
 * The metadata line. Provenance, timing and state, side by side, separated by a
 * rule rather than by a punctuation glyph a screen reader would read aloud.
 *
 * It never drops a part at a narrow width. Content parity is D-HX08 and the
 * live product's own review row breaks it today. What it DOES do at a narrow
 * width is rank them: the first field keeps reading size and its own line, and
 * every field after it runs on one quieter line below. Nothing is judged away,
 * one field is judged first.
 */
export function Meta({ parts }: { parts: readonly MetaPart[] }) {
  const kept = parts.flatMap((part) =>
    !part
      ? []
      : typeof part === "string"
        ? [{ text: part, late: false }]
        : [{ text: part.text, late: true }],
  );
  if (kept.length === 0) return null;
  return (
    <p className="dk-meta">
      {kept.map((part, index) => (
        <span
          className="dk-meta-part"
          data-late={part.late ? "true" : undefined}
          key={`${index}-${part.text}`}
        >
          {part.text}
        </span>
      ))}
    </p>
  );
}

export function whenText(due: WhenLabel | null): string | null {
  if (!due) return null;
  return `${due.relative}, ${due.absolute}`;
}

/** The same field, marked late when the date has passed. */
export function whenPart(due: WhenLabel | null): MetaPart {
  const text = whenText(due);
  if (!text) return null;
  return due?.overdue ? late(text) : text;
}

/**
 * WHAT A ROW OFFERS, ON THE ROW, AT ARRIVAL.
 *
 * Round 2 deferred every disposition to a detail state, so the Inbox and My work
 * arrival screens carried ten titles and not one affordance, and four of the
 * sixteen journeys were unevidenced anywhere a director could see them. They are
 * on the row now.
 *
 * What has NOT changed is the refusal to draw a button that writes nothing. A
 * control that claims an outcome the source never confirmed is D-HX06, and the
 * lab has no source. So an action with a real href is a real link, and an action
 * without one is stated as an offer in words. An action that is closed to you
 * carries its reason on the same line rather than vanishing, because a control
 * that disappears tells the reader nothing about why.
 */
export function RowActions({
  actions,
  exclude,
}: {
  actions: readonly RowAction[];
  /** Ids already carried by the row's own title link. */
  exclude?: readonly string[];
}) {
  const shown = actions.filter((action) => !exclude?.includes(action.id));
  if (shown.length === 0) return null;
  return (
    <ul className="dk-rowacts">
      {shown.map((action) => (
        <li data-available={action.available ? "true" : "false"} key={action.id}>
          {action.available ? (
            action.href ? (
              <a href={action.href}>{action.label}</a>
            ) : (
              <b>{action.label}</b>
            )
          ) : (
            <>
              <b>{action.label}</b>
              {action.unavailableReason ? <span>{action.unavailableReason}</span> : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The same set, opened out, for a detail state where there is room to group them
 * and where the reader has asked for exactly this one thing.
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

/** Said once per mode that offers anything, rather than once per row. */
export const LAB_WRITES_NOTHING =
  "Every offer on a row is named, including the ones closed to you. The lab writes nothing, so nothing here is marked done until the source says it is.";

// ── The foot ────────────────────────────────────────────────────────────────

function Note({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <li>
      <span className="dk-key">{eyebrow}</span>
      <p>{text}</p>
    </li>
  );
}

/**
 * The foot: what this read could not see, then how to read the line, then the
 * way back.
 *
 * ROUND 3, and both changes are about a quiet day rather than about a busy one.
 *
 * The standing limits — kinds of work Home has no source for at all — are folded
 * now. They were 200px of printed explanation on every page, and they are true
 * every morning for every reader, so printing them in full is how a page starts
 * looking busy on the day it has nothing to say. They are one labelled click
 * away and the summary carries their count, so the shut state states the fact
 * rather than promising one.
 *
 * And the mark key is built from the marks THIS page drew, and only when it drew
 * at least three. A quiet day has no marked rows, so it carries no key at all.
 */
export function Foot({
  copy,
  disclosures,
  standing,
  extra,
  marks,
}: {
  copy: HomeCopy;
  disclosures: readonly Disclosure[];
  standing?: readonly Disclosure[];
  extra?: readonly (string | null)[];
  /** Every mark this page actually put on the spine. */
  marks?: ReadonlySet<MarkKind>;
}) {
  const live = disclosures.filter(isLive);
  const about = [
    ...disclosures.filter((note) => !isLive(note)).map((note) => note.text),
    ...(extra ?? []).filter((note): note is string => Boolean(note)),
  ];
  const standingNotes = standing ?? [];
  const anything = live.length + about.length + standingNotes.length > 0;
  const legend = legendEntries(marks ?? new Set<MarkKind>());

  return (
    <>
      {anything ? (
        <section className="dk-limits" id="dk-limits" aria-label="Notes on this read">
          {live.length > 0 ? (
            <>
              <h2 className="dk-h2" data-plain="true">
                What this read could not see
              </h2>
              <ul className="dk-notes">
                {live.map((note) => (
                  <Note key={note.id} eyebrow={noteWord(note, copy)} text={note.text} />
                ))}
              </ul>
            </>
          ) : null}

          {about.length > 0 ? (
            <>
              <h3 className="dk-h3">About this read</h3>
              <ul className="dk-notes">
                {about.map((text) => (
                  <li key={text}>
                    <p>{text}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {standingNotes.length > 0 ? (
            <details className="dk-fold dk-fold-standing">
              <summary>
                True of every read, not of today ({standingNotes.length})
              </summary>
              <div className="dk-fold-body">
                <p className="dk-said dk-said-quiet">
                  These are the kinds of work Home has no source for at all, so no page here
                  can count them.
                </p>
                <ul className="dk-notes">
                  {standingNotes.map((note) => (
                    <Note key={note.id} eyebrow={noteWord(note, copy)} text={note.text} />
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {/* A read with nothing at its foot has nothing to come back from, and a
          return link on a screen that never scrolled is the furniture this
          round exists to remove. */}
      {legend.length > 0 ? (
        <section className="dk-legend" id="dk-legend" aria-labelledby="dk-legend-heading">
          <h2 className="dk-h2" id="dk-legend-heading" data-plain="true">
            How to read the line
          </h2>
          <p className="dk-said">
            The line breaks where a source did not answer. Every mark on it repeats something
            the row beside it already says in words, so nothing here is carried by a shape.
            These are the marks on this page.
          </p>
          <ul className="dk-legend-list">
            {legend.map((entry) => (
              <li key={entry.mark}>
                <span className="dk-glyph" data-mark={entry.mark} aria-hidden="true" />
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {live.length > 0 || about.length > 0 || legend.length > 0 ? (
        <p className="dk-back-top">
          <a className="dk-more" href="#dk-read">
            Back to the top of this read
          </a>
        </p>
      ) : null}
    </>
  );
}

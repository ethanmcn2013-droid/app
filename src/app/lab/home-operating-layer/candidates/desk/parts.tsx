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
 * That is the spine's own grammar turned on its side: a line that breaks where
 * the read broke. It carries no tint, no box and no container, it differs before
 * a word is read, and the three states are still three different silhouettes in
 * greyscale, in forced colours and with every colour removed.
 */

import type { ReactNode } from "react";
import type {
  Disclosure,
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
 * not. The legend at the foot is therefore a reference, never a dependency, and
 * it now says so in its own first line.
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

/** A project that did not resolve breaks the line, whatever else is true. */
export function markForProvenance(provenance: Provenance, fallback: MarkKind): MarkKind {
  return provenance.projectName === null ? "broken" : fallback;
}

// ── The read state, classified ──────────────────────────────────────────────

/**
 * THREE CLASSES, AND WHY THE SHELL'S OWN `state` IS NOT ENOUGH.
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
 */
export type ReadClass = "complete" | "partial" | "refused";

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
}) {
  const standingLine =
    standing.length === 0
      ? null
      : standing.length === 1
        ? "One kind of work has no source connected."
        : `${standing.length} kinds of work have no source connected.`;

  const lead = verdict.notes[0] ?? null;
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
          ? lead.text
          : verdict.clean
            ? `Every project at this scope answered.${standingLine ? ` ${standingLine}` : ""}`
            : (standingLine ?? "")}
      </p>

      {rest.map((note) => (
        <p className="dk-readnote" key={note.id}>
          {note.text}
        </p>
      ))}

      {/* When there IS news, the standing fact is subordinate to it and is set
          that way. It is still on the first screen, because it is still true. */}
      {lead && standingLine ? (
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
 * The foot: every note in full, then how to read the line, then the way back.
 *
 * Two changes from round 1, both of them things the pixels showed rather than
 * things a review caught. The notes section no longer renders when there are no
 * notes, because a heading with nothing under it is worse than no heading. And
 * the mark legend is no longer folded inside a `<details>` — it printed as a
 * bare heading over empty space on every capture, which is the one thing a
 * direction that encodes row state in shapes cannot afford.
 */
export function Foot({
  copy,
  disclosures,
  standing,
  extra,
}: {
  copy: HomeCopy;
  disclosures: readonly Disclosure[];
  standing?: readonly Disclosure[];
  extra?: readonly (string | null)[];
}) {
  const live = disclosures.filter(isLive);
  const about = [
    ...disclosures.filter((note) => !isLive(note)).map((note) => note.text),
    ...(extra ?? []).filter((note): note is string => Boolean(note)),
  ];
  const standingNotes = standing ?? [];
  const anything = live.length + about.length + standingNotes.length > 0;

  return (
    <>
      {anything ? (
        <section className="dk-limits" id="dk-limits" aria-labelledby="dk-limits-heading">
          <h2 className="dk-h2" id="dk-limits-heading" data-plain="true">
            What this read could not see
          </h2>

          {live.length > 0 ? (
            <ul className="dk-notes">
              {live.map((note) => (
                <Note key={note.id} eyebrow={noteWord(note, copy)} text={note.text} />
              ))}
            </ul>
          ) : null}

          {standingNotes.length > 0 ? (
            <>
              <h3 className="dk-h3">True of every read</h3>
              <p className="dk-said dk-said-quiet">
                These are not about today. They are the kinds of work Home has no source for
                at all, so no page here can count them.
              </p>
              <ul className="dk-notes">
                {standingNotes.map((note) => (
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
        </section>
      ) : null}

      <section className="dk-legend" aria-labelledby="dk-legend-heading">
        <h2 className="dk-h2" id="dk-legend-heading" data-plain="true">
          How to read the line
        </h2>
        <p className="dk-said">
          The line breaks where a source did not answer. Every mark on it repeats something
          the row beside it already says in words, so nothing here is carried by a shape.
        </p>
        <ul className="dk-legend-list">
          {MARK_LEGEND.map((entry) => (
            <li key={entry.mark}>
              <span className="dk-glyph" data-mark={entry.mark} aria-hidden="true" />
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
        <p className="dk-back-top">
          <a className="dk-more" href="#dk-read">
            Back to the top of this read
          </a>
        </p>
      </section>
    </>
  );
}

/**
 * Reading Index · the small pure decisions, kept out of the markup.
 *
 * Nothing here composes a sentence the shell already publishes. It builds
 * ordinals, anchor ids, the seven marginal-note labels, and the condition each
 * mode's read is actually in. Pure, so it is readable on its own and cannot
 * drift from the components that use it.
 */

import type {
  Disclosure,
  HomeCandidateProps,
  HomeStateName,
  TodaySection,
} from "@/lib/home-layer/lab-shell";

/**
 * `01`, `02`, `17`. Two digits below a hundred, natural width above it, so a
 * ledger of eighteen projects and a ledger of a hundred and four both stay in
 * one tabular column.
 */
export function ordinal(position: number): string {
  return String(position).padStart(2, "0");
}

/**
 * A fragment-safe id. Row keys carry colons (`Tasks:task:abc`) and Project
 * ids carry whatever the fixture gave them, so both are folded to one
 * grammar rather than trusted.
 */
export function anchorId(prefix: string, key: string): string {
  const safe = key.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `ri-${prefix}-${safe.length > 0 ? safe : "x"}`;
}

/**
 * The marginal label a note is filed under.
 *
 * The tones are the shell's vocabulary; these are the words a reader sees
 * beside them. Plain English, and each one names a fact about the read rather
 * than a judgement about it. `failure` is "Not answering" and not "Error",
 * because the reader's question is what the surface could not see.
 */
const TONE_LABELS: Readonly<Record<Disclosure["tone"], string>> = Object.freeze({
  coverage: "Coverage",
  permission: "Access",
  freshness: "Last read",
  scope: "Scope",
  failure: "Not answering",
  setup: "Not connected",
  scale: "Size",
});

export function toneLabel(tone: Disclosure["tone"]): string {
  return TONE_LABELS[tone];
}

/**
 * A Today or briefing section renders when it has rows, or when it has
 * something to say about rows it is not showing. An empty section with
 * nothing held back is furniture, and HOME_EXPERIENCE §3.1 rule 7 already
 * settled that it does not render.
 */
export function sectionSpeaks(section: TodaySection): boolean {
  return section.rows.length > 0 || section.suppressedLine !== null;
}

/**
 * Worst-first, so a note that says the read failed cannot be overtaken by a
 * note that says it succeeded. The two states that mean "the read completed"
 * sit at the bottom: `ready` because everything answered, `empty` because
 * everything answered and there was nothing in it. Every other state is a
 * hole of some size.
 */
const RANK: Readonly<Record<HomeStateName, number>> = Object.freeze({
  ready: 0,
  "all-clear": 0,
  updated: 0,
  loading: 0,
  refreshing: 0,
  archived: 0,
  empty: 1,
  // Nothing was attempted, so nothing failed. It ranks beside `empty` because
  // both are reads that came back without a hole in them, and it never
  // reaches this table anyway: `modeCondition` answers a first run before it
  // weighs anything.
  "first-run": 1,
  "insufficient-history": 2,
  stale: 3,
  partial: 4,
  "permission-limited": 5,
  offline: 6,
  failed: 6,
  unavailable: 7,
});

/** When two notes land on the same rank, the more consequential cause wins. */
const TONE_RANK: Readonly<Record<Disclosure["tone"], number>> = Object.freeze({
  failure: 6,
  permission: 5,
  freshness: 4,
  coverage: 3,
  scope: 2,
  setup: 1,
  scale: 0,
});

/**
 * The cause is only spelled out where the state word does not already carry
 * it. "Limited by your access" says access; "Partly read" does not say whether
 * a source refused to answer or was never connected, and those are the two the
 * reader most needs told apart.
 */
const SPELLED_CAUSES: ReadonlySet<Disclosure["tone"]> = new Set<Disclosure["tone"]>([
  "failure",
  "setup",
]);

type Signal = Readonly<{ state: HomeStateName; tone: Disclosure["tone"] | null }>;

export type ReadCondition = Readonly<{
  /** The shell's own word for the condition. Never a word this file invents. */
  word: string;
  /** What limited it, in the shell's tone vocabulary. Null when nothing did. */
  cause: string | null;
  /**
   * How the condition is marked beside the word. `none` is a read that
   * finished; `open` is a read with a known hole in it; `solid` is a read that
   * could not be made, or part of one that never answered. So a quiet day and
   * a broken provider are two different pictures before a word is read.
   */
  mark: "none" | "open" | "solid";
}>;

/**
 * A note about a source that was never connected is a limit on the read, not a
 * failure of it: Home read everything there was to read and a whole kind of
 * work has no producer. The shell states those with `state: "unavailable"`
 * because the kind is unavailable, so they are capped here at `partial` rather
 * than allowed to report the whole mode unreadable.
 */
function signalOf(note: Disclosure): Signal {
  const capped =
    note.tone === "setup" && RANK[note.state] > RANK.partial ? "partial" : note.state;
  return { state: capped, tone: note.tone };
}

function worst(signals: readonly Signal[]): Signal {
  let out: Signal = { state: "ready", tone: null };
  for (const signal of signals) {
    if (RANK[signal.state] > RANK[out.state]) {
      out = signal;
      continue;
    }
    if (RANK[signal.state] === RANK[out.state] && signal.tone !== null) {
      const held = out.tone === null ? -1 : TONE_RANK[out.tone];
      if (TONE_RANK[signal.tone] > held) out = signal;
    }
  }
  return out;
}

function conditionOf(
  copy: HomeCandidateProps["copy"],
  base: HomeStateName,
  extras: readonly Signal[],
  notes: readonly Disclosure[],
  /**
   * STANDING LIMITS, WHICH QUALIFY A READ WITHOUT DOWNGRADING IT.
   *
   * Round 2 fed these through `notes`, so a kind of work with no producer at
   * all — permanent in v1, identical in every world — pushed Today to "Partly
   * read" on a day where every source answered. A director scored that at 8.2
   * and named the cost exactly: when "Partly read" is the resting state, its
   * appearance on a real partial read carries no information.
   *
   * So a standing limit no longer moves the word. It spends the mark and the
   * cause instead: a complete read with a permanent hole beside it reads
   * "Read · Not connected" with an outlined mark, and "Partly read" is kept
   * for reads that were actually partial.
   */
  limits: readonly Disclosure[] = [],
): ReadCondition {
  const winner = worst([{ state: base, tone: null }, ...extras, ...notes.map(signalOf)]);
  const rank = RANK[winner.state];
  const complete = rank <= RANK.empty;
  const standing = limits.length > 0;
  const spelled =
    winner.tone !== null && SPELLED_CAUSES.has(winner.tone) && !complete
      ? toneLabel(winner.tone)
      : null;
  return {
    word: copy.states[winner.state],
    cause: spelled ?? (complete && standing ? toneLabel("setup") : null),
    mark: complete
      ? standing
        ? "open"
        : "none"
      : rank >= RANK["permission-limited"] || winner.tone === "failure"
        ? "solid"
        : "open",
  };
}

/**
 * THE CONDITION EACH MODE'S READ IS IN, DERIVED FROM THAT MODE'S OWN READ.
 *
 * This is the whole reason the index earns its height, and it is the one place
 * this direction can most easily tell the lie the charter exists to prevent.
 * The rule is absolute: a mode may not be reported as read, or as empty, on
 * evidence that does not support it.
 *
 * So the mode's own state is a floor and never a verdict. Every note the shell
 * hands that mode is weighed against it, and two emptiness claims are checked
 * against the shell's own test for a genuine zero rather than trusted:
 * `emptyLine` is populated only when the queue or the ledger was actually read
 * and actually held nothing. A brand-new reader whose scope resolved to no
 * project has an unread Inbox, not an empty one, and says so.
 */
export function modeCondition(
  props: HomeCandidateProps,
  mode: HomeCandidateProps["chrome"]["modes"][number]["mode"],
): ReadCondition {
  const { copy, today, inbox, myWork, analytics } = props;

  /**
   * A FIRST RUN IS ANSWERED BEFORE ANYTHING IS WEIGHED.
   *
   * Every mode is in `first-run` in that world, and weighing the modes
   * separately let Analytics report "Not enough history" to somebody who has
   * no project to have a history of. One reader-level fact, four identical
   * rows, and not one of them says a read failed.
   */
  if (props.firstRun !== null) {
    return { word: copy.states["first-run"], cause: null, mark: "none" };
  }

  if (mode === "inbox") {
    const genuinelyEmpty = inbox.state === "empty" && inbox.emptyLine !== null;
    const base: HomeStateName =
      inbox.state === "empty" && !genuinelyEmpty ? "unavailable" : inbox.state;
    const extras: Signal[] = [];
    if (inbox.badge.coverage === "partial")
      extras.push({ state: "partial", tone: "coverage" });
    if (inbox.badge.coverage === "unavailable")
      extras.push({ state: "unavailable", tone: "coverage" });
    return conditionOf(copy, base, extras, inbox.disclosures);
  }

  if (mode === "my-work") {
    const genuinelyEmpty =
      myWork.state === "empty" && myWork.kind === "ready" && myWork.emptyLine !== null;
    const base: HomeStateName =
      myWork.state === "empty" && !genuinelyEmpty ? "unavailable" : myWork.state;
    const extras: Signal[] = [];
    if (myWork.kind === "identity-unresolved")
      extras.push({ state: "unavailable", tone: "permission" });
    if (myWork.coverageLine !== null) extras.push({ state: "partial", tone: "coverage" });
    return conditionOf(copy, base, extras, myWork.disclosures);
  }

  if (mode === "analytics") {
    const extras: Signal[] = [];
    for (const claim of analytics.claims) {
      if (claim.status === "partial") extras.push({ state: "partial", tone: "coverage" });
      if (claim.status === "unsupported") extras.push({ state: "partial", tone: "setup" });
      if (claim.status === "insufficient_history")
        extras.push({ state: "insufficient-history", tone: null });
    }
    if (analytics.windowMismatchLine !== null)
      extras.push({ state: "partial", tone: "scope" });
    if (!analytics.trend.renderChart)
      extras.push({ state: "insufficient-history", tone: null });
    return conditionOf(copy, analytics.state, extras, analytics.disclosures);
  }

  /**
   * Today counts the kinds of work that have no producer at all. In v1 that is
   * always at least one, so Today never reports an unqualified complete read.
   * What changed after round 2 is which field carries it: the standing limit
   * is the cause and the mark, never the word, so "Partly read" still means
   * that this read came back with a hole in it.
   */
  return conditionOf(copy, today.state, [], today.disclosures, today.unsupported);
}

/**
 * WHAT THE RECORD COLUMN SAYS ABOUT THIS MODE'S READ.
 *
 * One list per mode, composed from sentences the shell already published, so
 * the standing column is the same block in all five modes and no mode has to
 * remember to fill it. Nothing here writes a sentence.
 */
export function recordLines(props: HomeCandidateProps): readonly string[] {
  const { state, today, inbox, myWork, analytics, briefing } = props;
  const lines: (string | null)[] = [];
  switch (state.mode) {
    case "inbox":
      /**
       * The badge's accessible name is a whole sentence — "Inbox. 42 open. 1
       * could not be verified. 0 projects could not be read." — and round 2
       * only ever announced it. Announcing a count's caveats to one reader and
       * withholding them from another is the same asymmetry this programme
       * exists to remove, so it is written down where every reader can see it.
       */
      lines.push(inbox.badge.accessibleName);
      break;
    case "my-work":
      lines.push(myWork.coverageLine, myWork.doneExcludedLine, myWork.timeZoneLine);
      break;
    case "analytics":
      lines.push(analytics.windowLine);
      break;
    case "briefing":
      lines.push(briefing.accountingLine ?? briefing.accountingWithheldLine);
      break;
    default:
      lines.push(today.accountingLine ?? today.accountingWithheldLine);
      break;
  }
  /**
   * WHAT HOME CANNOT SEE AT ALL IS TRUE IN EVERY MODE.
   *
   * A kind of work with no producer is a fact about the platform, not about
   * Today, and round 2 printed it only on Today — which left the standing
   * column on Inbox holding a single line, and a director counted it. It is
   * the same sentence in the same place on all five modes now, which is both
   * more honest and what makes the column one block rather than five.
   */
  for (const note of today.unsupported) lines.push(note.text);
  return Object.freeze(
    lines.filter((line): line is string => typeof line === "string" && line.length > 0),
  );
}

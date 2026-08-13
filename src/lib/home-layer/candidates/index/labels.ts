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
): ReadCondition {
  const winner = worst([{ state: base, tone: null }, ...extras, ...notes.map(signalOf)]);
  const rank = RANK[winner.state];
  const cause =
    winner.tone !== null && SPELLED_CAUSES.has(winner.tone) && rank > RANK.empty
      ? toneLabel(winner.tone)
      : null;
  return {
    word: copy.states[winner.state],
    cause,
    mark:
      rank <= RANK.empty
        ? "none"
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
   * always at least one, so Today never reports a complete read, and that is
   * the honest answer rather than a defect: a surface that cannot see a whole
   * kind of work has not seen the day.
   */
  return conditionOf(copy, today.state, [], [
    ...today.disclosures,
    ...today.unsupported,
  ]);
}

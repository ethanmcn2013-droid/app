/**
 * Meridian · how a read is graded, and how a mode reports itself.
 *
 * This is the one piece of the previous occupant of this folder that survived
 * the rewrite, because it is arithmetic rather than art: an ordinal ladder over
 * `HomeStateName`, and a rule for resolving the two facts the shell hands over
 * that can disagree with each other.
 *
 * THE DISAGREEMENT. A mode carries a declared `state`, and it separately
 * carries `disclosures`, each of which carries its own state. In the signature
 * world Inbox declares `ready` while publishing a disclosure whose state is
 * `partial` ("1 item could not be checked against the source"). Printing the
 * declared word there would set "Read" one column away from a sentence saying
 * the read was incomplete. So a mode reports the WORST state it can be shown to
 * be in: its own, or the worst of the disclosures it published. The words are
 * the shell's, unchanged; only the choice of which word applies is ours, and it
 * always resolves towards the less confident one.
 *
 * THE PROMOTION RULE. `empty` is a claim, not an absence: "Nothing in it"
 * asserts that something was read and found to hold nothing. When any mode
 * could not be read at all, no mode is entitled to that claim, so `empty` is
 * promoted. `first-run` is exempt from every promotion, because a reader with
 * no Project has not had a read go wrong; they have not had a read.
 *
 * SEVERITY IS TAKEN FROM `state`, NEVER FROM `tone`. Tone is a subject, not a
 * severity. Two disclosures in the shell share `tone: "scope"`: one says Home
 * could not read any project at all, the other says the scope was changed.
 * Grading by tone makes total failure the calmest thing on the page.
 *
 * THE ONE THING TONE DOES DECIDE. `tone: "failure"` means a source was asked
 * and did not answer. That is the fact this direction changes the page's
 * material for, and `refused()` is the only reader of it.
 */

import type {
  Disclosure,
  HomeCandidateProps,
  HomeMode,
  HomeStateName,
} from "@/lib/home-layer/lab-shell";

/** Higher is worse, and worse always wins. Ordinal only; nothing renders it. */
const RANK: Readonly<Record<HomeStateName, number>> = Object.freeze({
  ready: 0,
  "all-clear": 0,
  updated: 0,
  loading: 0,
  refreshing: 0,
  "first-run": 1,
  archived: 2,
  empty: 2,
  stale: 3,
  "insufficient-history": 3,
  partial: 4,
  "permission-limited": 5,
  offline: 6,
  failed: 6,
  unavailable: 6,
});

/**
 * Four silhouettes. Weight and material carry them; the state's own word is
 * printed beside every one of them in every world, so nothing here is state
 * carried by colour alone.
 *
 *   `read`     the read finished
 *   `waiting`  there is nothing to read yet, or nothing came back in it
 *   `partial`  part of what was asked for came back
 *   `broken`   something was asked and did not answer
 *
 * `permission-limited` is graded `partial`, on purpose and at a cost that was
 * measured: it ranks 5 so it outranks every coverage shortfall, but a limited
 * seat is a standing fact about the reader, not a read that broke. Grading it
 * `broken` put the direction's loudest device, the reversed slab, on every
 * mode of a guest's ordinary morning, and a slab a guest sees every day is a
 * slab nobody reads on the day a source actually refuses. Broken is reserved
 * for reads that were attempted and did not come back.
 */
export type Band = "read" | "waiting" | "partial" | "broken";

export function bandOf(state: HomeStateName): Band {
  const rank = RANK[state];
  if (rank >= 6) return "broken";
  if (rank >= 3) return "partial";
  if (rank >= 1) return "waiting";
  return "read";
}

/**
 * How loud one disclosure is allowed to be.
 *
 * "1 project did not answer at all" arrives as `tone: "failure"` with
 * `state: "partial"`, because at mode level the read genuinely was partial and
 * it would be wrong to label the whole mode unreadable. The mark in front of
 * that sentence is not describing the mode though, it is describing a source
 * that answered nothing, and that is the loudest thing on the page.
 */
export function bandOfDisclosure(item: Disclosure): Band {
  return item.tone === "failure" ? "broken" : bandOf(item.state);
}

/** True when a source was asked and did not answer. Changes the page. */
export function refused(items: readonly Disclosure[]): boolean {
  return items.some((item) => item.tone === "failure");
}

/** Worst first, stable within a rank so the order never depends on the sort. */
export function bySeverity(items: readonly Disclosure[]): readonly Disclosure[] {
  return [...items].sort((left, right) => {
    const delta = RANK[right.state] - RANK[left.state];
    if (delta !== 0) return delta;
    if (left.tone === "failure" && right.tone !== "failure") return -1;
    if (right.tone === "failure" && left.tone !== "failure") return 1;
    return 0;
  });
}

export type Reading = Readonly<{
  state: HomeStateName;
  /**
   * The words printed under the mode name.
   *
   * Round 4 found the previous rule over-claiming: a mode that refused ONE
   * source said "Did not answer" while rendering three ranked decisions
   * underneath, and four directors marked it down for it. Over-reporting an
   * outage is not the safe direction of error. A label a reader repeatedly
   * sees on a mode that visibly answered is a label they stop reading, and
   * that is how the next real outage gets ignored.
   *
   * So a refusal is now graded by whether the mode still produced anything:
   *
   *   produced something  "Partly read · not answering"
   *   produced nothing    "Did not answer"
   *
   * The first half is the shell's own word for the resolved state. The second
   * half is the only clause this direction writes, and it exists because
   * "Partly read" alone cannot tell a source that answered incompletely apart
   * from a source that refused, which is the most consequential state change
   * in the product.
   */
  label: string;
  band: Band;
  /**
   * What the page is made of. The band grades how much came back; the material
   * grades whether anything refused, and a refusal always wins, because the
   * reader needs the page itself to look different.
   */
  material: Band;
  refused: boolean;
  /**
   * True when the mode rendered something a reader can act on. It is the fact
   * that decides between the two refusal labels, and it is also what lets a
   * count beside a refused mode be qualified rather than deleted.
   */
  produced: boolean;
  disclosures: readonly Disclosure[];
}>;

/** The clause this direction writes, and the only one. See `Reading.label`. */
export const DID_NOT_ANSWER = "Did not answer";
export const REFUSED_CLAUSE = "one source did not answer";

function worst(state: HomeStateName, items: readonly Disclosure[]): HomeStateName {
  // A reader with no Project is not a read that went wrong. Every mode in that
  // world publishes a setup disclosure, and promoting off it would turn a first
  // morning into a failure, which is the defect this programme just fixed.
  if (state === "first-run") return state;
  // Annotated, not inferred: the guard above narrows `state`, and an inferred
  // `held` would then refuse the very states this loop exists to promote to.
  let held: HomeStateName = state;
  for (const item of items) {
    if (RANK[item.state] > RANK[held]) held = item.state;
  }
  return held;
}

function viewOf(props: HomeCandidateProps, mode: HomeMode) {
  if (mode === "inbox") return props.inbox;
  if (mode === "my-work") return props.myWork;
  if (mode === "analytics") return props.analytics;
  if (mode === "briefing") return props.briefing;
  return props.today;
}

/**
 * Did this mode render anything a reader can act on?
 *
 * Counted from what is actually on the page rather than from a state name, so
 * the label can never contradict the rows beneath it. That contradiction is
 * the exact defect this function was added to close.
 */
function producedOf(props: HomeCandidateProps, mode: HomeMode): boolean {
  if (mode === "inbox") {
    return props.inbox.groups.some((group) => group.rows.length > 0);
  }
  if (mode === "my-work") {
    return props.myWork.groups.some((group) => group.rows.length > 0);
  }
  if (mode === "analytics") {
    return props.analytics.claims.length > 0 || props.analytics.ledger.length > 0;
  }
  const view = mode === "briefing" ? props.briefing : props.today;
  return view.sections.some((section) => section.rows.length > 0);
}

/**
 * One mode's read, resolved once.
 *
 * Analytics carries a fifth possibility the other modes do not: every claim
 * can be computable and the mode still be unable to say anything about change,
 * because there is no history behind it. `insufficient-history` is a real state
 * name in the contract and the mode's declared state never carries it, so it is
 * read off the trend and folded in here. Without that, Analytics reports "Read"
 * on a page whose only trend says it cannot be drawn yet.
 */
export function readingFor(props: HomeCandidateProps, mode: HomeMode): Reading {
  const view = viewOf(props, mode);
  const declared =
    mode === "analytics" && !props.analytics.trend.renderChart && view.state === "ready"
      ? ("insufficient-history" as HomeStateName)
      : view.state;
  const state = worst(declared, view.disclosures);
  const refusedHere = refused(view.disclosures);
  const produced = producedOf(props, mode);
  return Object.freeze({
    state,
    label: refusedHere
      ? produced
        ? `${props.copy.states[state]} · ${REFUSED_CLAUSE}`
        : DID_NOT_ANSWER
      : props.copy.states[state],
    band: bandOf(state),
    material: refusedHere ? "broken" : bandOf(state),
    refused: refusedHere,
    produced,
    disclosures: view.disclosures,
  });
}

/**
 * The account, minus the one sentence already printed as the page's headline.
 *
 * Every disclosure still reaches the reader; none of them reaches twice on one
 * screen, which is what a director reads as an unedited page rather than as
 * thoroughness.
 */
export function accountOf(
  items: readonly Disclosure[],
  headline: Disclosure | null,
): readonly Disclosure[] {
  return headline === null ? items : items.filter((item) => item.id !== headline.id);
}

export const HOME_MODE_ORDER: readonly HomeMode[] = Object.freeze([
  "today",
  "inbox",
  "my-work",
  "analytics",
]);

/** Every mode's read, so any mode can print where the other three stood. */
export function readingsFor(
  props: HomeCandidateProps,
): Readonly<Record<HomeMode, Reading>> {
  return Object.freeze({
    today: readingFor(props, "today"),
    inbox: readingFor(props, "inbox"),
    "my-work": readingFor(props, "my-work"),
    analytics: readingFor(props, "analytics"),
    briefing: readingFor(props, "briefing"),
  });
}

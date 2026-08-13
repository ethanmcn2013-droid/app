/**
 * Context Rail · the coverage instrument.
 *
 * WHY THIS FILE EXISTS. The direction's whole claim is that a persistent rail
 * can report the health of all four modes at once. That claim is only worth
 * anything if the report is honest, and the shell hands over two facts that
 * disagree: a mode carries a declared `state`, and it separately carries
 * `disclosures`, each of which carries its OWN state. In the signature world
 * Inbox declares `ready` while publishing a disclosure whose state is
 * `partial` ("1 item could not be checked against the source"). Printing the
 * declared state there would put the word "Read" one column away from a
 * sentence saying the read was incomplete.
 *
 * So the rail reports the WORST state a mode can be shown to be in: its own,
 * or the worst of the disclosures it published. The words are the shell's,
 * unchanged. Only the choice of which word applies is the direction's, and it
 * always resolves towards the less confident one.
 *
 * THE PROMOTION RULE. `empty` is a claim, not an absence: saying "Nothing in
 * it" asserts that something was read and found to hold nothing. When any mode
 * could not be read at all, no mode is entitled to that claim, so `empty` is
 * promoted to `unavailable`. That is the new-reader world, where Inbox and My
 * work previously read "Nothing in it" beside a page saying Home could not read
 * any project.
 *
 * WHY SEVERITY IS TAKEN FROM `state` AND NEVER FROM `tone`. `tone` is a
 * subject, not a severity. Two disclosures in the shell carry `tone: "scope"`:
 * one has `state: "unavailable"` ("Home could not read any project at this
 * scope") and one has `state: "ready"` ("Read Scope was changed"). Colouring by
 * tone is what made the total failure the calmest band on the page.
 */

import type {
  Disclosure,
  HomeCandidateProps,
  HomeMode,
  HomeStateName,
} from "@/lib/home-layer/lab-shell";

/**
 * The severity ladder. Higher is worse, and worse always wins. The numbers are
 * ordinal only: nothing renders them, and no arithmetic is done on them.
 */
const RANK: Readonly<Record<HomeStateName, number>> = Object.freeze({
  ready: 0,
  "all-clear": 0,
  updated: 0,
  loading: 0,
  refreshing: 0,
  archived: 1,
  empty: 1,
  stale: 2,
  "insufficient-history": 2,
  partial: 3,
  "permission-limited": 4,
  offline: 5,
  failed: 5,
  unavailable: 5,
});

export function rankOf(state: HomeStateName): number {
  return RANK[state];
}

/**
 * How the spine draws a state.
 *
 * `read`    one continuous hairline
 * `empty`   a hairline, dashed: looked at, and holding nothing
 * `limited` a heavier dashed rule: read in part
 * `broken`  a heavy rule with a gap above and below, so the spine is visibly
 *           severed at the mode that could not be read
 *
 * Weight and pattern carry the meaning on their own. Colour is a third,
 * redundant carrier, and the state's word is printed under every mode in every
 * world, so nothing here is state carried by colour alone.
 */
export type CoverageBand = "read" | "empty" | "limited" | "broken";

export function bandOf(state: HomeStateName): CoverageBand {
  const rank = RANK[state];
  if (rank >= 5) return "broken";
  if (rank >= 2) return "limited";
  if (rank >= 1) return "empty";
  return "read";
}

/**
 * How loud a single disclosure is allowed to be.
 *
 * TWO QUESTIONS, TWO GRADES, and they are not the same question. The spine
 * grades a MODE by how much of it was read, which is `state`. A notice grades
 * an EVENT by how bad it is, and the shell has one tone that is categorically
 * bad: `failure`. "1 project did not answer at all" arrives as
 * `tone: "failure"` with `state: "partial"`, because at mode level the read
 * genuinely was partial, and it would be wrong to print "Could not be read"
 * under a mode that returned most of its work. But the band in front of that
 * sentence is not describing the mode, it is describing a source that answered
 * nothing, and that is the loudest thing on the page.
 *
 * So a mode says "Partly read" beside an amber spine while its notice carries
 * a red rule, and both are true.
 */
export function bandOfDisclosure(item: Disclosure): CoverageBand {
  return item.tone === "failure" ? "broken" : bandOf(item.state);
}

/** The worst state a set of disclosures admits to. */
export function worstDisclosure(
  items: readonly Disclosure[],
  floor: HomeStateName,
): HomeStateName {
  let worst = floor;
  for (const item of items) {
    if (RANK[item.state] > RANK[worst]) worst = item.state;
  }
  return worst;
}

const BAND_ORDER: Readonly<Record<CoverageBand, number>> = Object.freeze({
  read: 0,
  empty: 1,
  limited: 2,
  broken: 3,
});

/** Worst first, so the loudest limit on a page is the first one read. */
export function bySeverity(items: readonly Disclosure[]): readonly Disclosure[] {
  return [...items].sort(
    (a, b) => BAND_ORDER[bandOfDisclosure(b)] - BAND_ORDER[bandOfDisclosure(a)],
  );
}

function declaredOf(props: HomeCandidateProps, mode: HomeMode): {
  state: HomeStateName;
  disclosures: readonly Disclosure[];
} {
  switch (mode) {
    case "today":
      return { state: props.today.state, disclosures: props.today.disclosures };
    case "inbox":
      return { state: props.inbox.state, disclosures: props.inbox.disclosures };
    case "my-work":
      return { state: props.myWork.state, disclosures: props.myWork.disclosures };
    case "analytics":
      return { state: props.analytics.state, disclosures: props.analytics.disclosures };
    default:
      return { state: props.briefing.state, disclosures: props.briefing.disclosures };
  }
}

const RAIL_MODES: readonly HomeMode[] = ["today", "inbox", "my-work", "analytics"];

/**
 * The state the rail prints under every mode, in every world, always. Silence
 * used to stand for "read", and a reader could not tell a mode that was read
 * from a mode that was never evaluated. A printed token can be checked; an
 * absent one has to be guessed at.
 */
export function coverageByMode(
  props: HomeCandidateProps,
): Readonly<Record<HomeMode, HomeStateName>> {
  const first: Partial<Record<HomeMode, HomeStateName>> = {};
  for (const mode of [...RAIL_MODES, "briefing" as HomeMode]) {
    const { state, disclosures } = declaredOf(props, mode);
    first[mode] = worstDisclosure(disclosures, state);
  }

  const anyBroken = RAIL_MODES.some((mode) => RANK[first[mode] as HomeStateName] >= 5);

  const out: Partial<Record<HomeMode, HomeStateName>> = {};
  for (const [mode, state] of Object.entries(first) as [HomeMode, HomeStateName][]) {
    out[mode] = anyBroken && RANK[state] === 1 ? "unavailable" : state;
  }
  return out as Record<HomeMode, HomeStateName>;
}

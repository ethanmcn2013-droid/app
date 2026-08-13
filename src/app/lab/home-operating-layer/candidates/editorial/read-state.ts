/**
 * THE READ LADDER — four registers, and what may wear red.
 *
 * Round 1 found the direction's worst defect here: the ladder was carried by
 * colouring an 11px letterspaced label with a status token, which put the
 * governing rule's own indicator at 2.15:1 on white. It also had only two
 * rungs, so a source that failed and a source that answered in part looked
 * identical, and a person's first ever screen wore the alarm colour reserved
 * for real breakage.
 *
 * So the ladder is rebuilt as data rather than as a colour:
 *
 *   read     the read is complete. Nothing is drawn.
 *   setup    there is nothing connected to read yet. Nothing is broken and
 *            nothing is red. An open mark in ink.
 *   limited  something answered in part, went stale, or was held back by
 *            access. A filled amber mark inside an ink rule.
 *   failed   a source did not answer at all, or the read itself failed. A
 *            filled red mark inside a doubled ink rule.
 *
 * Every register is said in words at full ink, drawn with a mark that differs
 * in SHAPE as well as colour, and counted in ink strokes. No word anywhere in
 * this direction is set in a status colour. Red now means one thing only: a
 * source that failed.
 */

import type {
  AnalyticsView,
  Disclosure,
  HomeCandidateProps,
  HomeChrome,
  HomeMode,
  HomeStateName,
} from "@/lib/home-layer/lab-shell";

export type Register = "read" | "setup" | "limited" | "failed";

/** Worst first. Used to pick the one register a whole mode is flagged with. */
const SEVERITY: Readonly<Record<Register, number>> = {
  read: 0,
  setup: 1,
  limited: 2,
  failed: 3,
};

/** The kind of limit, in one word. The reader is told what sort it is. */
export const TONE_WORDS: Readonly<Record<Disclosure["tone"], string>> = {
  coverage: "Coverage",
  permission: "Access",
  freshness: "Freshness",
  scope: "Scope",
  failure: "Failure",
  setup: "Not connected",
  scale: "Size",
};

/**
 * True when this reader has no Project at all, which is the difference between
 * "nothing is set up yet" and "the read broke". The scope control lists every
 * Project the reader can see, so an empty list is the fact itself rather than
 * an inference.
 */
export function nothingConnectedYet(chrome: HomeChrome): boolean {
  return chrome.scope.options.every((option) => option.group !== "project");
}

/** Which register a single disclosure belongs in. */
export function registerOfDisclosure(entry: Disclosure, noProjects: boolean): Register {
  // ROUND 3. The shell now publishes `first-run` as a state of its own, so the
  // reader who has not started is named by the shell rather than inferred here.
  // Both tests stay: the shell's word is authoritative, and the old inference
  // remains as the fallback for a world that reaches this by another route.
  if (entry.state === "first-run") return "setup";
  if (entry.tone === "setup") return "setup";
  if (entry.tone === "scope") {
    if (entry.state === "ready") return "read";
    return noProjects ? "setup" : "failed";
  }
  if (entry.tone === "failure") return "failed";
  if (entry.state === "ready") return "read";
  if (entry.state === "unavailable" || entry.state === "failed" || entry.state === "offline") {
    return noProjects ? "setup" : "failed";
  }
  return "limited";
}

/** Which register a mode's own state belongs in. */
function registerOfState(state: HomeStateName, noProjects: boolean): Register {
  if (state === "ready" || state === "all-clear" || state === "loading" || state === "updated") {
    return "read";
  }
  if (state === "refreshing") return "read";
  if (state === "first-run") return "setup";
  if (state === "unavailable" || state === "failed" || state === "offline") {
    return noProjects ? "setup" : "failed";
  }
  if (state === "empty") return noProjects ? "setup" : "read";
  return "limited";
}

function worse(a: Register, b: Register): Register {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * The register a mode is flagged with, read from BOTH its state and its
 * disclosures. Taking the state alone would tell a reader that the Inbox was
 * read in full on a morning when one of its items could not be checked against
 * the source, which is exactly the quiet lie the governing rule forbids.
 */
export function registerFor(
  state: HomeStateName,
  disclosures: readonly Disclosure[],
  noProjects: boolean,
): Register {
  let out = registerOfState(state, noProjects);
  for (const entry of disclosures) out = worse(out, registerOfDisclosure(entry, noProjects));
  return out;
}

/** The most severe disclosure on a surface, so the top flag can name its kind. */
export function leadDisclosure(
  disclosures: readonly Disclosure[],
  noProjects: boolean,
): Disclosure | null {
  let lead: Disclosure | null = null;
  let held: Register = "read";
  for (const entry of disclosures) {
    const register = registerOfDisclosure(entry, noProjects);
    if (lead === null || SEVERITY[register] > SEVERITY[held]) {
      lead = entry;
      held = register;
    }
  }
  return lead;
}

export type ModeReading = Readonly<{
  mode: HomeMode;
  label: string;
  register: Register;
  /** The shell's own word for the state. Never a synonym. */
  stateLabel: string;
}>;

/**
 * WHAT THE OTHER THREE MODES KNOW.
 *
 * Round 1: "No mode carries the state of any other mode. Standing in Today you
 * cannot tell whether Inbox was fully read." Every mode's view model is on the
 * props whichever mode is on screen, so this costs one pass and no new data.
 */
/**
 * ANALYTICS WITHHOLDS A CLAIM WITHOUT SAYING SO IN ITS STATE.
 *
 * Round 2: "The 'ELSEWHERE IN HOME' ledger names Inbox and My work as partly
 * read and omits Analytics, while Analytics has withheld its trend for
 * insufficient history. An omission from a list of degraded modes reads as a
 * clean bill of health." Correct, and it is a real hole: `analytics.state` is
 * `ready` on the signature day because the READ succeeded — what failed is a
 * CLAIM inside it, which the state does not model. So the claims are examined
 * directly. A mode holding a number back is partly read, which is the shell's
 * own word for it, not a synonym invented here.
 */
function analyticsWithholds(analytics: AnalyticsView): HomeStateName | null {
  // Worst first. A claim that could not be computed at all outranks a trend
  // that is only waiting for more readings.
  if (analytics.claims.some((claim) => claim.valueLabel === null)) return "partial";
  if (!analytics.trend.renderChart) return "insufficient-history";
  return null;
}

export function readAcrossModes(props: HomeCandidateProps): readonly ModeReading[] {
  const { chrome, copy, today, inbox, myWork, analytics } = props;
  const noProjects = nothingConnectedYet(chrome);
  const views = {
    today: { state: today.state, disclosures: today.disclosures },
    inbox: { state: inbox.state, disclosures: inbox.disclosures },
    "my-work": { state: myWork.state, disclosures: myWork.disclosures },
    analytics: { state: analytics.state, disclosures: analytics.disclosures },
    briefing: { state: today.state, disclosures: today.disclosures },
  } as const;

  return chrome.modes.map((mode) => {
    const view = views[mode.mode];
    // The word has to come from whatever produced the register. Taking the
    // mode's own state word while a disclosure supplied the register is how a
    // mode ends up marked as limited and labelled "Read" in the same line.
    let register = registerOfState(view.state, noProjects);
    let stateLabel = copy.states[view.state];
    for (const entry of view.disclosures) {
      const from = registerOfDisclosure(entry, noProjects);
      if (SEVERITY[from] > SEVERITY[register]) {
        register = from;
        stateLabel = copy.states[entry.state];
      }
    }
    if (mode.mode === "analytics" && register === "read") {
      const withheld = analyticsWithholds(analytics);
      if (withheld !== null) {
        register = "limited";
        stateLabel = copy.states[withheld];
      }
    }
    return { mode: mode.mode, label: mode.label, register, stateLabel };
  });
}

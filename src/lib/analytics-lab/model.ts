/**
 * Wave 5 · The Signal Analytics design lab — one view model, five compositions.
 *
 * WHAT THIS IS. A derivation of `src/lib/project-truth-fixture.ts` into the
 * shape an analytics reading actually has. It is NOT a second fixture: every
 * identifier, name, date and count below either comes from PROJECT_TRUTH_* or
 * is derived from it, and `model.test.ts` fails the build if the derivation
 * drifts from its source. One story, told once, so five compositions argue
 * from identical data and the founder is choosing composition, not content.
 *
 * WHAT IT REFUSES TO SAY, AND WHY. `docs/wave/ANALYTICS_TRUTH.md` is the
 * controlling document. The honest product today is much smaller than the
 * aspirational one, and this model encodes the smaller one:
 *
 *   1. THERE IS NO PORTFOLIO. Every analytics provider binds to one workspace
 *      (`eq(tasks.workspaceId, …)`) and `policy.ts` revalidates exactly one. A
 *      read across all authorized Projects would need a per-Project membership
 *      proof this domain does not perform and cannot fake (D-018). So the
 *      scope of every reading is ONE Project, every composition says so
 *      plainly, and the gap is rendered as a first-class state rather than
 *      papered over with a ledger that would be fabricated.
 *
 *   2. LABELS ARE NOT PROJECTS. The tag-derived concept (`projectIdFromTag`)
 *      is typed `LabelId` here and is never rendered with the word "Project".
 *      That rename is the entire point of the truth gate (D-010).
 *
 *   3. THREE METRICS CAN NEVER BE `available` LIVE, so they resolve
 *      `unsupported` and never zero: work waiting on something else (the
 *      column recording it was retired by migration 0024, R2), decisions from
 *      Notes (no live provider declares `decision_read`, R4), and how a
 *      commitment date moved (nothing writes Timeline `activity`, R4).
 *
 *   4. NO TREND IS PRODUCIBLE. The snapshot writer has zero callers (R7), so
 *      there are no comparable readings, so every composition renders
 *      "Not enough history" and NO CHART. A variant whose hero is a trend is a
 *      variant that cannot ship.
 *
 *   5. THE NEXT-MILESTONE JOIN WAS FALSE and is gone. It matched a Timeline
 *      `project_slug` against a slugified Tasks tag — two values sharing no
 *      namespace, so every match was a coincidence (R1).
 *
 * Copy lives here rather than in the pages so all five compositions are
 * provably reading the same sentences. It is plain English on purpose: this
 * file's strings reach the screen.
 */

import {
  PROJECT_TRUTH_A,
  PROJECT_TRUTH_IDS,
  PROJECT_TRUTH_PROJECTS,
  PROJECT_TRUTH_TODAY,
  projectTruthContentFor,
  type FixtureProjectId,
} from "@/lib/project-truth-fixture";
import { PROJECT_APP_PATH, PRODUCT_APP_PATHS, taskFocusPath } from "@/lib/product-urls";

// ── Truth classes ───────────────────────────────────────────────────────────

/**
 * The three classes stay visibly distinct in every composition, and never by
 * colour alone — each carries its word and a distinct rule style.
 */
export type TruthClass = "reported" | "observed" | "inferred";

export const TRUTH_CLASS_LABEL: Readonly<Record<TruthClass, string>> =
  Object.freeze({
    reported: "Reported",
    observed: "Observed",
    inferred: "Inferred",
  });

export const TRUTH_CLASS_MEANING: Readonly<Record<TruthClass, string>> =
  Object.freeze({
    reported: "Someone wrote this down. It is their account, not a measurement.",
    observed: "Read straight from the records, with no judgement applied.",
    inferred: "A comparison this reading made. The rule is shown with it.",
  });

// ── Availability ────────────────────────────────────────────────────────────

/**
 * Unknown stays unknown. There is deliberately no way to express a missing
 * value as zero: `available` is the only shape carrying a number.
 */
export type Availability =
  | { kind: "available" }
  | { kind: "unsupported"; headline: string; because: string }
  | { kind: "not-connected"; headline: string; because: string }
  | { kind: "partial"; headline: string; because: string }
  | { kind: "stale"; headline: string; because: string; lastRead: string }
  | { kind: "permission-limited"; headline: string; because: string }
  | {
      kind: "insufficient-history";
      headline: string;
      because: string;
      comparableReadings: number;
      readingsNeeded: number;
    }
  | { kind: "failed"; headline: string; because: string; recovery: string };

export function isAvailable(a: Availability): boolean {
  return a.kind === "available";
}

/** What a composition prints where a number would have gone. Never "0". */
export const UNKNOWN_MARK = "—";

// ── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceSource = "Tasks" | "Timeline" | "Notes";

export type EvidenceRow = Readonly<{
  id: string;
  title: string;
  /** Dates and states, exact. Never rounded, never smoothed. */
  meta: string;
  source: EvidenceSource;
  /** An allowlisted in-app route. `/app/trends` does not exist and is never emitted (R6). */
  route: string;
  /** Set when the record changed after this reading, so the row cannot imply the current revision proves the claim. */
  caveat?: string;
}>;

// ── The observation grammar (§3.7) ──────────────────────────────────────────

export type RecommendedAction = Readonly<{
  text: string;
  /** Every action is labelled. A deterministic suggestion shows its rule. */
  kind: "owner-authored" | "deterministic-suggestion";
  rule?: string;
}>;

export type Observation = Readonly<{
  id: string;
  rank: number;
  truthClass: TruthClass;
  labelId: LabelId;
  /** The conclusion, in one sentence. The numbers inside it are receipts, not the headline. */
  claim: string;
  changed: string;
  matters: string;
  action: RecommendedAction;
  /** Coverage and freshness ride with the claim, never in a footer. */
  coverage: string;
  freshness: string;
  evidence: readonly EvidenceRow[];
  /**
   * Two or three words naming what this is, for a composition that wants to
   * mark an exception. Always a restatement of the claim, never a severity
   * grade and never the only place a meaning appears.
   */
  stamp: string;
  /** A limitation the reader must have before acting on this specific claim. */
  limitation?: string;
}>;

// ── Labels (NEVER "Projects") ───────────────────────────────────────────────

export type LabelId = string;

export type LedgerRow = Readonly<{
  id: LabelId;
  name: string;
  /** Open items carrying this label. Labels overlap; see `LEDGER_DENOMINATOR`. */
  open: number;
  /** Items past their own date. */
  pastDate: number;
  /** Days since any record carrying this label last changed. */
  daysSinceRecorded: number | null;
  lastRecorded: string | null;
  /** True when one of the shown exceptions sits on this label. */
  carriesException: boolean;
  /** A label with nothing to report may collapse — but its count stays visible. */
  quiet: boolean;
}>;

// ── The reading ─────────────────────────────────────────────────────────────

export type SourceCoverage = Readonly<{
  source: EvidenceSource;
  status: Availability;
  detail: string;
}>;

export type UnsupportedMetric = Readonly<{
  name: string;
  because: string;
  /** What it would take to make this answerable. Honest, not a promise. */
  wouldNeed: string;
}>;

/**
 * A dated commitment and the work behind it — the honest remains of what a
 * "plan trace" can be today.
 *
 * The commitment date is REPORTED truth: a person wrote it down, and it is
 * shown with who wrote it and when. The state of the linked work is OBSERVED.
 * Comparing the two is INFERRED, and the rule is shown. All three classes
 * appear in one device.
 *
 * What is deliberately absent: how the commitment date itself moved.
 * `milestone_movement` needs Timeline `activity` rows and nothing in the repo
 * writes them (ANALYTICS_TRUTH R4), so a date that moved three times is
 * indistinguishable from one that never moved. `movement` below always
 * carries that refusal, and the composition draws it rather than hiding it.
 */
export type TraceItem = Readonly<{
  id: string;
  title: string;
  date: string;
  /** Days from the reading date. Negative is past. */
  dayOffset: number;
  state: "past-date" | "ahead";
  route: string;
}>;

export type Commitment = Readonly<{
  id: string;
  title: string;
  date: string;
  dayOffset: number;
  authoredBy: string;
  authoredOn: string;
  items: readonly TraceItem[];
  /** Always `unsupported`. Kept per-commitment so the refusal is drawn in place. */
  movement: Availability;
}>;

export type LabScope = Readonly<{
  projectId: FixtureProjectId;
  projectName: string;
  periodName: string | null;
  /** The sentence that states, plainly, what was read. Never implies more. */
  declaration: string;
  readAt: string;
}>;

export type PortfolioGap = Readonly<{
  otherProjectCount: number;
  others: readonly Readonly<{ id: string; name: string; route: string }>[];
  statement: string;
  because: string;
}>;

export type LabView = Readonly<{
  id: LabStateId;
  label: string;
  /** What this state exists to put on screen. Shown in the switcher. */
  proves: string;
  scope: LabScope;
  /** The written conclusion. Two or three sentences, never a headline number. */
  read: readonly string[];
  /** Every valid observation, ranked. Compositions show at most three. */
  observations: readonly Observation[];
  /** Why the first one is first — inspectable, not asserted. */
  rankingRule: string;
  /** A top-three brief must disclose that the others exist. */
  suppression: Readonly<{
    total: number;
    shown: number;
    hidden: number;
    disclosure: string;
    reviewAllLabel: string;
  }>;
  ledger: Readonly<{
    rows: readonly LedgerRow[];
    /** Labels are not Projects, and the denominator is never hidden. */
    denominator: string;
    accounting: string;
    status: Availability;
  }>;
  /**
   * Dated commitments and the work behind them. Empty whenever Timeline could
   * not be read — a commitment nobody could read is not a commitment of none.
   */
  commitments: readonly Commitment[];
  /** At most one contextual trend, and only when real history makes it useful. */
  trend: Readonly<{ title: string; status: Availability }>;
  coverage: readonly SourceCoverage[];
  unsupported: readonly UnsupportedMetric[];
  portfolioGap: PortfolioGap;
  /** Set when the whole reading is degraded and must not be treated as current. */
  banner: Readonly<{ headline: string; detail: string }> | null;
  /** True only when nothing needs the reader AND nothing is degraded. */
  quiet: boolean;
}>;

export type LabStateId =
  | "today"
  | "one-project"
  | "quiet"
  | "first-use"
  | "partial"
  | "stale"
  | "permission"
  | "history"
  | "failure"
  | "stress";

// ── Derivation from the fixture ─────────────────────────────────────────────

/** The Project every reading is taken of. A — the fixture's reference Project. */
const PROJECT = PROJECT_TRUTH_A;
const PROJECT_CONTENT = projectTruthContentFor(PROJECT.id);

/** The fixture's root task titles, used verbatim as evidence. */
const [TASK_CORDON, TASK_LIGHTING, TASK_BOAT] = PROJECT_CONTENT.rootTaskTitles;

const READ_AT = "09:14 on 16 July 2026";

/**
 * The Labels inside this one Project. These are the tag-derived concept, and
 * the rows deliberately sum to more than the Project's open count because a
 * task can carry two labels — the ledger states that rather than hiding it.
 */
const LABELS = {
  pier: "pier-and-ceremony",
  boat: "boat-and-transport",
  guests: "guests",
  suppliers: "suppliers",
  music: "music",
  none: "no-label",
} as const;

/** Open items per label. Sums to 12 across 9 open items: 3 carry two labels. */
const LABEL_OPEN: Readonly<Record<LabelId, number>> = Object.freeze({
  [LABELS.pier]: 4,
  [LABELS.boat]: 3,
  [LABELS.guests]: 2,
  [LABELS.suppliers]: 2,
  [LABELS.music]: 0,
  [LABELS.none]: 1,
});

/** Items carrying more than one label. Load-bearing: it explains the overlap. */
export const LABEL_OVERLAP_COUNT = 3;

export const LEDGER_DENOMINATOR =
  "A piece of work can carry more than one label, so these rows add up to 12 " +
  "across 9 open items. The Project's 9 is the denominator here, never the " +
  "sum of the rows.";

const TASK_ROUTE_CORDON = taskFocusPath("truth-task-harbour-cordon");
const TASK_ROUTE_LIGHTING = taskFocusPath("truth-task-harbour-lighting");
const TASK_ROUTE_BOAT = taskFocusPath("truth-task-harbour-boat");
const TASKS_ROUTE = PRODUCT_APP_PATHS.tasks;
const TIMELINE_ROUTE = PRODUCT_APP_PATHS.timeline;
const NOTES_ROUTE = PRODUCT_APP_PATHS.notes;

// ── The five observations ───────────────────────────────────────────────────

const OBSERVATION_EXPOSURE: Observation = Object.freeze({
  id: "obs-pier-walkthrough",
  stamp: "past date",
  rank: 1,
  truthClass: "observed",
  labelId: LABELS.pier,
  claim:
    "The pier walkthrough is eight days away and two of the three pieces of " +
    "work it depends on are past their own dates.",
  changed:
    "The cordon confirmation passed its date on 11 July. The lighting " +
    "booking passed on 14 July. Both were still open at this reading.",
  matters:
    "The walkthrough is the last point where the harbourmaster's cordon can " +
    "change without a fresh permit.",
  action: Object.freeze({
    text:
      "Open both pieces of work and give them a date you can meet, or move " +
      "the walkthrough.",
    kind: "deterministic-suggestion",
    rule:
      "Work linked to a dated commitment, past its own date, where the " +
      "commitment falls inside fourteen days.",
  }),
  coverage: "All 3 linked pieces of work were read.",
  freshness: "Tasks read 4 minutes ago. Timeline read 6 minutes ago.",
  evidence: Object.freeze([
    Object.freeze({
      id: "ev-cordon",
      title: TASK_CORDON,
      meta: "Due 11 July 2026 · open · no one named",
      source: "Tasks" as const,
      route: TASK_ROUTE_CORDON,
    }),
    Object.freeze({
      id: "ev-lighting",
      title: TASK_LIGHTING,
      meta: "Due 14 July 2026 · open",
      source: "Tasks" as const,
      route: TASK_ROUTE_LIGHTING,
    }),
    Object.freeze({
      id: "ev-walkthrough",
      title: "Pier walkthrough with the harbourmaster",
      meta: "24 July 2026 · written by Orla on 2 June 2026",
      source: "Timeline" as const,
      route: TIMELINE_ROUTE,
    }),
  ]),
  limitation:
    "The date on the walkthrough is the one recorded now. Whether it has " +
    "been moved before is not recorded anywhere, so this cannot tell you.",
});

const OBSERVATION_BOAT: Observation = Object.freeze({
  id: "obs-late-boat",
  stamp: "past date",
  rank: 2,
  truthClass: "observed",
  labelId: LABELS.boat,
  claim:
    "The late boat return is still unagreed, nine days before the guest " +
    "numbers are due.",
  changed:
    "It passed its date on 9 July and has not changed since 27 June.",
  matters:
    "The return time sets the last bus and the numbers the venue is given. " +
    "Both are quoted to guests.",
  action: Object.freeze({
    text: "Agree the time with the skipper, or record that it is still open.",
    kind: "deterministic-suggestion",
    rule:
      "Work past its own date where a dated commitment inside thirty days " +
      "depends on it.",
  }),
  coverage: "All 3 open items on this label were read.",
  freshness: "Tasks read 4 minutes ago.",
  evidence: Object.freeze([
    Object.freeze({
      id: "ev-boat",
      title: TASK_BOAT,
      meta: "Due 9 July 2026 · open · last changed 27 June 2026",
      source: "Tasks" as const,
      route: TASK_ROUTE_BOAT,
    }),
    Object.freeze({
      id: "ev-numbers",
      title: "Final numbers to Harbour House",
      meta: "25 July 2026 · written by Orla on 2 June 2026",
      source: "Timeline" as const,
      route: TIMELINE_ROUTE,
    }),
  ]),
});

const OBSERVATION_SUPPLIERS: Observation = Object.freeze({
  id: "obs-suppliers-quiet",
  stamp: "no movement",
  rank: 3,
  truthClass: "observed",
  labelId: LABELS.suppliers,
  claim: "Nothing has been recorded against Suppliers for 23 days.",
  changed:
    "The last change to any record carrying this label was on 23 June 2026.",
  matters:
    "This is not the same as no work happening. It means nothing here can " +
    "tell you either way, on two open items that carry dates in August.",
  action: Object.freeze({
    text: "Ask whoever owns the supplier list to record where it stands.",
    kind: "deterministic-suggestion",
    rule:
      "No record carrying this label changed in 21 days, and the label has " +
      "open work with a date.",
  }),
  coverage: "Both open items on this label were read.",
  freshness: "Tasks read 4 minutes ago.",
  evidence: Object.freeze([
    Object.freeze({
      id: "ev-suppliers",
      title: "Supplier list for the pier ceremony",
      meta: "Due 6 August 2026 · open · last changed 23 June 2026",
      source: "Tasks" as const,
      route: TASKS_ROUTE,
    }),
  ]),
  limitation:
    "Reading a date is not reading a person. This says a record did not " +
    "change; it does not say anyone was idle, and it is never used that way.",
});

const OBSERVATION_UNOWNED: Observation = Object.freeze({
  id: "obs-lighting-unowned",
  stamp: "no owner",
  rank: 4,
  truthClass: "observed",
  labelId: LABELS.pier,
  claim: "The pier lighting booking has no one named against it.",
  changed: "It has carried no name since it was written on 2 June 2026.",
  matters: "It is one of the two pieces of work the walkthrough depends on.",
  action: Object.freeze({
    text: "Put a name on it.",
    kind: "deterministic-suggestion",
    rule: "Open work with no name, linked to a dated commitment inside fourteen days.",
  }),
  coverage: "All 4 open items on this label were read.",
  freshness: "Tasks read 4 minutes ago.",
  evidence: Object.freeze([
    Object.freeze({
      id: "ev-lighting-2",
      title: TASK_LIGHTING,
      meta: "Due 14 July 2026 · open · no one named",
      source: "Tasks" as const,
      route: TASK_ROUTE_LIGHTING,
    }),
  ]),
});

const OBSERVATION_FOLLOW_UP: Observation = Object.freeze({
  id: "obs-note-follow-up",
  stamp: "still open",
  rank: 5,
  truthClass: "observed",
  labelId: LABELS.guests,
  claim: "One follow-up promoted from a note is still open.",
  changed: "It was promoted on 4 July 2026 and has not been closed.",
  matters:
    "It carries the accessible-seating question, which changes the table plan.",
  action: Object.freeze({
    text: "Close it, or give it a date.",
    kind: "deterministic-suggestion",
    rule: "A follow-up promoted from a note, still open after fourteen days.",
  }),
  coverage: "Counted from the notes you can see.",
  freshness: "Notes read 4 minutes ago.",
  evidence: Object.freeze([
    Object.freeze({
      id: "ev-follow-up",
      title: "Accessible seating for the pier ceremony",
      meta: "Promoted 4 July 2026 · open",
      source: "Notes" as const,
      route: NOTES_ROUTE,
    }),
  ]),
  limitation:
    "Notes are counted as you can see them. Another member of this Project " +
    "would get a different number from the same question, and neither number " +
    "is wrong.",
});

const ALL_OBSERVATIONS: readonly Observation[] = Object.freeze([
  OBSERVATION_EXPOSURE,
  OBSERVATION_BOAT,
  OBSERVATION_SUPPLIERS,
  OBSERVATION_UNOWNED,
  OBSERVATION_FOLLOW_UP,
]);

export const RANKING_RULE =
  "Ranked by how soon a dated commitment could be missed, then by how much " +
  "work is already past its date. The pier walkthrough is first because it " +
  "is the only one attached to a commitment inside fourteen days with more " +
  "than one piece of work past its date.";

// ── The ledger ──────────────────────────────────────────────────────────────

const LEDGER_ROWS: readonly LedgerRow[] = Object.freeze([
  Object.freeze({
    id: LABELS.pier,
    name: "Pier and ceremony",
    open: LABEL_OPEN[LABELS.pier],
    pastDate: 2,
    daysSinceRecorded: 1,
    lastRecorded: "15 July 2026",
    carriesException: true,
    quiet: false,
  }),
  Object.freeze({
    id: LABELS.boat,
    name: "Boat and transport",
    open: LABEL_OPEN[LABELS.boat],
    pastDate: 1,
    daysSinceRecorded: 19,
    lastRecorded: "27 June 2026",
    carriesException: true,
    quiet: false,
  }),
  Object.freeze({
    id: LABELS.suppliers,
    name: "Suppliers",
    open: LABEL_OPEN[LABELS.suppliers],
    pastDate: 0,
    daysSinceRecorded: 23,
    lastRecorded: "23 June 2026",
    carriesException: true,
    quiet: false,
  }),
  Object.freeze({
    id: LABELS.guests,
    name: "Guests",
    open: LABEL_OPEN[LABELS.guests],
    pastDate: 0,
    daysSinceRecorded: 2,
    lastRecorded: "14 July 2026",
    carriesException: false,
    quiet: false,
  }),
  Object.freeze({
    id: LABELS.music,
    name: "Music",
    open: LABEL_OPEN[LABELS.music],
    pastDate: 0,
    daysSinceRecorded: 6,
    lastRecorded: "10 July 2026",
    carriesException: false,
    quiet: true,
  }),
  Object.freeze({
    id: LABELS.none,
    name: "No label",
    open: LABEL_OPEN[LABELS.none],
    pastDate: 0,
    daysSinceRecorded: 5,
    lastRecorded: "11 July 2026",
    carriesException: false,
    quiet: false,
  }),
]);

export const LEDGER_ACCOUNTING =
  "All 6 labels in this Project are listed, including the work carrying no " +
  "label at all. Nothing is left out of this table.";

// ── What can never be answered today ────────────────────────────────────────

const UNSUPPORTED: readonly UnsupportedMetric[] = Object.freeze([
  Object.freeze({
    name: "Work waiting on something else",
    because:
      "The column that recorded it was retired in a data change, and nothing " +
      "records it now. This reads as no answer, not as none.",
    wouldNeed: "The waiting column carried into the reading, then read again.",
  }),
  Object.freeze({
    name: "Decisions taken",
    because: "Notes does not offer decisions to this reading at all.",
    wouldNeed: "Notes declaring decisions as something it can be asked for.",
  }),
  Object.freeze({
    name: "How a commitment date moved",
    because:
      "Nothing writes down a date change, so a date that moved three times " +
      "looks exactly like a date that never moved.",
    wouldNeed: "A record written every time a date changes.",
  }),
]);

/** The refusal drawn at the exact point a movement line would be drawn. */
const MOVEMENT_UNSUPPORTED: Availability = Object.freeze({
  kind: "unsupported" as const,
  headline: "How this date moved is not recorded.",
  because:
    "Nothing writes down a date change, so a date that has moved three times " +
    "looks exactly like one that never moved. This shows where it stands now " +
    "and makes no claim about how it got there.",
});

const COMMITMENTS: readonly Commitment[] = Object.freeze([
  Object.freeze({
    id: "commit-walkthrough",
    title: "Pier walkthrough with the harbourmaster",
    date: "24 July 2026",
    dayOffset: 8,
    authoredBy: "Orla",
    authoredOn: "2 June 2026",
    movement: MOVEMENT_UNSUPPORTED,
    items: Object.freeze([
      Object.freeze({
        id: "trace-cordon",
        title: TASK_CORDON,
        date: "11 July 2026",
        dayOffset: -5,
        state: "past-date" as const,
        route: TASK_ROUTE_CORDON,
      }),
      Object.freeze({
        id: "trace-lighting",
        title: TASK_LIGHTING,
        date: "14 July 2026",
        dayOffset: -2,
        state: "past-date" as const,
        route: TASK_ROUTE_LIGHTING,
      }),
      Object.freeze({
        id: "trace-rig",
        title: "Confirm the lighting rig with the venue",
        date: "22 July 2026",
        dayOffset: 6,
        state: "ahead" as const,
        route: TASKS_ROUTE,
      }),
    ]),
  }),
  Object.freeze({
    id: "commit-numbers",
    title: "Final numbers to Harbour House",
    date: "25 July 2026",
    dayOffset: 9,
    authoredBy: "Orla",
    authoredOn: "2 June 2026",
    movement: MOVEMENT_UNSUPPORTED,
    items: Object.freeze([
      Object.freeze({
        id: "trace-boat",
        title: TASK_BOAT,
        date: "9 July 2026",
        dayOffset: -7,
        state: "past-date" as const,
        route: TASK_ROUTE_BOAT,
      }),
      Object.freeze({
        id: "trace-replies",
        title: "Collect the last four replies",
        date: "20 July 2026",
        dayOffset: 4,
        state: "ahead" as const,
        route: TASKS_ROUTE,
      }),
    ]),
  }),
]);

const TREND_INSUFFICIENT: Availability = Object.freeze({
  kind: "insufficient-history" as const,
  headline: "Not enough history.",
  because:
    "A trend needs readings taken on the same terms on different days. None " +
    "have been kept, so there is nothing to compare and no line to draw.",
  comparableReadings: 0,
  readingsNeeded: 6,
});

// ── The portfolio gap ───────────────────────────────────────────────────────

const OTHER_PROJECTS = PROJECT_TRUTH_PROJECTS.filter((p) => p.id !== PROJECT.id);

const PORTFOLIO_GAP: PortfolioGap = Object.freeze({
  otherProjectCount: OTHER_PROJECTS.length,
  others: Object.freeze(
    OTHER_PROJECTS.map((p) =>
      Object.freeze({
        id: p.id,
        name: p.name,
        route: `${PROJECT_APP_PATH}/${p.slug}`,
      }),
    ),
  ),
  statement:
    `This reads ${PROJECT.name} only. You can open ${OTHER_PROJECTS.length} ` +
    "other Projects, and this can read any one of them the same way. It " +
    "cannot yet read them together.",
  because:
    "Reading them together would mean proving your membership of each one " +
    "separately, and that proof has not been built. Rather than guess, this " +
    "reads one Project and says so.",
});

// ── Source coverage ─────────────────────────────────────────────────────────

const COVERAGE_HEALTHY: readonly SourceCoverage[] = Object.freeze([
  Object.freeze({
    source: "Tasks" as const,
    status: Object.freeze({ kind: "available" as const }),
    detail: "All 9 open items read 4 minutes ago.",
  }),
  Object.freeze({
    source: "Timeline" as const,
    status: Object.freeze({ kind: "available" as const }),
    detail: "Both dated commitments read 6 minutes ago.",
  }),
  Object.freeze({
    source: "Notes" as const,
    status: Object.freeze({
      kind: "permission-limited" as const,
      headline: "Counted as you can see it.",
      because:
        "Notes are read as the person asking can see them. Another member of " +
        "this Project would get a different count from the same question.",
    }),
    detail: "Follow-ups you can see, read 4 minutes ago.",
  }),
]);

// ── States ──────────────────────────────────────────────────────────────────

function scopeFor(
  projectId: FixtureProjectId,
  projectName: string,
  periodName: string | null,
  declaration: string,
): LabScope {
  return Object.freeze({
    projectId,
    projectName,
    periodName,
    declaration,
    readAt: READ_AT,
  });
}

const DEFAULT_SCOPE = scopeFor(
  PROJECT.id,
  PROJECT.name,
  PROJECT.planningPeriod?.name ?? null,
  `This reads ${PROJECT.name} only, for the ${PROJECT.planningPeriod?.name}.`,
);

const DEFAULT_READ: readonly string[] = Object.freeze([
  "Two dated commitments in the next nine days have work behind them that is " +
    "already past its own date.",
  "Everything else in this Project is either moving or has nothing recorded " +
    "against it, and the difference between those two is set out below.",
]);

function baseView(overrides: Partial<LabView> & Pick<LabView, "id" | "label" | "proves">): LabView {
  const observations = overrides.observations ?? ALL_OBSERVATIONS;
  const shown = Math.min(3, observations.length);
  const hidden = Math.max(0, observations.length - shown);
  return Object.freeze({
    scope: DEFAULT_SCOPE,
    read: DEFAULT_READ,
    observations,
    rankingRule: RANKING_RULE,
    suppression: Object.freeze({
      total: observations.length,
      shown,
      hidden,
      disclosure:
        hidden > 0
          ? `${shown} of ${observations.length} shown. ${hidden} more were ranked below them by the same rule.`
          : `${observations.length} of ${observations.length} shown. Nothing was held back.`,
      reviewAllLabel: `Review all ${observations.length}`,
    }),
    ledger: Object.freeze({
      rows: LEDGER_ROWS,
      denominator: LEDGER_DENOMINATOR,
      accounting: LEDGER_ACCOUNTING,
      status: Object.freeze({ kind: "available" as const }),
    }),
    commitments: COMMITMENTS,
    trend: Object.freeze({
      title: "Movement over time",
      status: TREND_INSUFFICIENT,
    }),
    coverage: COVERAGE_HEALTHY,
    unsupported: UNSUPPORTED,
    portfolioGap: PORTFOLIO_GAP,
    banner: null,
    quiet: false,
    ...overrides,
  }) as LabView;
}

const STATE_BUILDERS: Readonly<Record<LabStateId, () => LabView>> = Object.freeze({
  today: () =>
    baseView({
      id: "today",
      label: "Today's truth",
      proves:
        "Five valid observations, the top three shown, all five disclosed, " +
        "and a trend that honestly refuses to draw itself.",
    }),

  "one-project": () =>
    baseView({
      id: "one-project",
      label: "One Project only",
      proves:
        "The gap between what this can read now and a portfolio read, made " +
        "legible instead of hidden.",
      banner: Object.freeze({
        headline: "This reads one Project.",
        detail: PORTFOLIO_GAP.because,
      }),
    }),

  quiet: () =>
    baseView({
      id: "quiet",
      label: "Nothing needs you",
      proves:
        "A quiet reading that still refuses to say all clear, because one " +
        "source is only ever counted as the reader can see it.",
      observations: Object.freeze([]),
      read: Object.freeze([
        "Nothing in the work this can read needs you today.",
        "That is not the same as all clear. Notes are counted only as you " +
          "can see them, so this speaks for your view of this Project and " +
          "not for anyone else's.",
      ]),
      ledger: Object.freeze({
        rows: Object.freeze(
          LEDGER_ROWS.map((r) =>
            Object.freeze({ ...r, pastDate: 0, carriesException: false }),
          ),
        ),
        denominator: LEDGER_DENOMINATOR,
        accounting: LEDGER_ACCOUNTING,
        status: Object.freeze({ kind: "available" as const }),
      }),
      quiet: true,
    }),

  "first-use": () =>
    baseView({
      id: "first-use",
      commitments: Object.freeze([]),
      label: "Nothing connected yet",
      proves:
        "First use, where the honest answer is that there is nothing to read " +
        "yet, said once and without a false empty table.",
      observations: Object.freeze([]),
      read: Object.freeze([
        "There is nothing to read yet.",
        "This reading works from Tasks, Timeline and Notes. None of them has " +
          "been connected to this Project, so there is no evidence to draw a " +
          "conclusion from, and none will be invented.",
      ]),
      ledger: Object.freeze({
        rows: Object.freeze([]),
        denominator:
          "No labels to count. This is an empty table, not a table of zeros.",
        accounting: "Nothing has been connected, so nothing is listed.",
        status: Object.freeze({
          kind: "not-connected" as const,
          headline: "Nothing connected yet.",
          because:
            "No source has been connected to this Project, so there is no " +
            "work to account for.",
        }),
      }),
      coverage: Object.freeze(
        (["Tasks", "Timeline", "Notes"] as const).map((source) =>
          Object.freeze({
            source,
            status: Object.freeze({
              kind: "not-connected" as const,
              headline: "Not connected.",
              because: `${source} has not been connected to this Project.`,
            }),
            detail: "Never read.",
          }),
        ),
      ),
    }),

  partial: () =>
    baseView({
      id: "partial",
      commitments: Object.freeze([]),
      label: "Part of the evidence",
      proves:
        "One source missing, the observations that depended on it withdrawn " +
        "rather than degraded, and the gap named in the conclusion.",
      observations: Object.freeze([
        OBSERVATION_SUPPLIERS,
        OBSERVATION_UNOWNED,
        OBSERVATION_FOLLOW_UP,
      ]),
      read: Object.freeze([
        "Part of the evidence is missing, so this reading is narrower than usual.",
        "Timeline could not be read, which means anything about a dated " +
          "commitment is missing from this — including whether work past its " +
          "date threatens one. Two observations were withdrawn for that " +
          "reason rather than shown without their evidence.",
      ]),
      rankingRule:
        "Ranked by how much work is past its date. Nothing could be ranked by " +
        "how soon a commitment could be missed, because commitments could not " +
        "be read.",
      coverage: Object.freeze([
        COVERAGE_HEALTHY[0],
        Object.freeze({
          source: "Timeline" as const,
          status: Object.freeze({
            kind: "partial" as const,
            headline: "Not read.",
            because:
              "Timeline is not connected to this Project, so dated " +
              "commitments could not be read at all.",
          }),
          detail: "No commitments read.",
        }),
        COVERAGE_HEALTHY[2],
      ]),
      banner: Object.freeze({
        headline: "Two observations were withdrawn.",
        detail:
          "They depended on dated commitments, which could not be read. They " +
          "are withheld rather than shown with a piece missing.",
      }),
    }),

  stale: () =>
    baseView({
      id: "stale",
      label: "An old reading",
      proves:
        "Stale evidence kept as a labelled receipt but barred from ranking, " +
        "from any recommended action, and from the words all clear.",
      rankingRule:
        "Nothing is ranked. The evidence is older than this reading trusts, " +
        "so the order below is the order it was written, not a judgement.",
      read: Object.freeze([
        "This is a reading from three days ago, kept because it is the last " +
          "one that completed.",
        "It is old enough that it is not ranked, nothing here is recommended, " +
          "and nothing is called all clear. Work has almost certainly moved " +
          "since, and this cannot see it.",
      ]),
      coverage: Object.freeze([
        Object.freeze({
          source: "Tasks" as const,
          status: Object.freeze({
            kind: "stale" as const,
            headline: "Three days old.",
            because:
              "This reading trusts work records for one day. Past that it is " +
              "kept as a record of what was true, and stops driving anything.",
            lastRead: "13 July 2026",
          }),
          detail: "9 open items, as they stood on 13 July.",
        }),
        COVERAGE_HEALTHY[1],
        COVERAGE_HEALTHY[2],
      ]),
      banner: Object.freeze({
        headline: "This reading is three days old.",
        detail:
          "It is shown because an old answer you can date is more use than no " +
          "answer. It is not ranked and it recommends nothing.",
      }),
    }),

  permission: () =>
    baseView({
      id: "permission",
      label: "Limited by what you can see",
      proves:
        "The exact permission sentence, and a count that never reveals a " +
        "denominator the reader has no right to.",
      scope: scopeFor(
        PROJECT_TRUTH_IDS.riversideRooms,
        "Riverside Rooms weddings",
        null,
        "This reads Riverside Rooms weddings only, which is shared with you.",
      ),
      read: Object.freeze([
        "Based on the Projects visible to you; organization-wide completeness " +
          "is unavailable.",
        "You are a member of this Project rather than its owner, so some of " +
          "the work behind these counts is not yours to open. Where that is " +
          "true it is marked, and no total is shown that would tell you the " +
          "size of what you cannot see.",
      ]),
      ledger: Object.freeze({
        rows: Object.freeze(
          LEDGER_ROWS.slice(0, 4).map((r) =>
            Object.freeze({ ...r, carriesException: false }),
          ),
        ),
        denominator:
          "These rows count only the work you can open. There is no total " +
          "here for anything else, because that total would tell you " +
          "something you have not been given.",
        accounting:
          "All 4 labels you can see are listed. Whether there are others is " +
          "not answered either way.",
        status: Object.freeze({
          kind: "permission-limited" as const,
          headline: "Counted from what you can open.",
          because:
            "Every row was counted from records you can open. Nothing here " +
            "was counted from records you cannot.",
        }),
      }),
      banner: Object.freeze({
        headline: "Based on the Projects visible to you.",
        detail:
          "Organization-wide completeness is unavailable, and no count here " +
          "implies it.",
      }),
    }),

  history: () =>
    baseView({
      id: "history",
      label: "Not enough history",
      proves:
        "The trend section refusing to draw a chart, and saying exactly what " +
        "it would take to draw one.",
      read: Object.freeze([
        "There is no history to compare this reading against.",
        "Readings are not being kept, so there is no earlier one to hold this " +
          "up to. Until that changes, this can tell you what is true now and " +
          "nothing at all about the direction of travel.",
      ]),
    }),

  failure: () =>
    baseView({
      id: "failure",
      commitments: Object.freeze([]),
      label: "One source failed",
      proves:
        "A failure contained to its own section, refusing both a silent zero " +
        "and a whole-page error.",
      observations: Object.freeze([
        OBSERVATION_SUPPLIERS,
        OBSERVATION_UNOWNED,
        OBSERVATION_FOLLOW_UP,
      ]),
      read: Object.freeze([
        "One source could not be read, so part of this is missing rather than empty.",
        "Reading dated commitments failed. That is a failure, not a finding: " +
          "it does not mean there are none, and nothing here is called all " +
          "clear while it is true.",
      ]),
      rankingRule:
        "Ranked by how much work is past its date. Commitments could not be " +
        "read, so they could not take part in the ranking.",
      coverage: Object.freeze([
        COVERAGE_HEALTHY[0],
        Object.freeze({
          source: "Timeline" as const,
          status: Object.freeze({
            kind: "failed" as const,
            headline: "Could not be read.",
            because:
              "The request for dated commitments did not come back. Nothing " +
              "was returned, so nothing is claimed.",
            recovery: "Try this section again",
          }),
          detail: "No commitments read.",
        }),
        COVERAGE_HEALTHY[2],
      ]),
      banner: Object.freeze({
        headline: "Dated commitments could not be read.",
        detail:
          "This section failed rather than came back empty. The rest of the " +
          "reading stands on its own evidence.",
      }),
    }),

  stress: () => {
    const stressProject = PROJECT_TRUTH_PROJECTS.find(
      (p) => p.id === PROJECT_TRUTH_IDS.coastguardStation,
    );
    const longEvidence: readonly EvidenceRow[] = Object.freeze(
      Array.from({ length: 18 }, (_v, i) =>
        Object.freeze({
          id: `ev-stress-${i + 1}`,
          title:
            i % 3 === 0
              ? "Walk the Ballynagaul pier crossing at high tide and record the " +
                "time it takes with the wedding party at walking pace"
              : i % 3 === 1
                ? "懇親会の席次を決める"
                : "Cuir an ceol tráthnóna in áirithe agus deimhnigh an t-am",
          meta: `Due ${8 + (i % 20)} August 2026 · open`,
          source: "Tasks" as const,
          route: TASKS_ROUTE,
          caveat:
            i === 4
              ? "This record changed after the reading. It no longer proves " +
                "what it proved then."
              : undefined,
        }),
      ),
    );
    return baseView({
      id: "stress",
      label: "Long names, long lists",
      proves:
        "A very long Project name, labels in three scripts, and one " +
        "observation carrying 18 pieces of evidence.",
      scope: scopeFor(
        PROJECT_TRUTH_IDS.coastguardStation,
        stressProject?.name ?? "",
        stressProject?.planningPeriod?.name ?? null,
        `This reads ${stressProject?.name ?? ""} only, for the ${stressProject?.planningPeriod?.name}.`,
      ),
      observations: Object.freeze([
        Object.freeze({
          ...OBSERVATION_EXPOSURE,
          claim:
            "The Ballynagaul pier crossing at high tide has eighteen pieces " +
            "of work behind it and four of them are past their own dates.",
          evidence: longEvidence,
          coverage: "All 18 linked pieces of work were read.",
        }),
        OBSERVATION_BOAT,
        OBSERVATION_SUPPLIERS,
        OBSERVATION_UNOWNED,
        OBSERVATION_FOLLOW_UP,
      ]),
      ledger: Object.freeze({
        rows: Object.freeze([
          Object.freeze({
            ...LEDGER_ROWS[0],
            name:
              "Pier crossing, tide timings and the Sunday brunch handover at " +
              "the Old Coastguard Station",
          }),
          Object.freeze({ ...LEDGER_ROWS[1], name: "秋季企業合宿 · 海辺の懇親会" }),
          Object.freeze({
            ...LEDGER_ROWS[2],
            name: "Bainis Uí Chonchúir · Cóisir na Samhna",
          }),
          Object.freeze({
            ...LEDGER_ROWS[3],
            name: "Betriebsversammlung und Jahresabschlussfeier Ballybunion",
          }),
          LEDGER_ROWS[4],
          LEDGER_ROWS[5],
        ]),
        denominator: LEDGER_DENOMINATOR,
        accounting: LEDGER_ACCOUNTING,
        status: Object.freeze({ kind: "available" as const }),
      }),
    });
  },
});

export const LAB_STATE_IDS: readonly LabStateId[] = Object.freeze([
  "today",
  "one-project",
  "quiet",
  "first-use",
  "partial",
  "stale",
  "permission",
  "history",
  "failure",
  "stress",
]);

export function labView(id: LabStateId): LabView {
  return STATE_BUILDERS[id]();
}

export function parseLabState(raw: string | string[] | undefined): LabStateId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return LAB_STATE_IDS.includes(value as LabStateId)
    ? (value as LabStateId)
    : "today";
}

/** Every state's switcher entry, built once so all five compositions match. */
export const LAB_STATES: readonly Readonly<{
  id: LabStateId;
  label: string;
  proves: string;
}>[] = Object.freeze(
  LAB_STATE_IDS.map((id) => {
    const view = labView(id);
    return Object.freeze({ id, label: view.label, proves: view.proves });
  }),
);

// ── The five compositions ───────────────────────────────────────────────────

export type VariantId = "editorial" | "ledger" | "trace" | "hybrid" | "w";

export const VARIANTS: readonly Readonly<{
  id: VariantId;
  route: string;
  name: string;
  idea: string;
}>[] = Object.freeze([
  Object.freeze({
    id: "editorial",
    route: "/lab/signal-analytics-editorial",
    name: "Editorial Briefing",
    idea: "The read is the product. Numbers are receipts set inside the sentence they support.",
  }),
  Object.freeze({
    id: "ledger",
    route: "/lab/signal-analytics-ledger",
    name: "Evidence Ledger",
    idea: "One table of every label, with the three exceptions lifted out of it rather than repeated above it.",
  }),
  Object.freeze({
    id: "trace",
    route: "/lab/signal-analytics-trace",
    name: "Plan Trace",
    idea: "Dated commitments against the state of the work behind them, drawn without inventing history.",
  }),
  Object.freeze({
    id: "hybrid",
    route: "/lab/signal-analytics-hybrid",
    name: "Hybrid",
    idea: "The written read, the fused ledger, and a third section spent on what cannot be said.",
  }),
  Object.freeze({
    id: "w",
    route: "/lab/signal-analytics-w",
    name: "W · The Wire",
    idea: "A briefing that is paced rather than scrolled, set like something printed and torn off.",
  }),
]);

export const LAB_INDEX_ROUTE = "/lab/signal-analytics";

/** Guards the fixture clock so the lab cannot silently drift from PROJECT_TRUTH. */
export const LAB_TODAY = PROJECT_TRUTH_TODAY;
export const LAB_PROJECT_OPEN_COUNT = PROJECT.activeRootTaskCount;
export const LAB_PROJECT_NAME = PROJECT.name;

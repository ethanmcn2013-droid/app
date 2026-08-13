/**
 * The candidate contract.
 *
 * THE ONE FILE A DIRECTION IMPORTS. Four agents build four candidates; each
 * one exports a component of type `HomeCandidate` and receives
 * `HomeCandidateProps`. Nothing else crosses the boundary: no candidate reads
 * the fixture layer, no candidate writes a rendered string the shell already
 * publishes, no candidate parses the URL, no candidate resolves a link.
 *
 * WHY THE SHELL OWNS THE WORDS AS WELL AS THE RECORDS. The fairness rule for
 * this lab is that the four directions differ ONLY in composition, rhythm,
 * hierarchy, navigation, detail behaviour, disclosure and motion. Handing four
 * agents the same records and letting each write its own row label would
 * produce four different products, and a director comparing them would be
 * comparing copywriting. So every sentence a reader can see is composed once,
 * here, and handed over already written. A candidate chooses WHERE a sentence
 * goes, WHETHER it is disclosed immediately or on demand, and HOW it is
 * weighted. It does not choose what it says.
 *
 * WHAT A CANDIDATE STILL OWNS, and it is most of the design: the composition
 * of every mode, the reading measure, the type scale within the estate's
 * tokens, the rhythm and grouping of rows, the navigation model, what is
 * disclosed on arrival versus on demand, the detail behaviour, the responsive
 * transformation, and one earned signature moment.
 *
 * VOICE. Every string below is already in the house voice — plain English,
 * active verbs, no exclamation marks, no em dashes, no marketing vocabulary.
 * A candidate that writes its own visible string is responsible for the same
 * rule, and should be reaching for `copy` first.
 */

import type { ReactNode } from "react";
import type {
  AnalyticsClaim,
  AnalyticsException,
  HomeMode,
  LedgerRow,
  MyWorkGroup,
  ScenarioId,
  TrendResult,
} from "../fixtures";
import type { Disposition, InboxKind, Visibility } from "../inbox/contract";
import type { LabScope, LabUrlState, LabVariantNumber, LabVariantSlug } from "./lab-url";

// ── The state vocabulary ────────────────────────────────────────────────────

/**
 * HOME_EXPERIENCE §10.1, verbatim, plus `ready` for the ordinary case. One
 * name per state, used in copy, in announcements and in test fixtures. No
 * surface invents a synonym.
 */
export type HomeStateName =
  | "ready"
  | "loading"
  | "refreshing"
  | "updated"
  | "partial"
  | "stale"
  | "insufficient-history"
  | "permission-limited"
  | "unavailable"
  | "archived"
  | "empty"
  | "failed"
  | "offline"
  | "all-clear";

/**
 * A fact the reader is owed about what they are looking at. Never optional,
 * never collapsible to nothing: a direction chooses whether a disclosure is
 * on the surface or one interaction away, never whether it exists.
 */
export type Disclosure = Readonly<{
  id: string;
  tone: "coverage" | "permission" | "freshness" | "scope" | "failure" | "setup" | "scale";
  /** One sentence, already written. Render verbatim. */
  text: string;
  /** The state this disclosure is the voice of. */
  state: HomeStateName;
}>;

/**
 * Product plus resolved Project name, on every cross-product row.
 *
 * `text` is the composed form and it is what a row renders. It may not be
 * dropped at a narrow viewport: HOME_EXPERIENCE D-HX08 makes content parity a
 * hard rule, and the live product's own review row currently drops its
 * provenance at 320px, which is the defect this field exists to prevent.
 */
export type Provenance = Readonly<{
  product: "Tasks" | "Notes" | "Timeline";
  projectId: string | null;
  /** Null when the Project could not be read. Never a placeholder name. */
  projectName: string | null;
  text: string;
}>;

/** A date the reader can act on, already formatted in the world's own zone. */
export type WhenLabel = Readonly<{
  iso: string;
  /** "Thursday 16 July" */
  absolute: string;
  /** "Due today", "2 days late", "In 5 days" */
  relative: string;
  overdue: boolean;
}>;

/**
 * An action a row offers. `available: false` still renders: an unavailable
 * action is disclosed with its reason, never removed, because a control that
 * vanishes tells the reader nothing about why.
 */
export type RowAction = Readonly<{
  id: string;
  label: string;
  available: boolean;
  /** Present exactly when `available` is false. */
  unavailableReason: string | null;
  /** Set on navigational actions. Null on ones a direction wires itself. */
  href: string | null;
  /** True when the action reaches a source that must confirm before success. */
  needsSourceConfirmation: boolean;
}>;

// ── Today ───────────────────────────────────────────────────────────────────

export type TodaySectionId = "todaysSignal" | "comingUp" | "needsReview" | "movingWell";

export type TodayRow = Readonly<{
  key: string;
  title: string;
  /** Names the RULE that fired. Never a score, never a ranking position. */
  reason: string;
  provenance: Provenance;
  due: WhenLabel | null;
  /** "Quiet for 9 days". Null when the row has no idle history. */
  idleLine: string | null;
  /** True for a reading OF objects rather than an object. */
  isReading: boolean;
  /** How many objects a reading was taken from. Zero for an ordinary row. */
  memberCount: number;
  /** Opens this row inside the lab. Built by one builder, never concatenated. */
  href: string;
  /**
   * The production route this row would open in the product. Rendered as the
   * return path a reader is owed; never followed, because the lab does not
   * leave the lab.
   */
  sourcePath: string;
  actions: readonly RowAction[];
}>;

export type TodaySection = Readonly<{
  id: TodaySectionId;
  heading: string;
  /** "Looking fourteen days ahead." Null where the section has no window. */
  windowLine: string | null;
  rows: readonly TodayRow[];
  /** "Two more crossed a rule and are not shown here." Null when nothing was held back. */
  suppressedLine: string | null;
  moreHref: string | null;
  moreLabel: string | null;
}>;

export type TodayView = Readonly<{
  state: HomeStateName;
  /** The expressive line. The mode name is in `chrome.modeEyebrow`. */
  headline: string;
  sections: readonly TodaySection[];
  /** "Signal read 24 items, showed 3 …" Null when a term could not be computed. */
  accountingLine: string | null;
  /** Present exactly when `accountingLine` is null. Says why, never a number. */
  accountingWithheldLine: string | null;
  /**
   * `allowed` is true in exactly one world. Everywhere else `line` names what
   * forbids the quiet reading, so a quiet day and a broken provider are
   * visibly different.
   */
  quiet: Readonly<{ allowed: boolean; line: string }>;
  /** Kinds that are eligible and have no producer. Never an empty section. */
  unsupported: readonly Disclosure[];
  disclosures: readonly Disclosure[];
  briefingHref: string;
  briefingLabel: string;
  /** The row named by `?item=`, if it resolved. */
  selection: TodayRow | null;
  selectionMissingLine: string | null;
}>;

// ── Inbox ───────────────────────────────────────────────────────────────────

export type InboxRow = Readonly<{
  eventId: string;
  kind: InboxKind;
  kindLabel: string;
  /**
   * Null when the source read did not come back, or when membership was
   * revoked. `titleFallback` is what renders instead, and the two states say
   * different things: one is "could not check", one is "no longer yours".
   */
  title: string | null;
  titleState: "available" | "undetermined" | "unavailable";
  titleFallback: string;
  actorName: string | null;
  provenance: Provenance;
  /** "Yesterday at 14:20" */
  occurredLine: string;
  visibility: Visibility;
  visibilityLabel: string;
  disposition: Disposition;
  dispositionLabel: string;
  /** Set when the row is snoozed. Carries the exact resurfacing instant. */
  snoozeLine: string | null;
  /** The last settled source-action attempt, if any. */
  attempt: Readonly<{
    outcome: "pending" | "committed" | "refused" | "undetermined";
    line: string;
    recoveryLabel: string | null;
  }> | null;
  /** True when the source moved on after the event was emitted. */
  revisionMoved: boolean;
  revisionLine: string | null;
  href: string;
  /** The production route this event points at. Shown, never followed. */
  sourcePath: string;
  actions: readonly RowAction[];
}>;

export type InboxGroup = Readonly<{
  key: string;
  heading: string;
  /** "Three asks in one thread." Null on a single-row group. */
  subheading: string | null;
  rows: readonly InboxRow[];
}>;

export type InboxView = Readonly<{
  state: HomeStateName;
  headline: string;
  /**
   * One count, resolved once. `glyph` is null when the count could not be
   * read, and null is never rendered as zero.
   */
  badge: Readonly<{
    count: number;
    glyph: string | null;
    accessibleName: string;
    coverage: "complete" | "partial" | "unavailable";
    /** False when there is no Project for the badge to be a count of. */
    rendered: boolean;
  }>;
  groups: readonly InboxGroup[];
  rowsShown: number;
  selection: InboxRow | null;
  selectionMissingLine: string | null;
  /** Null unless the queue is genuinely, completely empty. */
  emptyLine: string | null;
  disclosures: readonly Disclosure[];
  /** The snooze choices, each with the exact instant it resurfaces. */
  snoozeOptions: readonly Readonly<{
    id: string;
    label: string;
    resurfaceIso: string;
    resurfaceLine: string;
  }>[];
}>;

// ── My work ─────────────────────────────────────────────────────────────────

export type MyWorkRowView = Readonly<{
  key: string;
  title: string;
  provenance: Provenance;
  group: MyWorkGroup;
  /** Why this row is in this group, in words. */
  groupReasonLine: string;
  due: WhenLabel | null;
  /** Free text from the source. Rendered verbatim or not at all. */
  dueUnparsedLine: string | null;
  columnLabel: string;
  waitingLine: string | null;
  coAssigneeLine: string | null;
  isMilestone: boolean;
  /** Opens this row inside the lab. Built by one builder, never concatenated. */
  href: string;
  /** The production route, which always carries the Project. Shown, never followed. */
  sourcePath: string;
  actions: readonly RowAction[];
}>;

export type MyWorkGroupView = Readonly<{
  id: MyWorkGroup;
  heading: string;
  note: string | null;
  rows: readonly MyWorkRowView[];
}>;

export type MyWorkView = Readonly<{
  state: HomeStateName;
  headline: string;
  kind: "ready" | "no-projects" | "identity-unresolved" | "unavailable";
  groups: readonly MyWorkGroupView[];
  rowsShown: number;
  /** "Read 3 of 4 projects." Null only when coverage is complete. */
  coverageLine: string | null;
  /** The zone the day boundaries were drawn in, when it is not the reader's. */
  timeZoneLine: string | null;
  /** "12 finished items are filtered out." A filter, never an absence. */
  doneExcludedLine: string | null;
  moreHref: string | null;
  moreLabel: string | null;
  emptyLine: string | null;
  disclosures: readonly Disclosure[];
  selection: MyWorkRowView | null;
  selectionMissingLine: string | null;
}>;

// ── Analytics ───────────────────────────────────────────────────────────────

export type AnalyticsClaimView = Readonly<{
  id: string;
  /** The question the claim answers, in the reader's words. */
  question: string;
  metricLabel: string;
  /** Null when the claim could not be computed. Null is never rendered as 0. */
  valueLabel: string | null;
  status: "available" | "partial" | "insufficient_history" | "unsupported";
  /** Present when `status` is not `available`. Names the state, not a number. */
  statusLine: string | null;
  definitionLine: string;
  /** "3 of 24 open items, across 3 projects." */
  populationLine: string;
  /** Always present. There is no claim with no limitation. */
  limitationLine: string;
  windowLine: string;
  coverageLine: string | null;
  permissionLine: string | null;
  /** "No accepted baseline". Never a dash. */
  baselineLine: string;
  truthClassLabel: string;
  evidenceHref: string;
  evidenceLabel: string;
  correctionLine: string;
  /** The exact receipt behind the number. A claim reaches its own records. */
  receipt: Readonly<{
    includedCount: number;
    excludedCount: number;
    /** One line per exclusion reason, with its count. */
    exclusionLines: readonly string[];
    ingestionLine: string;
    versionLine: string;
  }>;
  /** The claim as the fixture derived it, for a direction that wants a field
   *  the view model does not surface. Read-only, and never re-worded. */
  source: AnalyticsClaim;
}>;

export type AnalyticsLedgerRowView = Readonly<{
  projectId: string;
  /** Null when the Project could not be read. Never a placeholder. */
  projectName: string | null;
  state: LedgerRow["state"];
  stateLabel: string;
  openWorkLabel: string | null;
  overdueLabel: string | null;
  href: string | null;
}>;

export type AnalyticsExceptionView = Readonly<{
  id: string;
  headline: string;
  /** Labelled as a suggestion. Never a should. */
  suggestion: string;
  provenance: Provenance;
  evidenceHref: string;
  evidenceLabel: string;
  source: AnalyticsException;
}>;

export type AnalyticsView = Readonly<{
  state: HomeStateName;
  headline: string;
  /** The prose opening. Analytics is evidence-led, never a chart wall. */
  leadLine: string;
  claims: readonly AnalyticsClaimView[];
  exceptions: readonly AnalyticsExceptionView[];
  exceptionsHeading: string;
  /** Every authorized Project, with its state. Complete, or exactly totalled. */
  ledger: readonly AnalyticsLedgerRowView[];
  ledgerHeading: string;
  ledgerCoverageLine: string | null;
  /**
   * Exactly one trend in V1. When history has not earned it, `renderChart` is
   * false and `line` is the honest sentence. No flat line, no single point,
   * no greyed axis.
   */
  trend: Readonly<{
    renderChart: boolean;
    line: string;
    heading: string;
    source: TrendResult;
  }>;
  /** What the URL asked for, and what the claims actually computed. */
  windowLine: string;
  windowMismatchLine: string | null;
  disclosures: readonly Disclosure[];
  /** The Project Lens, which changes neither Read Scope nor Active Project. */
  lens: Readonly<{
    open: boolean;
    projectId: string | null;
    projectName: string | null;
    line: string | null;
    closeHref: string | null;
    closeLabel: string;
  }>;
}>;

// ── Full briefing ───────────────────────────────────────────────────────────

export type BriefingView = Readonly<{
  state: HomeStateName;
  headline: string;
  /** The same sections as Today, uncapped. One ranking engine, two depths. */
  sections: readonly TodaySection[];
  accountingLine: string | null;
  accountingWithheldLine: string | null;
  disclosures: readonly Disclosure[];
  /** Back to the exact Today position the reader came from. */
  returnHref: string;
  returnLabel: string;
}>;

// ── The chrome ──────────────────────────────────────────────────────────────

export type HomeModeLink = Readonly<{
  mode: HomeMode;
  label: string;
  href: string;
  /**
   * Exactly one link in the document carries `"page"`, and its href is the
   * current URL. A subtree match is `"true"`, never `"page"` (D-HX04).
   */
  ariaCurrent: "page" | "true" | null;
  /** Only Inbox carries one, and only one affordance announces it. */
  badge: Readonly<{ glyph: string; announce: boolean }> | null;
}>;

export type ScopeOption = Readonly<{
  id: string;
  label: string;
  /** Which of the two axes this option moves, said in words. */
  group: "read-scope" | "project" | "lens";
  href: string;
  current: boolean;
}>;

export type HomeChrome = Readonly<{
  /** `Inbox · Home · Signal Studio`. Static per mode. Carries no Project name. */
  documentTitle: string;
  /**
   * The mode name. It must reach the accessible text of the `h1`, either as
   * the `h1` itself or as a visible eyebrow inside it (D-HX02). Both patterns
   * are permitted and a direction picks one.
   */
  modeEyebrow: string;
  /** The expressive line that sits with the eyebrow. */
  h1Line: string;
  /** The four modes. Full briefing is depth from Today, not a fifth item. */
  modes: readonly HomeModeLink[];
  navLabel: string;
  skipLinkLabel: string;
  statusRegionLabel: string;
  /** The one control that changes Read Scope. Its label states the scope. */
  scope: Readonly<{
    label: string;
    kind: LabScope;
    /** Says which axis is being moved, so the two are never conflated. */
    helpLine: string;
    options: readonly ScopeOption[];
    resetHref: string | null;
    resetLabel: string;
    /** "Read 3 of 4 projects." Null when every Project resolved. */
    coverageLine: string | null;
  }>;
  actor: Readonly<{ name: string; roleLabel: string }>;
  activeProject: Readonly<{
    id: string | null;
    name: string | null;
    /** Names the Project a product link would land in. */
    line: string;
  }>;
  asOf: Readonly<{ iso: string; line: string }>;
}>;

// ── Motion ──────────────────────────────────────────────────────────────────

export type MotionContext = Readonly<{
  /**
   * HOW REPLAY WORKS, and what it means for how you write motion.
   *
   * The picker's R key re-mounts the whole candidate subtree. Anything that
   * animates on mount therefore replays for free: a CSS entrance, a
   * `motion/react` `initial`/`animate` pair, a mount effect. Anything held in
   * client state that survives a re-mount does not replay, so entrance state
   * belongs in the markup, not in a store.
   *
   * There is no replay token to thread through. A server-rendered value cannot
   * change when a client key changes, and a token that looked like it could
   * would be the kind of quiet lie this programme exists to remove.
   */
  replaysOnRemount: true;
  /**
   * The estate's motion values, read from the CSS tokens rather than retyped.
   * `--ease-out` means two different curves in CSS and in JS in this
   * repository; a direction reads the CSS token and derives nothing.
   */
  durations: Readonly<{ fastMs: number; baseMs: number; slowMs: number }>;
  /** Routine transitions stay under this. */
  ceilingMs: number;
}>;

// ── The props, and the component ────────────────────────────────────────────

export type LabCandidateMeta = Readonly<{
  v: LabVariantNumber;
  slug: LabVariantSlug;
  /** The neutral review label. A direction never renders its own name. */
  label: string;
  /** True while a capture is running: no review chrome exists in the document. */
  capture: boolean;
}>;

export type HomeCandidateProps = Readonly<{
  meta: LabCandidateMeta;
  /** The parsed URL. Read-only; every link is already built for you. */
  state: LabUrlState;
  /** Which world is on screen, and what it exists to prove. */
  world: Readonly<{ id: ScenarioId; label: string; proves: string }>;
  chrome: HomeChrome;
  today: TodayView;
  inbox: InboxView;
  myWork: MyWorkView;
  analytics: AnalyticsView;
  briefing: BriefingView;
  /** Every shared label. Reach for this before writing a string. */
  copy: HomeCopy;
  motion: MotionContext;
  /** Build a link to another lab state. The only way a lab URL is written. */
  hrefFor: (patch: Partial<LabUrlState>) => string;
}>;

export type HomeCandidate = (props: HomeCandidateProps) => ReactNode;

// ── The shared copy dictionary ──────────────────────────────────────────────

/**
 * Labels a direction would otherwise invent. The row sentences are already
 * composed on the rows themselves; this is the furniture around them.
 */
export type HomeCopy = Readonly<{
  modeNames: Readonly<Record<HomeMode, string>>;
  sectionHeadings: Readonly<Record<TodaySectionId, string>>;
  myWorkGroupHeadings: Readonly<Record<MyWorkGroup, string>>;
  actions: Readonly<{
    openBriefing: string;
    backToToday: string;
    openEvent: string;
    markRead: string;
    snooze: string;
    clear: string;
    approve: string;
    retry: string;
    openSource: string;
    complete: string;
    reassign: string;
    openEvidence: string;
    openProject: string;
    changeScope: string;
    resetScope: string;
    closeLens: string;
    showMore: string;
  }>;
  states: Readonly<Record<HomeStateName, string>>;
  /** The one sentence each empty surface is allowed to say. */
  empty: Readonly<{
    today: string;
    inbox: string;
    myWork: string;
    analytics: string;
  }>;
  /** Never rendered as a number. Used wherever a count could not be read. */
  unreadableCount: string;
  noBaseline: string;
}>;

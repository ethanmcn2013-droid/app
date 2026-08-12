/**
 * Home fixture universe · the reference derivations.
 *
 * WHAT THIS IS. Every number the fixture universe publishes is computed here,
 * from the records, at read time. Nothing is typed by hand. A fixture that
 * asserts "three items, two capped" without being able to derive it from its
 * own rows is exactly the failure mode this programme exists to prevent —
 * a plausible number is the most expensive thing a review surface can render.
 *
 * WHAT THIS IS NOT. This is not the product's ranking engine. Wave 5 owns
 * `src/lib/home-layer/today/engine.ts` and its `rankToday`. This module is a
 * READABLE REFERENCE implementation of `TODAY_RANKING.md` §4 to §6 and §9.2,
 * whose only job is to make the fixture's expectations derivable before that
 * engine exists. When the engine lands, `engine-parity.test.ts` binds the two
 * and one of them is deleted. Two ranking implementations that both ship
 * would be `CONTENT_OWNERSHIP.md` DUP-4 all over again.
 */

import { calendarDaysBetween, type CalendarDate } from "@/lib/planning/dates";
import {
  fixtureCalendarDate,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "./clock";
import { sourceKey, type SourceRef } from "./source-ref";
import type { WorkSignal } from "./today";

// ── §4.1 version ────────────────────────────────────────────────────────────

export const HOME_TODAY_RANKING_VERSION = "home-today-ranking@1.0.0";

// ── §4.2 triggers ───────────────────────────────────────────────────────────

export type TriggerKind =
  | "due-soon"
  | "crowded-week"
  | "stuck-work"
  | "blocked-too-long"
  | "overload"
  | "blocker-cleared"
  | "doing-empty"
  | "just-shipped";

export const TRIGGER_WEIGHTS: Readonly<Record<TriggerKind, number>> =
  Object.freeze({
    "due-soon": 1000,
    "crowded-week": 800,
    "stuck-work": 700,
    "blocked-too-long": 600,
    "overload": 500,
    "blocker-cleared": 450,
    "doing-empty": 300,
    "just-shipped": 100,
  });

export const TRIGGER_KINDS: readonly TriggerKind[] = Object.freeze(
  Object.keys(TRIGGER_WEIGHTS).sort() as TriggerKind[],
);

// ── §5 sections ─────────────────────────────────────────────────────────────

export type SectionName = "todaysSignal" | "comingUp" | "needsReview" | "movingWell";

export const SECTION_LIMITS: Readonly<
  Record<SectionName, { cap: number; impliesCompleteness: boolean; sourceRoute: string }>
> = Object.freeze({
  todaysSignal: { cap: 3, impliesCompleteness: false, sourceRoute: "/app/home/briefing" },
  comingUp: { cap: 4, impliesCompleteness: false, sourceRoute: "/app/home/my-work" },
  needsReview: { cap: 3, impliesCompleteness: false, sourceRoute: "/app/home/my-work" },
  movingWell: { cap: 3, impliesCompleteness: false, sourceRoute: "/app/home/briefing" },
});

/** Coming up looks 14 calendar days ahead, and the surface states the window. */
export const COMING_UP_HORIZON_DAYS = 14;

// ── §8 stability ────────────────────────────────────────────────────────────

export const STABILITY_POLICY = Object.freeze({
  freezeForViewLifetime: true,
  reorderTrigger: "explicit-user-refresh",
  pollIntervalMs: null,
  conditionsOnFocusOrHover: false,
  staleResultAnnouncement: "updates-available",
  rowIdentity: "sourceKey",
  reducedMotionDropsAnnouncement: false,
} as const);

// ── Candidates ──────────────────────────────────────────────────────────────

/**
 * Why a row is on screen. Either a trigger fired, or the row is part of a
 * capped ranked VIEW that crossed no rule — the two are different claims and
 * §5 forbids a view from being rendered as `inventory`.
 */
export type RowOrigin = TriggerKind | "in-review-lane" | "dated-in-horizon";

export type Candidate = Readonly<{
  origin: RowOrigin;
  /** Set only when a real trigger fired. Null for a view row. */
  trigger: TriggerKind | null;
  severity: number;
  /** Null for a synthetic row. Synthetics are readings, not objects. */
  ref: SourceRef | null;
  /** For synthetics: the objects the reading was taken from. */
  members: readonly SourceRef[];
  title: string;
  /** §9.1: names the RULE that fired, never a score. */
  reason: string;
  dueAtIso: string | null;
  idleDays: number;
  recencyIso: string | null;
}>;

const isOpen = (signal: WorkSignal) => signal.lane !== "shipped";

function isBlocked(
  signal: WorkSignal,
  doneKeys: ReadonlySet<string>,
): boolean {
  return (
    signal.blockedBy.length > 0 &&
    signal.blockedBy.some((blocker) => !doneKeys.has(sourceKey(blocker)))
  );
}

function dueDateOf(signal: WorkSignal): CalendarDate | null {
  return signal.dueAtIso ? fixtureCalendarDate(signal.dueAtIso) : null;
}

function daysOutOf(signal: WorkSignal, today: CalendarDate): number | null {
  const due = dueDateOf(signal);
  return due ? calendarDaysBetween(today, due) : null;
}

/**
 * §4.2, every trigger, in the contract's own terms. `today` is the pinned
 * calendar date — no function in this module reads a clock.
 */
export function detectCandidates(
  signals: readonly WorkSignal[],
  today: CalendarDate = HOME_FIXTURE_TODAY,
  asOfMs: number = Date.parse(HOME_FIXTURE_NOW_ISO),
): readonly Candidate[] {
  const doneKeys = new Set(
    signals.filter((s) => !isOpen(s)).map((s) => sourceKey(s.ref)),
  );
  const live = signals.filter((s) => !s.dismissedByReader);
  const out: Candidate[] = [];

  for (const signal of live) {
    const daysOut = daysOutOf(signal, today);
    const blocked = isBlocked(signal, doneKeys);

    if (isOpen(signal) && daysOut !== null && daysOut <= 2) {
      const overdueDays = daysOut < 0 ? -daysOut : 0;
      const severity =
        daysOut < 0
          ? 80 + Math.min(20, overdueDays * 2)
          : 60 + Math.max(0, (2 - daysOut) * 8);
      out.push({
        origin: "due-soon",
        trigger: "due-soon",
        severity,
        ref: signal.ref,
        members: [],
        title: signal.title,
        reason:
          daysOut < 0
            ? `Signal flags anything past its due date. This is ${overdueDays} ${overdueDays === 1 ? "day" : "days"} past.`
            : daysOut === 0
              ? "Signal flags anything due today."
              : `Signal flags anything due within two days. This is due in ${daysOut} ${daysOut === 1 ? "day" : "days"}.`,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: signal.dueAtIso,
      });
    }

    if (isOpen(signal) && signal.idleDays >= 3 && !blocked) {
      out.push({
        origin: "stuck-work",
        trigger: "stuck-work",
        severity: Math.min(100, signal.idleDays * 4 + (3 - signal.priority) * 6),
        ref: signal.ref,
        members: [],
        title: signal.title,
        reason: `Signal flags anything quiet for three days or more. This has been quiet for ${signal.idleDays}.`,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    if (isOpen(signal) && blocked && signal.idleDays >= 5) {
      out.push({
        origin: "blocked-too-long",
        trigger: "blocked-too-long",
        severity: Math.min(
          90,
          30 + signal.idleDays * 3 + signal.blockedBy.length * 4,
        ),
        ref: signal.ref,
        members: [...signal.blockedBy],
        title: signal.title,
        reason: `Signal flags anything blocked for five days or more. This has waited ${signal.idleDays}.`,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    if (
      isOpen(signal) &&
      signal.blockedBy.length > 0 &&
      signal.blockedBy.every((blocker) => doneKeys.has(sourceKey(blocker)))
    ) {
      out.push({
        origin: "blocker-cleared",
        trigger: "blocker-cleared",
        severity: 45 + Math.min(20, signal.blockedBy.length * 5),
        ref: signal.ref,
        members: [...signal.blockedBy],
        title: signal.title,
        reason:
          "Signal says so when everything an item was waiting on is finished.",
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    if (signal.movedToDoneAtIso !== null) {
      // §8 ST2: measured from the ONE pinned instant, never from a clock
      // and never from a synthesised end-of-day.
      const hoursAgo =
        (asOfMs - Date.parse(signal.movedToDoneAtIso)) / 3_600_000;
      if (hoursAgo >= 0 && hoursAgo <= 24) {
        out.push({
          origin: "just-shipped",
        trigger: "just-shipped",
          severity: 40 + (3 - signal.priority) * 5,
          ref: signal.ref,
          members: [],
          title: signal.title,
          reason: "Finished in the last day.",
          dueAtIso: signal.dueAtIso,
          idleDays: signal.idleDays,
          recencyIso: signal.movedToDoneAtIso,
        });
      }
    }
  }

  // — synthetics: readings OF objects, never objects ——————————————
  const cluster = largestDatedCluster(live, today);
  if (cluster.length >= 3) {
    out.push({
      origin: "crowded-week",
        trigger: "crowded-week",
      severity: 55 + Math.min(30, cluster.length * 4),
      ref: null,
      members: cluster.map((s) => s.ref),
      title: `${cluster.length} dated items fall in the same week`,
      reason:
        "Signal says so when three or more dated items land inside one seven-day stretch.",
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  const busy = live.filter(
    (s) => s.lane === "in-flight" || s.lane === "review",
  );
  if (busy.length > 5) {
    out.push({
      origin: "overload",
        trigger: "overload",
      severity: 50 + (busy.length - 5) * 4,
      ref: null,
      members: busy.map((s) => s.ref),
      title: `${busy.length} items are open at once`,
      reason:
        "Signal says so when more than five items are in progress or in review together.",
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  const assignedNext = live.filter(
    (s) => s.assignedToActor && s.lane === "next",
  );
  const assignedInFlight = live.filter(
    (s) => s.assignedToActor && s.lane === "in-flight",
  );
  if (assignedNext.length >= 5 && assignedInFlight.length === 0) {
    out.push({
      origin: "doing-empty",
        trigger: "doing-empty",
      severity: 35,
      ref: null,
      members: assignedNext.map((s) => s.ref),
      title: "Nothing is in progress",
      reason:
        "Signal says so when five or more items are waiting to start and none has been started.",
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  return Object.freeze(out);
}

/**
 * The largest set of open dated objects that fits inside one seven-day
 * window. Computed, not asserted, because the cluster size is the trigger's
 * severity input.
 */
function largestDatedCluster(
  signals: readonly WorkSignal[],
  today: CalendarDate,
): readonly WorkSignal[] {
  const dated = signals
    .filter((s) => isOpen(s) && s.dueAtIso !== null)
    .map((s) => ({ signal: s, day: daysOutOf(s, today) as number }))
    .sort((a, b) => a.day - b.day);
  let best: WorkSignal[] = [];
  for (const start of dated) {
    const window = dated.filter(
      (entry) => entry.day >= start.day && entry.day <= start.day + 6,
    );
    if (window.length > best.length) best = window.map((entry) => entry.signal);
  }
  return best;
}

// ── §4.3 ordering ───────────────────────────────────────────────────────────

export const focusWeight = (candidate: Candidate): number =>
  (candidate.trigger ? TRIGGER_WEIGHTS[candidate.trigger] : 0) +
  candidate.severity;

/**
 * A TOTAL ORDER. A comparator that can return 0 for two distinct objects is
 * prohibited, and relying on `Array.prototype.sort` stability to break a tie
 * is prohibited — it makes the rendered order a function of database row
 * order. Synthetics have no `ref`, so they tie-break on their trigger name,
 * which is unique among synthetics in one pass.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  const byFocus = focusWeight(b) - focusWeight(a);
  if (byFocus !== 0) return byFocus;
  const bySeverity = b.severity - a.severity;
  if (bySeverity !== 0) return bySeverity;
  const byTrigger = a.origin.localeCompare(b.origin);
  if (byTrigger !== 0) return byTrigger;
  const keyA = a.ref ? sourceKey(a.ref) : `synthetic:${a.origin}`;
  const keyB = b.ref ? sourceKey(b.ref) : `synthetic:${b.origin}`;
  return keyA.localeCompare(keyB);
}

/** §4.4 — exactly one candidate survives per `sourceKey`; highest wins. */
function bestByObject(candidates: readonly Candidate[]): readonly Candidate[] {
  const best = new Map<string, Candidate>();
  const synthetics: Candidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.ref) {
      synthetics.push(candidate);
      continue;
    }
    const key = sourceKey(candidate.ref);
    const held = best.get(key);
    if (!held || compareCandidates(candidate, held) < 0) best.set(key, candidate);
  }
  return [...best.values(), ...synthetics];
}

// ── §5 + §6 the result ──────────────────────────────────────────────────────

export type RankedRow = Candidate & { section: SectionName };

export type TodayAccounting = Readonly<{
  read: number;
  shown: number;
  cappedOut: number;
  dismissed: number;
  cleared: number;
}>;

export type QuietCondition =
  | "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8" | "Q9";

/**
 * §5 Completeness, per section. A capped view renders "the count it did not
 * show", and after §5's precedence rule that count has two causes which are
 * different facts about the same object: the cap displaced it, or a
 * higher-precedence section is already showing it. Both are held, because
 * "two more are not shown" and "two more are shown above" are not the same
 * sentence and a reviewer can tell them apart.
 */
export type SectionAccounting = Readonly<{
  /** Distinct objects this section's pool held, before precedence and cap. */
  eligible: number;
  /** Rows rendered here. */
  shown: number;
  /** Objects a higher-precedence section rendered. Removed here, never lost. */
  claimedAbove: number;
  /** Objects this section's own cap displaced. */
  cappedOut: number;
  /** `eligible - shown`. What the section did not show, however it happened. */
  suppressed: number;
}>;

export type TodayResult = Readonly<{
  version: string;
  asOfIso: string;
  sections: Readonly<Record<SectionName, readonly RankedRow[]>>;
  /** §5 — what each section held back, and why. */
  sectionAccounting: Readonly<Record<SectionName, SectionAccounting>>;
  /** Null whenever ANY term is unknown. Never partially rendered. */
  accounting: TodayAccounting | null;
  quiet: Readonly<{ allowed: boolean; blockedBy: readonly QuietCondition[] }>;
}>;

export type CoverageInput = Readonly<{
  /** Any provider not `ready` fires Q1. */
  providerStatuses: readonly string[];
  /** Any Project in Read Scope that failed to resolve fires Q6. */
  projectsUnresolved: number;
  /** An eligible kind with no producer fires Q7. Always true in V1. */
  unsupportedKinds: readonly string[];
  /** Analytics history is empty because nothing writes snapshots. Q8. */
  historyIsEmpty: boolean;
  /** The scope resolved to zero Projects, or resolved non-deterministically. Q9. */
  scopeProjectCount: number;
  /** Set when a term of the §6 identity could not be computed. Q2. */
  accountingComputable: boolean;
}>;

const EMPTY_SECTION_ACCOUNTING: SectionAccounting = Object.freeze({
  eligible: 0,
  shown: 0,
  claimedAbove: 0,
  cappedOut: 0,
  suppressed: 0,
});

export function rankToday(input: {
  candidates: readonly WorkSignal[];
  asOfIso: string;
  today?: CalendarDate;
  coverage: CoverageInput;
  limit?: "today" | "all";
}): TodayResult {
  const today = input.today ?? HOME_FIXTURE_TODAY;
  const asOfMs = Date.parse(input.asOfIso);
  const detected = bestByObject(
    detectCandidates(input.candidates, today, asOfMs),
  );
  const lift = input.limit === "all";

  const inSignal = new Set<TriggerKind>([
    "due-soon",
    "overload",
    "crowded-week",
    "stuck-work",
    "blocked-too-long",
    "doing-empty",
  ]);
  const inMovingWell = new Set<TriggerKind>(["just-shipped", "blocker-cleared"]);

  /**
   * §5 disjointness AND §5 precedence. A `sourceKey` is claimed by the
   * section that RENDERS it, not by the pool that considered it. Claiming on
   * consideration would mean a row displaced by Today's three-cap could never
   * appear in Needs review, which would report it as `cappedOut` while it sat
   * visible on the page — §6's identity would then be arithmetically true and
   * factually false.
   *
   * Precedence is the order `take` is CALLED in, and §5 now states it:
   * Today's signal, then Needs review, then Coming up, then Moving well. A
   * key a higher section rendered is removed here and counted in this
   * section's suppressed total, never silently dropped.
   */
  const claimed = new Set<string>();
  const sectionAccounting: Record<SectionName, SectionAccounting> = {
    todaysSignal: EMPTY_SECTION_ACCOUNTING,
    comingUp: EMPTY_SECTION_ACCOUNTING,
    needsReview: EMPTY_SECTION_ACCOUNTING,
    movingWell: EMPTY_SECTION_ACCOUNTING,
  };
  const take = (
    pool: readonly Candidate[],
    section: SectionName,
  ): readonly RankedRow[] => {
    const cap = lift ? Number.POSITIVE_INFINITY : SECTION_LIMITS[section].cap;
    const rows: RankedRow[] = [];
    const seen = new Set<string>();
    let eligible = 0;
    let claimedAbove = 0;
    for (const candidate of pool) {
      const key = candidate.ref ? sourceKey(candidate.ref) : null;
      // One object may reach a pool twice — a `blocked-too-long` row is also
      // a review-lane row. It is one object, so it counts once.
      if (key !== null) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      eligible += 1;
      if (key !== null && claimed.has(key)) {
        claimedAbove += 1;
        continue;
      }
      if (rows.length >= cap) continue;
      if (key !== null) claimed.add(key);
      rows.push(Object.freeze({ ...candidate, section }));
    }
    sectionAccounting[section] = Object.freeze({
      eligible,
      shown: rows.length,
      claimedAbove,
      cappedOut: eligible - rows.length - claimedAbove,
      suppressed: eligible - rows.length,
    });
    return Object.freeze(rows);
  };

  const signalPool = detected
    .filter((c) => c.trigger !== null && inSignal.has(c.trigger))
    .sort(compareCandidates);

  const movingWellPool = detected
    .filter((c) => c.trigger !== null && inMovingWell.has(c.trigger))
    .sort((a, b) => {
      const byRecency =
        Date.parse(b.recencyIso ?? "1970-01-01T00:00:00.000Z") -
        Date.parse(a.recencyIso ?? "1970-01-01T00:00:00.000Z");
      return byRecency !== 0 ? byRecency : compareCandidates(a, b);
    });

  const flaggedKeys = new Set(
    detected.filter((c) => c.ref).map((c) => sourceKey(c.ref as SourceRef)),
  );

  /**
   * Needs review: objects in engine lane `review`, plus any `blocked-too-long`
   * candidate that did not get a slot above. Ordered by idle days descending,
   * then by the §4.3 comparator.
   */
  const reviewPool: Candidate[] = [
    ...detected.filter((c) => c.trigger === "blocked-too-long"),
    // A review-lane object belongs here whether or not a trigger fired on it.
    // When one did, its candidate is reused so the row keeps the real reason
    // rather than gaining a second, weaker explanation for the same fact.
    ...input.candidates
      .filter((s) => s.lane === "review" && !s.dismissedByReader)
      .map<Candidate>((s) => {
        const alreadyDetected = detected.find(
          (c) => c.ref !== null && sourceKey(c.ref) === sourceKey(s.ref),
        );
        return (
          alreadyDetected ??
          Object.freeze({
            origin: "in-review-lane" as const,
            trigger: null,
            severity: 0,
            ref: s.ref,
            members: Object.freeze([]),
            title: s.title,
            reason: "In review, and nobody has moved it on.",
            dueAtIso: s.dueAtIso,
            idleDays: s.idleDays,
            recencyIso: null,
          })
        );
      }),
  ].sort((a, b) => b.idleDays - a.idleDays || compareCandidates(a, b));

  /**
   * Coming up: dated, open, inside the fourteen-day horizon, crossed no rule.
   * A capped ranked VIEW, never inventory, and it states its own window.
   */
  const comingPool: Candidate[] = input.candidates
    .filter((s) => {
      if (s.dismissedByReader || s.lane === "shipped" || !s.dueAtIso) return false;
      if (flaggedKeys.has(sourceKey(s.ref))) return false;
      const daysOut = daysOutOf(s, today);
      return daysOut !== null && daysOut > 2 && daysOut <= COMING_UP_HORIZON_DAYS;
    })
    .map<Candidate>((s) => {
      const daysOut = daysOutOf(s, today) as number;
      return Object.freeze({
        origin: "dated-in-horizon" as const,
        trigger: null,
        severity: 0,
        ref: s.ref,
        members: Object.freeze([]),
        title: s.title,
        reason: `Due in ${daysOut} days.`,
        dueAtIso: s.dueAtIso,
        idleDays: s.idleDays,
        recencyIso: s.dueAtIso,
      });
    })
    .sort(
      (a, b) =>
        Date.parse(a.dueAtIso as string) - Date.parse(b.dueAtIso as string) ||
        compareCandidates(a, b),
    );

  // §5 precedence, in order. The most urgent job wins a contested key.
  const todaysSignal = take(signalPool, "todaysSignal");
  const needsReview = take(reviewPool, "needsReview");
  const comingUp = take(comingPool, "comingUp");
  const movingWell = take(movingWellPool, "movingWell");

  const sections = Object.freeze({
    todaysSignal,
    comingUp,
    needsReview,
    movingWell,
  });

  // — §6 the read accounting ————————————————————————————————————
  const read = input.candidates.length;
  const dismissedCount = input.candidates.filter(
    (s) =>
      s.dismissedByReader && crossedARule(s, input.candidates, today, asOfMs),
  ).length;
  const flagged = flaggedKeys.size;
  const shownKeys = new Set<string>();
  for (const row of Object.values(sections).flat()) {
    if (row.ref && flaggedKeys.has(sourceKey(row.ref))) {
      shownKeys.add(sourceKey(row.ref));
    }
    for (const member of row.members) {
      if (flaggedKeys.has(sourceKey(member))) shownKeys.add(sourceKey(member));
    }
  }
  const shown = shownKeys.size;
  const cappedOut = flagged - shown;
  const cleared = read - flagged - dismissedCount;

  const accounting: TodayAccounting | null = input.coverage.accountingComputable
    ? Object.freeze({
        read,
        shown,
        cappedOut,
        dismissed: dismissedCount,
        cleared,
      })
    : null;

  // — §9.2 quiet, and every condition that forbids it ———————————
  const blockedBy: QuietCondition[] = [];
  if (input.coverage.providerStatuses.some((status) => status !== "ready"))
    blockedBy.push("Q1");
  if (!accounting || !accountingBalances(accounting)) blockedBy.push("Q2");
  if (flagged > 0) blockedBy.push("Q3");
  if (accounting && accounting.cappedOut > 0) blockedBy.push("Q4");
  if (dismissedCount > 0) blockedBy.push("Q5");
  if (input.coverage.projectsUnresolved > 0) blockedBy.push("Q6");
  if (input.coverage.unsupportedKinds.length > 0) blockedBy.push("Q7");
  if (input.coverage.historyIsEmpty) blockedBy.push("Q8");
  if (input.coverage.scopeProjectCount === 0) blockedBy.push("Q9");

  return Object.freeze({
    version: HOME_TODAY_RANKING_VERSION,
    asOfIso: input.asOfIso,
    sections,
    sectionAccounting: Object.freeze(sectionAccounting),
    accounting,
    quiet: Object.freeze({
      allowed: blockedBy.length === 0,
      blockedBy: Object.freeze(blockedBy),
    }),
  });
}

function crossedARule(
  signal: WorkSignal,
  all: readonly WorkSignal[],
  today: CalendarDate,
  asOfMs: number,
): boolean {
  const asIfLive = all.map((s) =>
    s === signal ? { ...s, dismissedByReader: false } : s,
  );
  return detectCandidates(asIfLive, today, asOfMs).some(
    (candidate) =>
      candidate.ref && sourceKey(candidate.ref) === sourceKey(signal.ref),
  );
}

/** The identity that must hold exactly. A reader who subtracts lands true. */
export function accountingBalances(accounting: TodayAccounting | null): boolean {
  if (!accounting) return false;
  return (
    accounting.read ===
    accounting.shown +
      accounting.cappedOut +
      accounting.dismissed +
      accounting.cleared
  );
}

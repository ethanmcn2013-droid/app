/**
 * Golden oracle · Today ranking order, sections and the read accounting.
 *
 * WRITTEN FROM `contracts/TODAY_RANKING.md` §4.2, §4.3, §4.4, §5, §6 and
 * §9.2 — deliberately NOT from `src/lib/home-layer/fixtures/derive.ts`, which
 * is the reference implementation this oracle exists to certify. Every
 * threshold, weight, cap, horizon and tie-break below was transcribed from the
 * contract's own tables. Where the contract and `derive.ts` are read to differ,
 * the difference is a finding, not something to be reconciled here.
 *
 * WHAT IT MAY IMPORT. Raw records only: the `WorkSignal` rows and the pinned
 * clock constants. It imports no ranking function, no section builder, no
 * accounting function and no `homeFixtureWorld`. `independence.ts` enforces
 * that mechanically by reading this file's own import statements.
 */

import {
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "../fixtures/clock";
import type { SourceRef } from "../fixtures/source-ref";
import type { WorkSignal } from "../fixtures/today";
import { daysBetween, hoursBetween, zonedCalendarDate, ORACLE_ZONE, type OracleDate } from "./oracle-clock";

// ── §4.2 the eight triggers, transcribed from the contract table ────────────

export type OracleTrigger =
  | "due-soon"
  | "crowded-week"
  | "stuck-work"
  | "blocked-too-long"
  | "overload"
  | "blocker-cleared"
  | "doing-empty"
  | "just-shipped";

/** §4.2 "Weight" column. */
export const ORACLE_TRIGGER_WEIGHTS: Readonly<Record<OracleTrigger, number>> =
  Object.freeze({
    "due-soon": 1000,
    "crowded-week": 800,
    "stuck-work": 700,
    "blocked-too-long": 600,
    overload: 500,
    "blocker-cleared": 450,
    "doing-empty": 300,
    "just-shipped": 100,
  });

/** §5 "Cap" column. */
export const ORACLE_SECTION_CAPS = Object.freeze({
  todaysSignal: 3,
  comingUp: 4,
  needsReview: 3,
  movingWell: 3,
});

export type OracleSection = keyof typeof ORACLE_SECTION_CAPS;

/** §5 "Horizon": Coming up looks fourteen calendar days ahead. */
export const ORACLE_COMING_UP_HORIZON_DAYS = 14;

/**
 * §4.3 step 4 — `sourceKey` is `${product}:${kind}:${id}`. Written out here
 * rather than imported so a change to the estate's helper cannot silently
 * change what this oracle believes identity is.
 */
export function oracleKey(ref: SourceRef): string {
  return `${ref.product}:${ref.kind}:${ref.id}`;
}

/**
 * Why a row is on screen. Either a trigger fired, or the row belongs to a
 * capped ranked VIEW that crossed no rule — §5 keeps those two claims apart,
 * and §6 must never count a view row as a flagged object.
 */
export type OracleOrigin = OracleTrigger | "in-review-lane" | "dated-in-horizon";

export type OracleCandidate = Readonly<{
  origin: OracleOrigin;
  /** Null on a view row. Only a real trigger carries §4.2 weight. */
  trigger: OracleTrigger | null;
  severity: number;
  /** Null for the three synthetic readings, which are not objects (§4.4). */
  key: string | null;
  /** For a synthetic: the object keys the reading was taken from. */
  memberKeys: readonly string[];
  title: string;
  dueAtIso: string | null;
  idleDays: number;
  recencyIso: string | null;
}>;

const isOpen = (signal: WorkSignal): boolean => signal.lane !== "shipped";

function dueDayOffset(signal: WorkSignal, today: OracleDate): number | null {
  if (signal.dueAtIso === null) return null;
  return daysBetween(today, zonedCalendarDate(signal.dueAtIso, ORACLE_ZONE));
}

function isBlocked(signal: WorkSignal, doneKeys: ReadonlySet<string>): boolean {
  return (
    signal.blockedBy.length > 0 &&
    signal.blockedBy.some((blocker) => !doneKeys.has(oracleKey(blocker)))
  );
}

/**
 * §4.2, every row of the table, in the contract's own arithmetic. Dismissed
 * objects are excluded here and accounted for separately in §6 — the whole
 * point of Correction 1.
 */
export function oracleDetect(
  signals: readonly WorkSignal[],
  today: OracleDate,
  asOfIso: string,
): readonly OracleCandidate[] {
  const doneKeys = new Set(
    signals.filter((signal) => !isOpen(signal)).map((signal) => oracleKey(signal.ref)),
  );
  const live = signals.filter((signal) => !signal.dismissedByReader);
  const found: OracleCandidate[] = [];

  for (const signal of live) {
    const key = oracleKey(signal.ref);
    const daysOut = dueDayOffset(signal, today);
    const blocked = isBlocked(signal, doneKeys);
    const open = isOpen(signal);

    // due-soon · open, due <= 2 days out, or overdue.
    if (open && daysOut !== null && daysOut <= 2) {
      const overdueDays = daysOut < 0 ? -daysOut : 0;
      found.push({
        origin: "due-soon",
        trigger: "due-soon",
        severity:
          daysOut < 0
            ? 80 + Math.min(20, overdueDays * 2)
            : 60 + Math.max(0, (2 - daysOut) * 8),
        key,
        memberKeys: [],
        title: signal.title,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: signal.dueAtIso,
      });
    }

    // stuck-work · open, idle >= 3 days, not blocked.
    if (open && signal.idleDays >= 3 && !blocked) {
      found.push({
        origin: "stuck-work",
        trigger: "stuck-work",
        severity: Math.min(100, signal.idleDays * 4 + (3 - signal.priority) * 6),
        key,
        memberKeys: [],
        title: signal.title,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    // blocked-too-long · open, blocked, idle >= 5 days.
    if (open && blocked && signal.idleDays >= 5) {
      found.push({
        origin: "blocked-too-long",
        trigger: "blocked-too-long",
        severity: Math.min(
          90,
          30 + signal.idleDays * 3 + signal.blockedBy.length * 4,
        ),
        key,
        memberKeys: signal.blockedBy.map(oracleKey),
        title: signal.title,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    // blocker-cleared · open, has blockers, every one of them now done.
    if (
      open &&
      signal.blockedBy.length > 0 &&
      signal.blockedBy.every((blocker) => doneKeys.has(oracleKey(blocker)))
    ) {
      found.push({
        origin: "blocker-cleared",
        trigger: "blocker-cleared",
        severity: 45 + Math.min(20, signal.blockedBy.length * 5),
        key,
        memberKeys: signal.blockedBy.map(oracleKey),
        title: signal.title,
        dueAtIso: signal.dueAtIso,
        idleDays: signal.idleDays,
        recencyIso: null,
      });
    }

    // just-shipped · moved to done within 24 hours of the pinned instant.
    if (signal.movedToDoneAtIso !== null) {
      const ago = hoursBetween(signal.movedToDoneAtIso, asOfIso);
      if (ago >= 0 && ago <= 24) {
        found.push({
          origin: "just-shipped",
          trigger: "just-shipped",
          severity: 40 + (3 - signal.priority) * 5,
          key,
          memberKeys: [],
          title: signal.title,
          dueAtIso: signal.dueAtIso,
          idleDays: signal.idleDays,
          recencyIso: signal.movedToDoneAtIso,
        });
      }
    }
  }

  // crowded-week · >= 3 open dated objects inside one seven-day window. ONE
  // synthetic row for the cluster, never one per object (§4.4).
  const cluster = largestSevenDayCluster(live, today);
  if (cluster.length >= 3) {
    found.push({
      origin: "crowded-week",
      trigger: "crowded-week",
      severity: 55 + Math.min(30, cluster.length * 4),
      key: null,
      memberKeys: cluster.map((signal) => oracleKey(signal.ref)),
      title: `${cluster.length} dated items fall in the same week`,
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  // overload · more than five objects in in-flight + review together.
  const busy = live.filter(
    (signal) => signal.lane === "in-flight" || signal.lane === "review",
  );
  if (busy.length > 5) {
    found.push({
      origin: "overload",
      trigger: "overload",
      severity: 50 + (busy.length - 5) * 4,
      key: null,
      memberKeys: busy.map((signal) => oracleKey(signal.ref)),
      title: `${busy.length} items are open at once`,
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  // doing-empty · >= 5 assigned in `next` and exactly 0 in `in-flight`.
  const assignedNext = live.filter(
    (signal) => signal.assignedToActor && signal.lane === "next",
  );
  const assignedInFlight = live.filter(
    (signal) => signal.assignedToActor && signal.lane === "in-flight",
  );
  if (assignedNext.length >= 5 && assignedInFlight.length === 0) {
    found.push({
      origin: "doing-empty",
      trigger: "doing-empty",
      severity: 35,
      key: null,
      memberKeys: assignedNext.map((signal) => oracleKey(signal.ref)),
      title: "Nothing is in progress",
      dueAtIso: null,
      idleDays: 0,
      recencyIso: null,
    });
  }

  return Object.freeze(found);
}

function largestSevenDayCluster(
  signals: readonly WorkSignal[],
  today: OracleDate,
): readonly WorkSignal[] {
  const dated = signals
    .filter((signal) => isOpen(signal) && signal.dueAtIso !== null)
    .map((signal) => ({ signal, day: dueDayOffset(signal, today) as number }))
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

export const oracleFocusWeight = (candidate: OracleCandidate): number =>
  (candidate.trigger === null ? 0 : ORACLE_TRIGGER_WEIGHTS[candidate.trigger]) +
  candidate.severity;

/**
 * §4.3, the four steps. A TOTAL ORDER: it may never return 0 for two distinct
 * candidates, so the synthetic fallback key is the origin name, which is
 * unique among synthetics in one pass.
 */
export function oracleCompare(a: OracleCandidate, b: OracleCandidate): number {
  const byFocus = oracleFocusWeight(b) - oracleFocusWeight(a);
  if (byFocus !== 0) return byFocus;
  const bySeverity = b.severity - a.severity;
  if (bySeverity !== 0) return bySeverity;
  const byTrigger = a.origin.localeCompare(b.origin);
  if (byTrigger !== 0) return byTrigger;
  return (a.key ?? `synthetic:${a.origin}`).localeCompare(
    b.key ?? `synthetic:${b.origin}`,
  );
}

/** §4.4 — exactly one candidate survives per object; the highest wins. */
export function oracleBestPerObject(
  candidates: readonly OracleCandidate[],
): readonly OracleCandidate[] {
  const best = new Map<string, OracleCandidate>();
  const synthetics: OracleCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.key === null) {
      synthetics.push(candidate);
      continue;
    }
    const held = best.get(candidate.key);
    if (!held || oracleCompare(candidate, held) < 0) best.set(candidate.key, candidate);
  }
  return Object.freeze([...best.values(), ...synthetics]);
}

// ── §5 sections ─────────────────────────────────────────────────────────────

/** §5 "Eligible triggers" column, Today's signal row. */
const SIGNAL_TRIGGERS: ReadonlySet<OracleTrigger> = new Set<OracleTrigger>([
  "due-soon",
  "overload",
  "crowded-week",
  "stuck-work",
  "blocked-too-long",
  "doing-empty",
]);

/** §5 "Eligible triggers" column, Moving well row. */
const MOVING_WELL_TRIGGERS: ReadonlySet<OracleTrigger> = new Set<OracleTrigger>([
  "just-shipped",
  "blocker-cleared",
]);

export type OracleRow = Readonly<{
  section: OracleSection;
  key: string | null;
  memberKeys: readonly string[];
  trigger: OracleTrigger | null;
  title: string;
}>;

export type OracleAccounting = Readonly<{
  read: number;
  flagged: number;
  shown: number;
  cappedOut: number;
  dismissed: number;
  cleared: number;
}>;

export type OracleQuiet =
  | "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8" | "Q9";

export type OracleCoverageInput = Readonly<{
  providerStatuses: readonly string[];
  projectsUnresolved: number;
  unsupportedKinds: readonly string[];
  historyIsEmpty: boolean;
  scopeProjectCount: number;
}>;

export type OracleTodayResult = Readonly<{
  sections: Readonly<Record<OracleSection, readonly OracleRow[]>>;
  accounting: OracleAccounting;
  /** Q-conditions that fired, in order. Empty means quiet language is legal. */
  quietBlockedBy: readonly OracleQuiet[];
  /** §6 identity. False is a hard defect, never a rounding matter. */
  balances: boolean;
  /**
   * True when a `sourceKey` was eligible for two section pools at once. §5
   * does not state a precedence between Coming up and Needs review, so a
   * fixture that depends on one is depending on an unspecified rule.
   */
  sectionOrderAmbiguity: readonly string[];
}>;

export function oracleRankToday(input: {
  candidates: readonly WorkSignal[];
  today: OracleDate;
  asOfIso: string;
  coverage: OracleCoverageInput;
  limit?: "today" | "all";
}): OracleTodayResult {
  const detected = oracleBestPerObject(
    oracleDetect(input.candidates, input.today, input.asOfIso),
  );
  const lifted = input.limit === "all";
  const flaggedKeys = new Set(
    detected.filter((c) => c.key !== null).map((c) => c.key as string),
  );

  const signalPool = detected
    .filter((c) => c.trigger !== null && SIGNAL_TRIGGERS.has(c.trigger))
    .sort(oracleCompare);

  const movingWellPool = detected
    .filter((c) => c.trigger !== null && MOVING_WELL_TRIGGERS.has(c.trigger))
    .sort((a, b) => {
      const byRecency =
        Date.parse(b.recencyIso ?? "1970-01-01T00:00:00.000Z") -
        Date.parse(a.recencyIso ?? "1970-01-01T00:00:00.000Z");
      return byRecency !== 0 ? byRecency : oracleCompare(a, b);
    });

  // Needs review: engine lane `review`, plus every `blocked-too-long`
  // candidate. Ordered by idle days descending, then §4.3.
  const reviewPool: OracleCandidate[] = [
    ...detected.filter((c) => c.trigger === "blocked-too-long"),
    ...input.candidates
      .filter((s) => s.lane === "review" && !s.dismissedByReader)
      .filter(
        (s) =>
          !detected.some(
            (c) => c.trigger === "blocked-too-long" && c.key === oracleKey(s.ref),
          ),
      )
      .map<OracleCandidate>((s) => ({
        // A review-lane object with no trigger is a VIEW row, not a flagged
        // object; §6 must not count it as `shown`.
        origin: "in-review-lane",
        trigger: null,
        severity: 0,
        key: oracleKey(s.ref),
        memberKeys: [],
        title: s.title,
        dueAtIso: s.dueAtIso,
        idleDays: s.idleDays,
        recencyIso: null,
      })),
  ].sort((a, b) => b.idleDays - a.idleDays || oracleCompare(a, b));

  // Coming up: dated, open, undismissed, 2 < daysOut <= 14, crossed no rule.
  const comingPool: OracleCandidate[] = input.candidates
    .filter((s) => {
      if (s.dismissedByReader || s.lane === "shipped" || s.dueAtIso === null) return false;
      if (flaggedKeys.has(oracleKey(s.ref))) return false;
      const daysOut = dueDayOffset(s, input.today);
      return (
        daysOut !== null && daysOut > 2 && daysOut <= ORACLE_COMING_UP_HORIZON_DAYS
      );
    })
    .map<OracleCandidate>((s) => ({
      origin: "dated-in-horizon",
      trigger: null,
      severity: 0,
      key: oracleKey(s.ref),
      memberKeys: [],
      title: s.title,
      dueAtIso: s.dueAtIso,
      idleDays: s.idleDays,
      recencyIso: s.dueAtIso,
    }))
    .sort(
      (a, b) =>
        Date.parse(a.dueAtIso as string) - Date.parse(b.dueAtIso as string) ||
        (a.key as string).localeCompare(b.key as string),
    );

  // §5 disjointness by `sourceKey`. The contract lists the sections in the
  // order below; a key claimed by an earlier section is skipped by a later
  // one. `sectionOrderAmbiguity` records any key that two pools both wanted,
  // because that would make the rendered page depend on an unstated rule.
  const wanted = new Map<string, Set<OracleSection>>();
  const note = (pool: readonly OracleCandidate[], section: OracleSection) => {
    for (const candidate of pool) {
      if (candidate.key === null) continue;
      const held = wanted.get(candidate.key) ?? new Set<OracleSection>();
      held.add(section);
      wanted.set(candidate.key, held);
    }
  };
  note(signalPool, "todaysSignal");
  note(comingPool, "comingUp");
  note(reviewPool, "needsReview");
  note(movingWellPool, "movingWell");
  const sectionOrderAmbiguity = [...wanted.entries()]
    .filter(([, sections]) => sections.size > 1)
    .map(([key, sections]) => `${key} → ${[...sections].sort().join(" + ")}`)
    .sort();

  const claimed = new Set<string>();
  const take = (
    pool: readonly OracleCandidate[],
    section: OracleSection,
  ): readonly OracleRow[] => {
    const cap = lifted ? Number.POSITIVE_INFINITY : ORACLE_SECTION_CAPS[section];
    const rows: OracleRow[] = [];
    for (const candidate of pool) {
      if (rows.length >= cap) break;
      if (candidate.key !== null) {
        if (claimed.has(candidate.key)) continue;
        claimed.add(candidate.key);
      }
      rows.push(
        Object.freeze({
          section,
          key: candidate.key,
          memberKeys: candidate.memberKeys,
          trigger: candidate.trigger,
          title: candidate.title,
        }),
      );
    }
    return Object.freeze(rows);
  };

  const sections = Object.freeze({
    todaysSignal: take(signalPool, "todaysSignal"),
    comingUp: take(comingPool, "comingUp"),
    needsReview: take(reviewPool, "needsReview"),
    movingWell: take(movingWellPool, "movingWell"),
  });

  // ── §6 the read accounting ───────────────────────────────────────────────
  const read = input.candidates.length;
  const flagged = flaggedKeys.size;

  // `shown` is "objects represented by the rows actually on screen". A
  // synthetic row represents its members (§4.4). Only FLAGGED objects can be
  // shown, because §6's identity forces `shown + cappedOut = flagged`.
  const shownKeys = new Set<string>();
  for (const row of Object.values(sections).flat()) {
    if (row.key !== null && flaggedKeys.has(row.key)) shownKeys.add(row.key);
    for (const member of row.memberKeys) {
      if (flaggedKeys.has(member)) shownKeys.add(member);
    }
  }
  const shown = shownKeys.size;
  const cappedOut = flagged - shown;
  const dismissed = input.candidates.filter(
    (signal) =>
      signal.dismissedByReader &&
      oracleWouldCrossARule(signal, input.candidates, input.today, input.asOfIso),
  ).length;
  const cleared = read - flagged - dismissed;

  const accounting: OracleAccounting = Object.freeze({
    read,
    flagged,
    shown,
    cappedOut,
    dismissed,
    cleared,
  });
  const balances = read === shown + cappedOut + dismissed + cleared;

  // ── §9.2 the nine conditions that forbid quiet language ──────────────────
  const blockedBy: OracleQuiet[] = [];
  if (input.coverage.providerStatuses.some((status) => status !== "ready"))
    blockedBy.push("Q1");
  if (!balances) blockedBy.push("Q2");
  if (flagged > 0) blockedBy.push("Q3");
  if (cappedOut > 0) blockedBy.push("Q4");
  if (dismissed > 0) blockedBy.push("Q5");
  if (input.coverage.projectsUnresolved > 0) blockedBy.push("Q6");
  if (input.coverage.unsupportedKinds.length > 0) blockedBy.push("Q7");
  if (input.coverage.historyIsEmpty) blockedBy.push("Q8");
  if (input.coverage.scopeProjectCount === 0) blockedBy.push("Q9");

  return Object.freeze({
    sections,
    accounting,
    quietBlockedBy: Object.freeze(blockedBy),
    balances,
    sectionOrderAmbiguity: Object.freeze(sectionOrderAmbiguity),
  });
}

/**
 * §6 `dismissed` — "objects that crossed a rule AND were suppressed by the
 * reader". Silence chosen is not absence, and an object the reader silenced
 * that crossed nothing is `cleared`, not `dismissed`. Recomputed by running
 * detection over a candidate set in which this one object is not silenced.
 */
export function oracleWouldCrossARule(
  signal: WorkSignal,
  all: readonly WorkSignal[],
  today: OracleDate,
  asOfIso: string,
): boolean {
  const key = oracleKey(signal.ref);
  const asIfLive = all.map((entry) =>
    entry === signal ? { ...entry, dismissedByReader: false } : entry,
  );
  return oracleDetect(asIfLive, today, asOfIso).some(
    (candidate) => candidate.key === key,
  );
}

/** The pinned inputs the ordinary owner worlds are ranked against. */
export const ORACLE_TODAY = HOME_FIXTURE_TODAY as OracleDate;
export const ORACLE_NOW_ISO = HOME_FIXTURE_NOW_ISO;

/**
 * Golden oracle · Analytics totals, claims and evidence.
 *
 * WRITTEN FROM `contracts/ANALYTICS_CLAIM.md` §1, §4, §5, §6, §7, §10, §12
 * and §13 — deliberately NOT from `src/lib/home-layer/fixtures/analytics.ts`'s
 * `deriveClaims` / `deriveLedger` / `deriveTrend` / `receiptFor`, which are the
 * derivations this oracle certifies.
 *
 * THE ONE RULE THAT GOVERNS EVERY ASSERTION HERE. §1: "a claim that cannot
 * fill a required field is not downgraded to a smaller number — it does not
 * render, and its absence is named", and "`value: null` never renders as `0`,
 * `—`, an empty chart, a grey dash that reads as zero, or a cleared state".
 * So this oracle checks two different things about every number: that the
 * arithmetic is right, AND that an absent number stayed absent.
 */

import type { AnalyticsClaim, AnalyticsRow } from "../fixtures/analytics";
import { daysBetween, zonedCalendarDate, ORACLE_ZONE, type OracleDate } from "./oracle-clock";

/** §13.1 — the seven V1 claim ids, in contract order. */
export const ORACLE_CLAIM_IDS: readonly string[] = Object.freeze([
  "claim-a1-open-work",
  "claim-a2-open-overdue",
  "claim-a3-unowned-work",
  "claim-b1-work-completed",
  "claim-c1-open-work-age",
  "claim-c2-stalled-work",
  "claim-d1-milestone-risk",
]);

/** §1 — the fifteen required envelope fields. Nothing renders without them. */
export const ORACLE_REQUIRED_CLAIM_FIELDS: readonly string[] = Object.freeze([
  "id",
  "metric",
  "definition",
  "truthClass",
  "scope",
  "window",
  "population",
  "baseline",
  "coverage",
  "times",
  "history",
  "permission",
  "provenance",
  "limitation",
  "correction",
]);

/** §10.5 / F7 — the one trend needs fourteen comparable daily readings. */
export const ORACLE_TREND_MINIMUM_SNAPSHOTS = 14;

/** The stalled threshold the C2 definition names in words. */
export const ORACLE_STALLED_AFTER_DAYS = 7;

/**
 * §4 / §6 — the population, recomputed. Subtasks and Unprojectable rows are
 * excluded and the exclusion is COUNTED (`PROJECT_SCOPE.md` §6, D-H05); a row
 * outside the authorized Project set was never in the population at all.
 */
export function oraclePopulation(
  rows: readonly AnalyticsRow[],
  projects: readonly string[],
): Readonly<{
  scoped: readonly AnalyticsRow[];
  included: readonly AnalyticsRow[];
  open: readonly AnalyticsRow[];
  excludedSubtask: number;
  excludedUnprojectable: number;
}> {
  const inProjects = new Set(projects);
  const scoped = rows.filter(
    (row) => row.workspaceId !== null && inProjects.has(row.workspaceId),
  );
  const included = scoped.filter((row) => !row.isSubtask && !row.unprojectable);
  return Object.freeze({
    scoped: Object.freeze(scoped),
    included: Object.freeze(included),
    open: Object.freeze(included.filter((row) => !row.isDone)),
    excludedSubtask: scoped.filter((row) => row.isSubtask).length,
    // `unprojectable` rows have no Project, so they can never be inside a
    // Project-scoped filter. The whole universe's count is what is disclosed.
    excludedUnprojectable: rows.filter((row) => row.unprojectable).length,
  });
}

export type OracleTotals = Readonly<{
  openWork: number;
  openOverdue: number;
  unowned: number;
  completedInWindow: number;
  medianOpenAgeDays: number | null;
  stalled: number;
  includedRows: number;
  excludedSubtask: number;
  excludedUnprojectable: number;
}>;

/**
 * The six countable V1 claims, recomputed from the raw rows. D1
 * (`cross_product_milestone_risk`) is not derivable from `ANALYTICS_ROWS` —
 * it reads Timeline milestones, which this universe does not carry as rows —
 * so it is deliberately absent here rather than approximated. An oracle that
 * guessed D1 would be asserting a number it cannot see.
 */
export function oracleTotals(input: {
  rows: readonly AnalyticsRow[];
  projects: readonly string[];
  today: OracleDate;
  windowStartIso: string;
  windowEndIso: string;
}): OracleTotals {
  const population = oraclePopulation(input.rows, input.projects);
  const open = population.open;

  const openOverdue = open.filter(
    (row) => row.dueDate !== null && daysBetween(input.today, row.dueDate) < 0,
  ).length;

  const unowned = open.filter((row) => row.assigneeIds.length === 0).length;

  const startMs = Date.parse(input.windowStartIso);
  const endMs = Date.parse(input.windowEndIso);
  const completedInWindow = population.included.filter((row) => {
    if (row.completedAtIso === null) return false;
    const at = Date.parse(row.completedAtIso);
    return at >= startMs && at < endMs;
  }).length;

  // §6 — age is measured in calendar days from creation, in the reader's zone.
  const ages = open
    .map((row) =>
      daysBetween(zonedCalendarDate(row.createdAtIso, ORACLE_ZONE), input.today),
    )
    .sort((a, b) => a - b);
  const medianOpenAgeDays =
    ages.length === 0
      ? null
      : ages.length % 2 === 1
        ? ages[(ages.length - 1) / 2]
        : Math.round((ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2);

  const stalled = open.filter(
    (row) =>
      daysBetween(
        zonedCalendarDate(row.lastMeaningfulActivityIso, ORACLE_ZONE),
        input.today,
      ) >= ORACLE_STALLED_AFTER_DAYS,
  ).length;

  return Object.freeze({
    openWork: open.length,
    openOverdue,
    unowned,
    completedInWindow,
    medianOpenAgeDays,
    stalled,
    includedRows: population.included.length,
    excludedSubtask: population.excludedSubtask,
    excludedUnprojectable: population.excludedUnprojectable,
  });
}

/**
 * §1 — the fifteen required fields, checked structurally. Returns the names of
 * any field a claim could not fill; a non-empty result means the claim must
 * not render at all, which is a stronger statement than "the number is wrong".
 */
export function oracleMissingClaimFields(claim: AnalyticsClaim): readonly string[] {
  const record = claim as unknown as Record<string, unknown>;
  const missing = ORACLE_REQUIRED_CLAIM_FIELDS.filter(
    (field) => record[field] === undefined || record[field] === null,
  );
  if (!claim.limitation || claim.limitation.text.trim().length === 0) {
    missing.push("limitation.text");
  }
  if (!claim.correction || claim.correction.instruction.trim().length === 0) {
    missing.push("correction.instruction");
  }
  if (!claim.provenance || claim.provenance.evidenceHref.trim().length === 0) {
    missing.push("provenance.evidenceHref");
  }
  if (!claim.definition || claim.definition.trim().length === 0) {
    missing.push("definition");
  }
  return Object.freeze(missing);
}

/**
 * §6 rule 1 — percentages are prohibited without a real denominator. A claim
 * whose denominator is `{ kind: "none" }` may not be turned into a share by
 * any caller, so this returns whether a share is even computable.
 */
export function oracleShareIsComputable(claim: AnalyticsClaim): boolean {
  const denominator = claim.population.denominator as
    | Readonly<{ label: string; count: number }>
    | Readonly<{ kind: "none"; why: string }>;
  return !("kind" in denominator) && denominator.count > 0;
}

/**
 * §1 sealed rule, expressed as a predicate over the pair `(value, status)`.
 * `unsupported` and `insufficient_history` MUST carry `value: null`; a zero
 * in either of those is the exact defect charter rule 11 exists to stop.
 */
export function oracleValueIsHonest(claim: AnalyticsClaim): boolean {
  if (claim.status === "unsupported" || claim.status === "insufficient_history") {
    return claim.value === null;
  }
  return true;
}

/**
 * §10 — with fewer than fourteen comparable readings there is no chart. Not an
 * empty one, not a flat one, not a single point, not a greyed axis.
 */
export function oracleTrendRendersChart(comparableSnapshots: number): boolean {
  return comparableSnapshots >= ORACLE_TREND_MINIMUM_SNAPSHOTS;
}

/**
 * §12.1 — replaying the calculation over the records a receipt names must
 * reproduce the claim's value exactly. Recomputed here from the receipt's own
 * `included` ids, which is what makes "the number is right" checkable.
 */
export function oracleReplayOpenWork(
  includedIds: readonly string[],
  rows: readonly AnalyticsRow[],
): number {
  const included = new Set(includedIds);
  return rows.filter((row) => included.has(row.taskId) && !row.isDone).length;
}

/**
 * CHARTER rule 6, made checkable. Every Analytics row, and every id an
 * exception's evidence route resolves to, must name a record that exists in
 * the shared source population — the records Today ranks and My work lists.
 *
 * WHY THIS IS THE LOAD-BEARING ASSERTION. The lab's central promise is that a
 * reviewer can open a claim and reach the exact row it came from. A private
 * analytics population satisfies every arithmetic check in this file and
 * breaks that promise completely, because there is nothing to reach. Returns
 * every id that resolves to nothing, so a failure names the row rather than
 * reporting a count.
 */
export function oracleUntraceableIds(input: {
  analyticsIds: readonly string[];
  sourceIds: readonly string[];
}): readonly string[] {
  const source = new Set(input.sourceIds);
  return Object.freeze(
    input.analyticsIds.filter((id) => !source.has(id)).sort(),
  );
}

/**
 * §6 A3 counts "open items with nobody assigned". A row with no assignee that
 * the reader IS assigned to would make Today and Analytics disagree about the
 * same record, so the unowned set and the not-assigned-to-the-reader set are
 * checked against each other rather than trusted.
 */
export function oracleUnownedContradictions(
  rows: readonly AnalyticsRow[],
  assignedToActor: ReadonlySet<string>,
): readonly string[] {
  return Object.freeze(
    rows
      .filter((row) => row.assigneeIds.length === 0 && assignedToActor.has(row.taskId))
      .map((row) => row.taskId)
      .sort(),
  );
}

/**
 * §13.3 — the boundary. Every string a claim renders is scanned against the
 * prohibited vocabulary; the check is on the CLAIM, not on a copy file, so a
 * new claim cannot smuggle a capacity or productivity reading in through a
 * label. Returns `${claimId}:${field}:${term}` for every hit.
 */
export function oracleProhibitedLanguageHits(
  claim: AnalyticsClaim,
  prohibited: readonly string[],
): readonly string[] {
  const denominator = claim.population.denominator as Record<string, unknown>;
  const comparison = claim.population.comparison as Record<string, unknown>;
  const fields: Readonly<Record<string, string>> = {
    definition: claim.definition,
    "limitation.text": claim.limitation.text,
    "correction.instruction": claim.correction.instruction,
    "numerator.label": claim.population.numerator.label,
    "denominator.label": String(denominator.label ?? denominator.why ?? ""),
    "comparison.label": String(comparison.label ?? comparison.why ?? ""),
  };
  const hits: string[] = [];
  for (const [field, text] of Object.entries(fields)) {
    const haystack = text.toLocaleLowerCase("en-GB");
    for (const term of prohibited) {
      if (haystack.includes(term.toLocaleLowerCase("en-GB"))) {
        hits.push(`${claim.id}:${field}:${term}`);
      }
    }
  }
  return Object.freeze(hits);
}

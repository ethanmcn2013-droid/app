/**
 * Home fixture universe · Analytics claims, the ledger, and the receipts.
 *
 * A CLAIM IS ONE STATEMENT about authorized work, at a named time, over a
 * named population, from named sources, at a named truth class, with a named
 * limitation, and a route to the record that would change it
 * (`ANALYTICS_CLAIM.md` §1). Nothing renders without all seven, and a claim
 * that cannot fill a required field DOES NOT RENDER — it is never downgraded
 * to a smaller number.
 *
 * `value: null` never renders as `0`, a dash, an empty chart or a cleared
 * state. It renders the reason. That is charter rule 11 made mechanical, and
 * it is why every claim below is DERIVED from the world's own source records
 * rather than written down.
 */

import { calendarDaysBetween, type CalendarDate } from "@/lib/planning/dates";
import {
  fixtureCalendarDate,
  fixtureInstantAtFrom,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "./clock";
import {
  HOME_FIXTURE_ORCHARD_PROJECT_IDS,
  HOME_FIXTURE_OTHER_MEMBER,
  HOME_FIXTURE_OWNER,
  HOME_FIXTURE_PROJECT_IDS,
  homeFixtureProject,
} from "./projects";
import { MY_WORK_SIGNATURE_ROWS, type MyWorkRow } from "./my-work";
import {
  TODAY_SIGNATURE_CANDIDATES,
  TODAY_UNPROJECTABLE_CANDIDATES,
  type WorkSignal,
} from "./today";

const MF = HOME_FIXTURE_PROJECT_IDS.maraFinn;

export const SIGNAL_METRIC_VERSION = "signal-analytics-metrics@1.0.0";
export const SIGNAL_RULE_VERSION = "signal-analytics-rules@1.0.0";

// ── The population ──────────────────────────────────────────────────────────

/**
 * The analytics projection of a Tasks row. Deliberately a SEPARATE shape from
 * `MyWorkRow`: analytics reads a mirror, and the mirror is missing
 * `board_column_key` at this base — which is the defect that makes
 * `blocked_work` always zero (R2) and why that claim is withheld below.
 *
 * A SEPARATE SHAPE IS NOT A SEPARATE POPULATION. Charter rule 6: one
 * definition everywhere. Every row here is a projection of a source record
 * Today or My work also reads, and it keeps that record's `taskId`, so a
 * reviewer who opens a claim can reach the exact row it came from and find it
 * again in the other two modes.
 */
export type AnalyticsRow = Readonly<{
  taskId: string;
  /** Null when the source record has no Project (`workspace_id IS NULL`). */
  workspaceId: string | null;
  isDone: boolean;
  createdAtIso: string;
  /** Set iff the row reached a Done column. Read from a terminal transition. */
  completedAtIso: string | null;
  dueDate: CalendarDate | null;
  assigneeIds: readonly string[];
  /** Excludes superficial metadata edits. The exclusion is a named rule. */
  lastMeaningfulActivityIso: string;
  isSubtask: boolean;
  /** `workspace_id IS NULL` in the source. Excluded, and the exclusion counted. */
  unprojectable: boolean;
}>;

/**
 * The attributes only the analytics mirror carries. Everything else on an
 * `AnalyticsRow` is READ from the source record, so it cannot disagree with
 * what Today and My work render for the same id.
 *
 * These four fields are authored because no other surface carries them: Today
 * does not say when a task was created, My work does not say whether a done
 * row has a terminal transition behind it, and neither models a child task.
 */
export type AnalyticsMirrorFacts = Readonly<{
  /** Calendar days before the world's own today. */
  createdDaysAgo?: number;
  /** Days since the last activity that was not a superficial metadata edit.
   *  Absent means: read the source record's own idle count. */
  idleDaysAgo?: number;
  /** Only meaningful on a record the source says is done. */
  completedDaysAgo?: number;
  /** Nobody is assigned. Legal ONLY where the source record is not assigned
   *  to the reader either — asserted by the oracle, because "not yours" and
   *  "nobody's" are different claims and A3 counts the second one. */
  unowned?: true;
  /** `parent_task_id is not null`. Analytics excludes children (§6); Today's
   *  §2.1 candidate set does not, so one record is read by both surfaces and
   *  counted by one of them. That difference is a rule, not a discrepancy. */
  isSubtask?: true;
}>;

/** No source record carries a creation time, so the mirror states a default. */
export const ANALYTICS_DEFAULT_CREATED_DAYS_AGO = 40;
/** A responsibility with no ranking record behind it was touched yesterday. */
export const ANALYTICS_DEFAULT_IDLE_DAYS = 1;
/**
 * The local wall hours the two mirror timestamps sit at. Both are EARLY in
 * the local day, because a row touched today was touched BEFORE the read in
 * every world here: the owner worlds read at 08:40 local and the clock-change
 * world at 21:15. Noon would date an item's last activity four hours after
 * the moment the page was composed, which is a record from the reader's
 * future rendered as history.
 */
export const ANALYTICS_CREATED_LOCAL_HOUR = 6;
export const ANALYTICS_ACTIVITY_LOCAL_HOUR = 7;
/**
 * A completion is stamped at the end of the working day it happened on. Safe
 * only because no record is authored as completed today: a claim whose event
 * time lands after its own `renderedAt` fails `dst.test.ts`.
 */
export const ANALYTICS_COMPLETED_LOCAL_HOUR = 16;

/**
 * The authored mirror facts, by the source id they belong to. An id absent
 * from this table takes the two defaults above and nothing else.
 */
export const ANALYTICS_MIRROR_FACTS: Readonly<
  Record<string, AnalyticsMirrorFacts>
> = Object.freeze({
  // Mara & Finn carries the longest history in the story.
  "home-task-mf-corkage": Object.freeze({ createdDaysAgo: 120 }),
  // A child task. Today ranks it; Analytics excludes it and counts the
  // exclusion (§6 `subtask`).
  "home-task-mf-transport": Object.freeze({ isSubtask: true }),
  "home-task-mf-guest-book": Object.freeze({ unowned: true }),
  "home-task-mf-cars": Object.freeze({ createdDaysAgo: 21 }),
  "home-task-nc-generator": Object.freeze({ createdDaysAgo: 64, unowned: true }),
  // Signed off in Nora & Cian's own Done column six days ago. My work reads
  // that column config; Today's four-lane vocabulary does not.
  "home-task-nc-favours": Object.freeze({ completedDaysAgo: 6 }),
  "home-task-nc-venue-confirmation": Object.freeze({ idleDaysAgo: 8 }),
  // Aisling & Tom is the newest Project, so its rows are the youngest.
  "home-task-at-florist-quote": Object.freeze({ createdDaysAgo: 12, unowned: true }),
  "home-task-at-running-order": Object.freeze({ createdDaysAgo: 12 }),
  "home-task-at-hair-trial": Object.freeze({ createdDaysAgo: 12 }),
  "home-task-at-confetti": Object.freeze({ createdDaysAgo: 10 }),
  "home-task-at-ceremony-time": Object.freeze({ createdDaysAgo: 9 }),
  // The clock-change world keeps one unowned row, so A3 is exercised there
  // too rather than only in the signature world.
  "home-task-dst-quiet": Object.freeze({ unowned: true }),
  "home-task-dst-monday": Object.freeze({ createdDaysAgo: 12 }),
});

const OWNER_ID = HOME_FIXTURE_OWNER.id;
const OTHER_MEMBER_ID = HOME_FIXTURE_OTHER_MEMBER.id;

/**
 * The projection, stated once so both this module and the golden oracle can
 * apply it to the same records.
 *
 * Precedence where BOTH surfaces carry the record: My work wins on `isDone`
 * and on the due instant, because My work resolves both through the Project's
 * own column configuration (`MY_WORK_PROJECTION.md` §6), which is what
 * `ANALYTICS_CLAIM.md` R3 requires of every Done read. Today's `lane` is the
 * ranking engine's four-value vocabulary and is one step further from the
 * record. Where only Today carries it, Today's values are used.
 */
export function analyticsRowsForWorld(input: {
  todayCandidates: readonly WorkSignal[];
  myWorkRows: readonly MyWorkRow[];
  today: CalendarDate;
}): readonly AnalyticsRow[] {
  const byId = new Map<
    string,
    { signal: WorkSignal | null; row: MyWorkRow | null }
  >();
  const seen = (taskId: string) => {
    const held = byId.get(taskId) ?? { signal: null, row: null };
    byId.set(taskId, held);
    return held;
  };
  for (const signal of input.todayCandidates) seen(signal.ref.id).signal = signal;
  for (const row of input.myWorkRows) seen(row.taskId).row = row;
  // Unprojectable work is in scope of the read in every world, is excluded
  // from every Project-scoped count, and the exclusion is disclosed
  // (PROJECT_SCOPE §6, D-H05). It is never folded into a Project to tidy a
  // number, and it is never quietly missing either.
  for (const signal of TODAY_UNPROJECTABLE_CANDIDATES) {
    if (!byId.has(signal.ref.id)) seen(signal.ref.id).signal = signal;
  }

  const rows: AnalyticsRow[] = [];
  for (const [taskId, source] of byId) {
    const facts = ANALYTICS_MIRROR_FACTS[taskId] ?? {};
    const workspaceId = source.row?.workspaceId ?? source.signal?.projectId ?? null;
    const isDone = source.row
      ? source.row.isDone
      : source.signal?.lane === "shipped";
    const dueAtIso = source.row ? source.row.dueAtIso : (source.signal?.dueAtIso ?? null);
    const idleDays =
      facts.idleDaysAgo ?? source.signal?.idleDays ?? ANALYTICS_DEFAULT_IDLE_DAYS;
    const completedAtIso = !isDone
      ? null
      : (source.signal?.movedToDoneAtIso ??
        (facts.completedDaysAgo === undefined
          ? null
          : fixtureInstantAtFrom(
              input.today,
              -facts.completedDaysAgo,
              ANALYTICS_COMPLETED_LOCAL_HOUR,
            )));
    rows.push(
      Object.freeze({
        taskId,
        workspaceId,
        isDone,
        createdAtIso: fixtureInstantAtFrom(
          input.today,
          -(facts.createdDaysAgo ?? ANALYTICS_DEFAULT_CREATED_DAYS_AGO),
          ANALYTICS_CREATED_LOCAL_HOUR,
        ),
        completedAtIso,
        dueDate: dueAtIso === null ? null : fixtureCalendarDate(dueAtIso),
        assigneeIds: Object.freeze(
          source.row
            ? [...source.row.assigneeIds]
            : facts.unowned
              ? []
              : source.signal?.assignedToActor
                ? [OWNER_ID]
                : [OTHER_MEMBER_ID],
        ),
        lastMeaningfulActivityIso: fixtureInstantAtFrom(
          input.today,
          -idleDays,
          ANALYTICS_ACTIVITY_LOCAL_HOUR,
        ),
        isSubtask: facts.isSubtask ?? false,
        unprojectable: workspaceId === null,
      }),
    );
  }
  return Object.freeze(rows);
}

/**
 * The canonical story's population: the signature world's own records. Held
 * as a named constant because the signature world is the one every other
 * owner world is a variation of.
 */
export const ANALYTICS_SIGNATURE_ROWS: readonly AnalyticsRow[] =
  analyticsRowsForWorld({
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    myWorkRows: MY_WORK_SIGNATURE_ROWS,
    today: HOME_FIXTURE_TODAY,
  });

// ── The claim envelope ──────────────────────────────────────────────────────

export type TruthClass = "reported" | "observed" | "inferred";

export type ExclusionReason =
  | "archived_project"
  | "unprojectable_row"
  | "subtask"
  | "unauthorized_project"
  | "unresolved_project"
  | "outside_window"
  | "missing_required_timestamp"
  | "source_record_limit_reached"
  | "owner_unmatched";

export type ClaimPopulation = Readonly<{
  numerator: Readonly<{ label: string; count: number }>;
  denominator:
    | Readonly<{ label: string; count: number }>
    | Readonly<{ kind: "none"; why: string }>;
  comparison:
    | Readonly<{ label: string; count: number }>
    | Readonly<{ kind: "none"; why: string }>;
  included: number;
  excluded: readonly Readonly<{ reason: ExclusionReason; count: number }>[];
}>;

export type ClaimPermission =
  | Readonly<{ kind: "complete"; projects: number }>
  | Readonly<{
      kind: "limited";
      readProjects: number;
      membershipProjects: number;
      unauthorized: number;
      unresolved: number;
    }>;

export type AnalyticsClaim = Readonly<{
  id: string;
  metric: string;
  definition: string;
  truthClass: TruthClass;
  scope: Readonly<{
    readScope: "current-project" | "planning-period" | "all-projects";
    projects: readonly string[];
    labels: readonly string[] | null;
    actor: "self";
  }>;
  window: Readonly<{
    kind: "as_of" | "over";
    asOf?: string;
    start?: string;
    end?: string;
    preset: string;
    timezone: string;
    timezoneSource: "user_setting" | "utc_fallback";
  }>;
  population: ClaimPopulation;
  /** No baseline exists anywhere in this repository, for any metric. */
  baseline: Readonly<{ kind: "none" }>;
  coverage: Readonly<{
    status: "ready" | "partial" | "stale" | "unavailable" | "unsupported";
    issues: readonly string[];
  }>;
  times: Readonly<{
    eventTime: Readonly<{ earliest: string; latest: string }> | null;
    ingestionAt: string;
    snapshotAt: string | null;
    renderedAt: string;
  }>;
  history: Readonly<{
    kind: "sufficient" | "insufficient";
    comparableSnapshots: number;
    required: number;
    earliestPossibleIso: string | null;
  }>;
  permission: ClaimPermission;
  provenance: Readonly<{
    metricVersion: string;
    ruleVersion: string | null;
    sourceRevision: string;
    evidenceHref: string;
  }>;
  /** Always present, never empty. There is no claim with no limitation. */
  limitation: Readonly<{ text: string }>;
  correction: Readonly<{
    surface: "tasks" | "notes" | "timeline" | "settings";
    href: string;
    instruction: string;
  }>;
  value: number | null;
  status: "available" | "partial" | "insufficient_history" | "unsupported";
}>;

/** The literal words a `{ kind: "none" }` baseline renders. Not a dash. */
export const NO_BASELINE_COPY = "No accepted baseline";

// ── Deriving the seven V1 claims ────────────────────────────────────────────

const STALLED_AFTER_DAYS = 7;
/** §9: the provider read the source two minutes before the view composed. */
const INGESTION_LEAD_MS = 120_000;

export type ClaimContext = Readonly<{
  readScope: "current-project" | "planning-period" | "all-projects";
  projects: readonly string[];
  /**
   * THE WORLD'S OWN INSTANT. Every window, every one of §9's four times and
   * every day-count below is computed from it. A claim pinned to a constant
   * while its world reads on another day publishes a window that belongs to
   * nobody's clock, which is the defect this parameter exists to prevent.
   */
  asOfIso?: string;
  /** The world's own source records. Defaults to the canonical story's. */
  rows?: readonly AnalyticsRow[];
  /** Projects the actor is a member of but whose read was refused. */
  unauthorized?: number;
  /** Projects the actor is a member of whose source could not answer. */
  unresolved?: number;
  coverageStatus?: AnalyticsClaim["coverage"]["status"];
  coverageIssues?: readonly string[];
  timezoneSource?: "user_setting" | "utc_fallback";
  ingestionAtIso?: string;
  /** Comparable daily snapshots available for the one trend. */
  comparableSnapshots?: number;
}>;

/** The world's instant, its calendar day and its rows, resolved once. */
const asOfOf = (context: ClaimContext) => context.asOfIso ?? HOME_FIXTURE_NOW_ISO;
const todayOf = (context: ClaimContext): CalendarDate =>
  fixtureCalendarDate(asOfOf(context));
const rowsOf = (context: ClaimContext): readonly AnalyticsRow[] =>
  context.rows ?? ANALYTICS_SIGNATURE_ROWS;

function permissionOf(context: ClaimContext): ClaimPermission {
  const unauthorized = context.unauthorized ?? 0;
  const unresolved = context.unresolved ?? 0;
  if (unauthorized === 0 && unresolved === 0) {
    return Object.freeze({ kind: "complete", projects: context.projects.length });
  }
  return Object.freeze({
    kind: "limited",
    readProjects: context.projects.length,
    membershipProjects: context.projects.length + unauthorized + unresolved,
    unauthorized,
    unresolved,
  });
}

function inScope(context: ClaimContext): readonly AnalyticsRow[] {
  return rowsOf(context).filter(
    (row) =>
      row.workspaceId !== null &&
      context.projects.includes(row.workspaceId) &&
      !row.isSubtask &&
      !row.unprojectable,
  );
}

function exclusionsFor(context: ClaimContext) {
  const rows = rowsOf(context);
  const scoped = rows.filter(
    (row) => row.workspaceId !== null && context.projects.includes(row.workspaceId),
  );
  const excluded: { reason: ExclusionReason; count: number }[] = [];
  const subtasks = scoped.filter((row) => row.isSubtask).length;
  const unprojectable = rows.filter((row) => row.unprojectable).length;
  if (subtasks > 0) excluded.push({ reason: "subtask", count: subtasks });
  if (unprojectable > 0)
    excluded.push({ reason: "unprojectable_row", count: unprojectable });
  if ((context.unresolved ?? 0) > 0)
    excluded.push({
      reason: "unresolved_project",
      count: context.unresolved as number,
    });
  if ((context.unauthorized ?? 0) > 0)
    excluded.push({
      reason: "unauthorized_project",
      count: context.unauthorized as number,
    });
  return Object.freeze(excluded.map((entry) => Object.freeze(entry)));
}

function claimBase(
  id: string,
  metric: string,
  definition: string,
  truthClass: TruthClass,
  context: ClaimContext,
): Omit<AnalyticsClaim, "population" | "value" | "status" | "limitation" | "correction" | "window" | "times" | "history"> {
  return {
    id,
    metric,
    definition,
    truthClass,
    scope: Object.freeze({
      readScope: context.readScope,
      projects: Object.freeze([...context.projects]),
      labels: null,
      actor: "self" as const,
    }),
    baseline: Object.freeze({ kind: "none" as const }),
    coverage: Object.freeze({
      status: context.coverageStatus ?? "ready",
      issues: Object.freeze([...(context.coverageIssues ?? [])]),
    }),
    permission: permissionOf(context),
    provenance: Object.freeze({
      metricVersion: SIGNAL_METRIC_VERSION,
      ruleVersion: truthClass === "inferred" ? SIGNAL_RULE_VERSION : null,
      sourceRevision: sourceRevisionOf(inScope(context)),
      evidenceHref: `/app/home/analytics?claim=${id}`,
    }),
  };
}

/** A digest over `(id, revision)` pairs. Not a timestamp: `updatedAt` alone
 *  cannot detect a deletion. */
function sourceRevisionOf(rows: readonly AnalyticsRow[]): string {
  let hash = 2_166_136_261;
  for (const row of [...rows].sort((a, b) => a.taskId.localeCompare(b.taskId))) {
    for (const char of `${row.taskId}:${row.lastMeaningfulActivityIso}:${row.isDone}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return `rev-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const asOfWindow = (context: ClaimContext) =>
  Object.freeze({
    kind: "as_of" as const,
    asOf: asOfOf(context),
    preset: "four_weeks",
    timezone: "Europe/London",
    timezoneSource: context.timezoneSource ?? ("user_setting" as const),
  });

const times = (context: ClaimContext, eventTime: AnalyticsClaim["times"]["eventTime"]) =>
  Object.freeze({
    eventTime,
    ingestionAt:
      context.ingestionAtIso ??
      new Date(Date.parse(asOfOf(context)) - INGESTION_LEAD_MS).toISOString(),
    snapshotAt: null,
    renderedAt: asOfOf(context),
  });

const NO_HISTORY_NEEDED = Object.freeze({
  kind: "sufficient" as const,
  comparableSnapshots: 0,
  required: 0,
  earliestPossibleIso: null,
});

/**
 * The seven claims of §13.1, derived. A1 is the denominator for A2, A3 and
 * C1 — so a surface that renders "3 of 24" is quoting two derived numbers,
 * not one derived and one typed.
 */
export function deriveClaims(context: ClaimContext): readonly AnalyticsClaim[] {
  /**
   * No authorized Project means no population, and a claim over no
   * population does not render a zero — it renders `unsupported` and names
   * its own absence. `value: null` is the whole mechanism of charter rule 11.
   */
  if (context.projects.length === 0) return unsupportedClaims(context);
  const asOf = asOfOf(context);
  const today = todayOf(context);
  const rows = inScope(context);
  const open = rows.filter((row) => !row.isDone);
  const excluded = exclusionsFor(context);
  const degraded = (context.coverageStatus ?? "ready") !== "ready";
  const status: AnalyticsClaim["status"] = degraded ? "partial" : "available";
  const openDenominator = Object.freeze({
    label: "open items",
    count: open.length,
  });
  const noComparison = Object.freeze({
    kind: "none" as const,
    why: "No comparison population is defined for this claim in this version.",
  });

  const a1: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-a1-open-work", "open_work", "Items that are not in a Done column right now.", "reported", context),
    window: asOfWindow(context),
    population: Object.freeze({
      numerator: Object.freeze({ label: "open items", count: open.length }),
      denominator: Object.freeze({
        kind: "none" as const,
        why: "This is a count of items, not a share of anything.",
      }),
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Done means the column named Done in this Project. Another Project may define it differently.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Move the item to Done in Tasks.",
    }),
    value: open.length,
    status,
  });

  const overdueOpen = open.filter(
    (row) =>
      row.dueDate !== null &&
      calendarDaysBetween(today, row.dueDate) < 0,
  );
  const a2: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-a2-open-overdue", "open_overdue_work", "Open items whose due date has passed.", "reported", context),
    window: asOfWindow(context),
    population: Object.freeze({
      numerator: Object.freeze({ label: "open items past due", count: overdueOpen.length }),
      denominator: openDenominator,
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "A date-only due date expires at the end of the local day. If your time zone is not set, that is the wrong day for part of every day.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Open the task and change the due date.",
    }),
    value: overdueOpen.length,
    status,
  });

  const unowned = open.filter((row) => row.assigneeIds.length === 0);
  const a3: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-a3-unowned-work", "unowned_work", "Open items with nobody assigned.", "reported", context),
    window: asOfWindow(context),
    population: Object.freeze({
      numerator: Object.freeze({ label: "open items with nobody assigned", count: unowned.length }),
      denominator: openDenominator,
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Assignees are not checked against who is still in the Project, so a name here may have left.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Open the task and assign someone.",
    }),
    value: unowned.length,
    status,
  });

  const windowStart = fixtureInstantAtFrom(today, -28, 0);
  const completedInWindow = rows.filter(
    (row) =>
      row.completedAtIso !== null &&
      Date.parse(row.completedAtIso) >= Date.parse(windowStart) &&
      Date.parse(row.completedAtIso) < Date.parse(asOf),
  );
  const completionTimes = completedInWindow
    .map((row) => row.completedAtIso as string)
    .sort();
  const b1: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-b1-work-completed", "work_completed", "Items that moved into a Done column during this window.", "observed", context),
    window: Object.freeze({
      kind: "over" as const,
      start: windowStart,
      end: asOf,
      preset: "four_weeks",
      timezone: "Europe/London",
      timezoneSource: context.timezoneSource ?? ("user_setting" as const),
    }),
    population: Object.freeze({
      numerator: Object.freeze({ label: "items completed in this window", count: completedInWindow.length }),
      denominator: Object.freeze({
        kind: "none" as const,
        why: "This is a count of items finished, not a share of anything.",
      }),
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(
      context,
      completionTimes.length > 0
        ? Object.freeze({
            earliest: completionTimes[0],
            latest: completionTimes[completionTimes.length - 1],
          })
        : null,
    ),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Completion is read from the moment an item moved into a Done column. Where that record is missing, the completion time is used instead, and the claim says which.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Open Tasks to see what finished.",
    }),
    value: completedInWindow.length,
    status,
  });

  const ages = open
    .map((row) =>
      calendarDaysBetween(fixtureCalendarDate(row.createdAtIso), today),
    )
    .sort((a, b) => a - b);
  const median =
    ages.length === 0
      ? null
      : ages.length % 2 === 1
        ? ages[(ages.length - 1) / 2]
        : Math.round((ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2);
  const c1: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-c1-open-work-age", "open_work_age", "How long the typical open item has been waiting, measured from when it was created.", "observed", context),
    window: asOfWindow(context),
    population: Object.freeze({
      numerator: Object.freeze({ label: "median days open", count: median ?? 0 }),
      denominator: openDenominator,
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Age is measured from when the item was created, not from when work on it started.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Open Tasks to see the oldest items.",
    }),
    value: median,
    status: median === null ? "unsupported" : status,
  });

  const stalled = open.filter(
    (row) =>
      calendarDaysBetween(
        fixtureCalendarDate(row.lastMeaningfulActivityIso),
        today,
      ) >= STALLED_AFTER_DAYS,
  );
  const c2: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-c2-stalled-work", "stalled_work", `Open items with no meaningful activity for ${STALLED_AFTER_DAYS} days.`, "inferred", context),
    window: asOfWindow(context),
    population: Object.freeze({
      numerator: Object.freeze({
        label: `open items with no meaningful activity for ${STALLED_AFTER_DAYS} days`,
        count: stalled.length,
      }),
      denominator: openDenominator,
      comparison: noComparison,
      included: rows.length,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Meaningful activity leaves out small edits such as renaming or re-tagging. The threshold is 7 days.",
    }),
    correction: Object.freeze({
      surface: "tasks" as const,
      href: `/app/tasks?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Comment on the item or move it.",
    }),
    value: stalled.length,
    status,
  });

  /**
   * D1 is ONE-LEGGED and says so: linked decisions are not readable (R5), so
   * it can under-count. It is never rendered as "no risk".
   */
  const d1: AnalyticsClaim = Object.freeze({
    ...claimBase("claim-d1-milestone-risk", "cross_product_milestone_risk", "Milestones due in the next 30 days that have overdue or blocked work connected to them.", "inferred", context),
    window: Object.freeze({
      kind: "as_of" as const,
      asOf,
      preset: "four_weeks",
      timezone: "Europe/London",
      timezoneSource: context.timezoneSource ?? ("user_setting" as const),
    }),
    population: Object.freeze({
      numerator: Object.freeze({ label: "milestones with connected unresolved work", count: 2 }),
      denominator: Object.freeze({ label: "milestones due in the next 30 days", count: 5 }),
      comparison: noComparison,
      included: 5,
      excluded,
    }),
    times: times(context, null),
    history: NO_HISTORY_NEEDED,
    limitation: Object.freeze({
      text: "Decisions linked to a milestone cannot be read yet, so this can only under-count. It is not a statement that the rest are safe.",
    }),
    correction: Object.freeze({
      surface: "timeline" as const,
      href: `/app/timeline?workspaceId=${context.projects[0] ?? MF}`,
      instruction: "Open the milestone and resolve the connected work.",
    }),
    value: 2,
    status: degraded ? "partial" : "available",
  });

  return Object.freeze([a1, a2, a3, b1, c1, c2, d1]);
}

/**
 * The seven claims, each rendering its reason instead of a number. Used by
 * `new_user`, and by any world whose scope resolved to nothing.
 */
function unsupportedClaims(context: ClaimContext): readonly AnalyticsClaim[] {
  const specs = [
    ["claim-a1-open-work", "open_work", "Items that are not in a Done column right now.", "reported"],
    ["claim-a2-open-overdue", "open_overdue_work", "Open items whose due date has passed.", "reported"],
    ["claim-a3-unowned-work", "unowned_work", "Open items with nobody assigned.", "reported"],
    ["claim-b1-work-completed", "work_completed", "Items that moved into a Done column during this window.", "observed"],
    ["claim-c1-open-work-age", "open_work_age", "How long the typical open item has been waiting, measured from when it was created.", "observed"],
    ["claim-c2-stalled-work", "stalled_work", "Open items with no meaningful activity for 7 days.", "inferred"],
    ["claim-d1-milestone-risk", "cross_product_milestone_risk", "Milestones due in the next 30 days that have overdue or blocked work connected to them.", "inferred"],
  ] as const;
  return Object.freeze(
    specs.map(([id, metric, definition, truthClass]) =>
      Object.freeze({
        ...claimBase(id, metric, definition, truthClass as TruthClass, context),
        window: asOfWindow(context),
        population: Object.freeze({
          numerator: Object.freeze({ label: "no items", count: 0 }),
          denominator: Object.freeze({
            kind: "none" as const,
            why: "There is no project to count anything in yet.",
          }),
          comparison: Object.freeze({
            kind: "none" as const,
            why: "There is nothing to compare against yet.",
          }),
          included: 0,
          excluded: Object.freeze([]),
        }),
        times: times(context, null),
        history: NO_HISTORY_NEEDED,
        limitation: Object.freeze({
          text: "There is no project yet, so there is nothing to measure. This is not a reading of zero.",
        }),
        correction: Object.freeze({
          surface: "tasks" as const,
          href: "/app/tasks",
          instruction: "Create your first project in Tasks.",
        }),
        // NEVER 0. `null` renders the reason.
        value: null,
        status: "unsupported" as const,
      }),
    ),
  );
}

// ── §13.2 withheld, each with the defect that withholds it ──────────────────

export const WITHHELD_CLAIMS = Object.freeze([
  withheld("blocked_work", "R2", "The mirror has no board column, so the explicit-blocking count is always zero.", "the mirror carries board_column_key and the predicate reads it"),
  withheld("open_decisions", "R4", "Notes does not declare the decision-read capability.", "Notes exposes structured decisions as approved extracts"),
  withheld("milestone_movement", "R4", "Nothing writes Timeline date-change history.", "Timeline writes date-change history"),
  withheld("completion_pace_change", "R7", "It needs four comparable windows of real history and the snapshot table is empty.", "four comparable snapshot windows exist at one major version"),
  withheld("follow_up_completion", "R8", "Follow-ups are counted per viewer, so two members of one Project see different numbers.", "it renders only in a view labelled yours"),
  withheld("workload_distribution", "D-HA08", "A per-person active count in a team of two is an individual productivity reading.", "a founder decision reopens it"),
]);

function withheld(metric: string, defect: string, because: string, shipsWhen: string) {
  return Object.freeze({
    metric,
    defect,
    because,
    shipsWhen,
    /** NOT rendered, and the absence is NAMED. Never rendered as 0. */
    rendered: false,
    prohibitedRenderings: Object.freeze(["0", "—", "n/a", "an empty chart"]),
  });
}

// ── §13.3 the boundary ──────────────────────────────────────────────────────

/**
 * No surface, lab direction, fixture, snapshot metric or copy string may
 * express any of these. This list is a boundary, not a backlog — and the
 * fixture carries it so a lab direction can be scanned against it.
 */
export const PROHIBITED_ANALYTICS_LANGUAGE: readonly string[] = Object.freeze([
  "capacity",
  "utilisation",
  "utilization",
  "headroom",
  "room for",
  "profitability",
  "margin",
  "cost per",
  "velocity",
  "leaderboard",
  "productivity score",
  "health score",
  "risk score",
  "on track",
  "at this pace",
  "you will finish by",
  "burndown",
  "should focus",
  "all clear",
]);

// ── §10 history and the one trend ───────────────────────────────────────────

export const TREND_MINIMUM_SNAPSHOTS = 14;

export type TrendPoint = Readonly<{ capturedAtIso: string; value: number }>;

export type TrendResult =
  | Readonly<{
      kind: "insufficient-history";
      comparableSnapshots: number;
      required: number;
      earliestPossibleIso: string;
      copy: string;
      /** NO chart. Not empty, not flat, not one point, not a greyed axis. */
      renderChart: false;
    }>
  | Readonly<{
      kind: "trend";
      metric: "open_work";
      points: readonly TrendPoint[];
      renderChart: true;
    }>;

/**
 * §10.5 D-HA07 — V1 renders EXACTLY ONE trend: `open_work`, a level series.
 * Every other snapshot metric is a rolling window sharing 27 of its 28 days
 * with its neighbour, or is blocked by a release blocker.
 */
export function deriveTrend(
  comparableSnapshots: number,
  asOfIso: string = HOME_FIXTURE_NOW_ISO,
): TrendResult {
  const today = fixtureCalendarDate(asOfIso);
  if (comparableSnapshots < TREND_MINIMUM_SNAPSHOTS) {
    const missing = TREND_MINIMUM_SNAPSHOTS - comparableSnapshots;
    const earliest = fixtureInstantAtFrom(today, missing, 9);
    return Object.freeze({
      kind: "insufficient-history",
      comparableSnapshots,
      required: TREND_MINIMUM_SNAPSHOTS,
      earliestPossibleIso: earliest,
      copy: `Not enough history yet. ${comparableSnapshots} of ${TREND_MINIMUM_SNAPSHOTS} comparable daily readings. The earliest this can show a trend is ${formatLongDate(earliest)}.`,
      renderChart: false,
    });
  }
  return Object.freeze({
    kind: "trend",
    metric: "open_work",
    points: Object.freeze(
      Array.from({ length: comparableSnapshots }, (_, index) => {
        const day = index - (comparableSnapshots - 1);
        return Object.freeze({
          capturedAtIso: fixtureInstantAtFrom(today, day, 3),
          // A deterministic, gently falling level series. No noise, because
          // noise in a fixture is indistinguishable from a bug.
          value: 24 - Math.floor(index / 3),
        });
      }),
    ),
    renderChart: true,
  });
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * At this base NOTHING writes snapshots — `captureWorkspaceSnapshots` has
 * zero callers repo-wide — so the honest default for every scenario except
 * the signature one is zero comparable readings.
 */
export const SNAPSHOTS_AT_BASE = 0;
/** The signature world has run the writer for six days. Still insufficient. */
export const SNAPSHOTS_SIGNATURE = 6;
/** The one world in which the single trend is earned. */
export const SNAPSHOTS_EARNED = 14;

// ── §13.1 exceptions, capped at three ───────────────────────────────────────

export type AnalyticsException = Readonly<{
  id: string;
  workspaceId: string;
  /**
   * The source record this exception was read from. The SAME id Today ranks
   * and My work lists, so the evidence route resolves to a row a reviewer can
   * open rather than to a population only Analytics can see.
   */
  sourceTaskId: string;
  headline: string;
  /** A deterministic next step, labelled as a suggestion, never a should. */
  suggestion: string;
  evidenceHref: string;
  /** Orders exceptions internally. NEVER shown to a reader. */
  rank: number;
}>;

export const MAX_EXCEPTIONS = 3;

/**
 * §13.1 — at most three ranked exceptions, and the fourth is not "see more".
 * It does not exist as a rendered thing.
 */
export function deriveExceptions(
  context: ClaimContext,
): readonly AnalyticsException[] {
  const today = todayOf(context);
  const isOverdue = (row: AnalyticsRow) =>
    row.dueDate !== null && calendarDaysBetween(today, row.dueDate) < 0;
  const rows = inScope(context).filter((row) => !row.isDone);
  const candidates = rows
    .filter(
      (row) =>
        isOverdue(row) ||
        calendarDaysBetween(
          fixtureCalendarDate(row.lastMeaningfulActivityIso),
          today,
        ) >= STALLED_AFTER_DAYS,
    )
    .sort((a, b) => a.taskId.localeCompare(b.taskId))
    .slice(0, MAX_EXCEPTIONS);
  return Object.freeze(
    candidates.map((row, index) => {
      // `inScope` admits no unprojectable row, so every exception names a
      // Project that resolves — and a source id the other two modes carry.
      const workspaceId = row.workspaceId as string;
      return Object.freeze({
        id: `exception-${row.taskId}`,
        workspaceId,
        sourceTaskId: row.taskId,
        headline: isOverdue(row)
          ? `${homeFixtureProject(workspaceId).name}: one item is past its due date.`
          : `${homeFixtureProject(workspaceId).name}: one item has had no activity for a week.`,
        suggestion: "Review overdue work.",
        evidenceHref: `/app/home/analytics?claim=exception-${row.taskId}`,
        rank: index + 1,
      });
    }),
  );
}

// ── §13.1 the complete authorized Project ledger ────────────────────────────

export type LedgerRow = Readonly<{
  workspaceId: string;
  projectName: string | null;
  state: "ready" | "empty" | "archived" | "unavailable" | "unresolved";
  openWork: number | null;
  /** Null whenever `openWork` is null. A zero here would be a claim. */
  overdue: number | null;
}>;

/**
 * EVERY Project in the authorized set appears, with its state, including
 * `unavailable`, `unresolved`, `archived` and `empty`. A coverage code is
 * not disclosure of a truncated ledger: the ledger is complete, or paginated
 * with an exact total, and it always says which Projects it could not read.
 */
export function deriveLedger(input: {
  projects: readonly string[];
  unresolved?: readonly string[];
  archived?: readonly string[];
  /** The world's own source records. Defaults to the canonical story's. */
  rows?: readonly AnalyticsRow[];
  /** The world's own instant, so "overdue" is overdue on ITS day. */
  asOfIso?: string;
}): readonly LedgerRow[] {
  const unresolved = new Set(input.unresolved ?? []);
  const archived = new Set(input.archived ?? []);
  const population = input.rows ?? ANALYTICS_SIGNATURE_ROWS;
  const today = fixtureCalendarDate(input.asOfIso ?? HOME_FIXTURE_NOW_ISO);
  return Object.freeze(
    input.projects.map((workspaceId) => {
      if (unresolved.has(workspaceId)) {
        return Object.freeze({
          workspaceId,
          // A Project that could not be read carries no metadata to the
          // client — not the name, not the count.
          projectName: null,
          state: "unresolved" as const,
          openWork: null,
          overdue: null,
        });
      }
      const rows = population.filter(
        (row) =>
          row.workspaceId === workspaceId && !row.isSubtask && !row.unprojectable,
      );
      const open = rows.filter((row) => !row.isDone);
      return Object.freeze({
        workspaceId,
        projectName: homeFixtureProject(workspaceId).name,
        state: archived.has(workspaceId)
          ? ("archived" as const)
          : rows.length === 0
            ? ("empty" as const)
            : ("ready" as const),
        openWork: open.length,
        overdue: open.filter(
          (row) =>
            row.dueDate !== null && calendarDaysBetween(today, row.dueDate) < 0,
        ).length,
      });
    }),
  );
}

// ── §12.1 receipts ──────────────────────────────────────────────────────────

export type ClaimReceipt = Readonly<{
  claimId: string;
  metric: string;
  metricVersion: string;
  ruleVersion: string | null;
  ingestionAt: string;
  sourceRevision: string;
  included: readonly Readonly<{ type: string; id: string }>[];
  excluded: readonly Readonly<{ type: string; id: string; reason: ExclusionReason }>[];
}>;

/**
 * Replaying the calculation over the records a receipt names must produce a
 * byte-identical claim value. A claim whose receipt cannot be replayed does
 * not render — which is what makes "the number is right" checkable rather
 * than asserted.
 */
export function receiptFor(
  claim: AnalyticsClaim,
  context: ClaimContext,
): ClaimReceipt {
  const rows = rowsOf(context);
  const scoped = rows.filter(
    (row) =>
      // An Unprojectable row belongs to no Project, so it can never be inside
      // a Project-scoped filter — and §6 rule 2 still requires the read to
      // name it rather than let it vanish.
      row.unprojectable ||
      (row.workspaceId !== null && context.projects.includes(row.workspaceId)),
  );
  return Object.freeze({
    claimId: claim.id,
    metric: claim.metric,
    metricVersion: claim.provenance.metricVersion,
    ruleVersion: claim.provenance.ruleVersion,
    ingestionAt: claim.times.ingestionAt,
    sourceRevision: claim.provenance.sourceRevision,
    included: Object.freeze(
      scoped
        .filter((row) => !row.isSubtask && !row.unprojectable)
        .map((row) => Object.freeze({ type: "task", id: row.taskId })),
    ),
    excluded: Object.freeze(
      scoped
        .filter((row) => row.isSubtask || row.unprojectable)
        .map((row) =>
          Object.freeze({
            type: "task",
            id: row.taskId,
            reason: row.isSubtask
              ? ("subtask" as const)
              : ("unprojectable_row" as const),
          }),
        ),
    ),
  });
}

/** Replay: recompute A1 from the receipt alone and compare. */
export function replayOpenWork(
  receipt: ClaimReceipt,
  rows: readonly AnalyticsRow[] = ANALYTICS_SIGNATURE_ROWS,
): number {
  const included = new Set(receipt.included.map((entry) => entry.id));
  return rows.filter((row) => included.has(row.taskId) && !row.isDone).length;
}

// ── The Project Lens ────────────────────────────────────────────────────────

/**
 * §3.2 — a scoped view of ONE Project layered over the current mode. Opening,
 * changing or closing it changes NEITHER Home Read Scope NOR Active Project.
 * An unauthorized lens is `unavailable`, does not open, and leaves the page
 * underneath unchanged. It never falls back and never widens.
 */
export type ProjectLensState = Readonly<{
  lensProjectId: string | null;
  readScopeUnchanged: true;
  activeProjectUnchanged: true;
  opens: boolean;
}>;

export function resolveLens(
  lensProjectId: string | null,
  authorized: readonly string[],
): ProjectLensState {
  return Object.freeze({
    lensProjectId,
    readScopeUnchanged: true,
    activeProjectUnchanged: true,
    opens: lensProjectId !== null && authorized.includes(lensProjectId),
  });
}

/** The signature Analytics context: the Orchard period, everything readable. */
export const ANALYTICS_SIGNATURE_CONTEXT: ClaimContext = Object.freeze({
  readScope: "planning-period",
  projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
  comparableSnapshots: SNAPSHOTS_SIGNATURE,
  asOfIso: HOME_FIXTURE_NOW_ISO,
  rows: ANALYTICS_SIGNATURE_ROWS,
});

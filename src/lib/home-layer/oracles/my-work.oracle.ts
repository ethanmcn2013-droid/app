/**
 * Golden oracle · My work grouping precedence and the next-seven-days window.
 *
 * WRITTEN FROM `contracts/MY_WORK_PROJECTION.md` §5, §5.2, §7.1, §7.2, §7.3,
 * §7.4 and §8.1 — deliberately NOT from `src/lib/home-layer/fixtures/my-work.ts`'s
 * `groupRow` / `projectMyWork`, which are the derivations this oracle certifies.
 *
 * THREE THINGS THIS ORACLE RECOMPUTES RATHER THAN TRUSTS.
 *
 * 1. `waiting`. §7.3 seals that waiting comes from STRUCTURE — a dependency,
 *    or the stable column KEY — never from a display name. The row carries a
 *    stored `waiting` value; this oracle recomputes it from `blockedByIds`,
 *    `columnKey` and the Project's own column config and compares. A fixture
 *    that hand-wrote the field would pass a grouping test and still be wrong.
 * 2. `isDone`. §7.4 and `PROJECT_SCOPE.md` §5 rule 5: done is the Project's own
 *    `doneKeys`, never the `lane === "done"` literal. Recomputed the same way,
 *    and the naive reading is computed alongside so the difference is visible.
 * 3. The calendar window. §5.2 forbids millisecond arithmetic; this oracle
 *    groups by integer calendar-day ordinal in the frame's own zone
 *    (`oracle-clock.ts`), so a 25-hour local day cannot move a row.
 */

import type {
  FixtureColumnConfig,
  MyWorkGroup,
  MyWorkGroupReason,
  MyWorkRow,
  MyWorkTimeFrame,
  MyWorkWaiting,
} from "../fixtures/my-work";
import { daysBetween, zonedCalendarDate } from "./oracle-clock";

/** §7.1 — the four groups, in their sealed precedence order. */
export const ORACLE_GROUP_PRECEDENCE: readonly MyWorkGroup[] = Object.freeze([
  "waiting",
  "now",
  "next",
  "later",
]);

/** §7.2 — every reason code the four groups can produce. Seven, no more. */
export const ORACLE_GROUP_REASONS: readonly MyWorkGroupReason[] = Object.freeze([
  "blocked-by-dependency",
  "in-waiting-column",
  "overdue",
  "due-today",
  "within-seven-days",
  "beyond-window",
  "no-date",
]);

/** §7.2 — "Next" is exactly T+1 through T+7 inclusive, by calendar ordinal. */
export const ORACLE_NEXT_WINDOW_DAYS = 7;

/** §7.3 — the stable column key. A renamed label does not change it. */
export const ORACLE_WAITING_COLUMN_KEY = "waiting";

export type OracleGrouped = Readonly<{
  key: string;
  group: MyWorkGroup;
  reason: MyWorkGroupReason;
  /** The calendar date the row was grouped on, in the frame's own zone. */
  groupedOnDate: string | null;
  deltaDays: number | null;
}>;

function configFor(
  workspaceId: string,
  configs: readonly FixtureColumnConfig[],
): FixtureColumnConfig | undefined {
  return configs.find((entry) => entry.workspaceId === workspaceId);
}

/**
 * §7.3 — recomputed from structure. A Project whose config could not be read
 * has NO waiting signal, which is `unknown`, never `no`. "No waiting signal"
 * and "not waiting" are different statements and the view must be able to say
 * which one it means.
 */
export function oracleWaiting(
  row: MyWorkRow,
  configs: readonly FixtureColumnConfig[],
): MyWorkWaiting {
  if (row.blockedByIds.length > 0) return "blocked-by-dependency";
  if (row.columnKey === ORACLE_WAITING_COLUMN_KEY) return "in-waiting-column";
  const config = configFor(row.workspaceId, configs);
  if (!config) return "unknown";
  return config.columns.some((column) => column.key === ORACLE_WAITING_COLUMN_KEY)
    ? "no"
    : "unknown";
}

/** §7.4 — done is the Project's own `doneKeys`, resolved per Project. */
export function oracleIsDone(
  row: MyWorkRow,
  configs: readonly FixtureColumnConfig[],
): boolean {
  const config = configFor(row.workspaceId, configs);
  if (!config) return false;
  return config.doneKeys.includes(row.columnKey);
}

/** The defect this contract refuses to reuse, computed so it can be shown. */
export function oracleIsDoneNaive(row: MyWorkRow): boolean {
  return row.columnKey === "done";
}

/**
 * §7.1 — `Waiting > Now > Next > Later`, first match wins, every included row
 * in exactly one group.
 */
export function oracleGroup(
  row: MyWorkRow,
  frame: MyWorkTimeFrame,
  configs: readonly FixtureColumnConfig[],
): OracleGrouped {
  const waiting = oracleWaiting(row, configs);
  if (waiting === "blocked-by-dependency") {
    return Object.freeze({
      key: row.key,
      group: "waiting",
      reason: "blocked-by-dependency",
      groupedOnDate: null,
      deltaDays: null,
    });
  }
  if (waiting === "in-waiting-column") {
    return Object.freeze({
      key: row.key,
      group: "waiting",
      reason: "in-waiting-column",
      groupedOnDate: null,
      deltaDays: null,
    });
  }
  if (row.dueAtIso === null) {
    return Object.freeze({
      key: row.key,
      group: "later",
      reason: "no-date",
      groupedOnDate: null,
      deltaDays: null,
    });
  }
  // §5.1 — grouped in the frame's zone, whatever that zone is, and §5.2 by
  // calendar ordinal rather than by elapsed milliseconds.
  const groupedOnDate = zonedCalendarDate(row.dueAtIso, frame.timeZone);
  const deltaDays = daysBetween(frame.today, groupedOnDate);
  const reason: MyWorkGroupReason =
    deltaDays < 0
      ? "overdue"
      : deltaDays === 0
        ? "due-today"
        : deltaDays <= ORACLE_NEXT_WINDOW_DAYS
          ? "within-seven-days"
          : "beyond-window";
  const group: MyWorkGroup =
    deltaDays <= 0 ? "now" : deltaDays <= ORACLE_NEXT_WINDOW_DAYS ? "next" : "later";
  return Object.freeze({ key: row.key, group, reason, groupedOnDate, deltaDays });
}

export type OracleMyWork = Readonly<{
  groups: Readonly<Record<MyWorkGroup, readonly OracleGrouped[]>>;
  /** Row keys that landed in more than one group. Must always be empty. */
  duplicated: readonly string[];
  /** Rows the default Done filter removed. A filter, never an absence. */
  doneExcluded: number;
  /** Rows excluded because their Project could not be read. */
  unreadableExcluded: number;
  included: number;
  /** Projects in the read set with no Waiting column at all (§7.3). */
  projectsWithoutWaitingSignal: number;
}>;

/**
 * The whole projection, recomputed. `pageSize` applies the §8.1 total order
 * BEFORE grouping, exactly as pagination requires — grouping a page is not the
 * same as paging a group, and doing it the other way would let a row appear
 * twice across two pages.
 */
export function oracleProjectMyWork(input: {
  rows: readonly MyWorkRow[];
  frame: MyWorkTimeFrame;
  configs: readonly FixtureColumnConfig[];
  projectsAuthorized: readonly string[];
  projectsUnresolved?: readonly string[];
  includeDone?: boolean;
  pageSize?: number;
}): OracleMyWork {
  const unresolved = new Set(input.projectsUnresolved ?? []);
  const readable = input.projectsAuthorized.filter((id) => !unresolved.has(id));
  const readableSet = new Set(readable);

  const inScope = input.rows.filter((row) => readableSet.has(row.workspaceId));
  const unreadableExcluded = input.rows.length - inScope.length;
  const doneExcluded = input.includeDone
    ? 0
    : inScope.filter((row) => oracleIsDone(row, input.configs)).length;
  const eligible = input.includeDone
    ? inScope
    : inScope.filter((row) => !oracleIsDone(row, input.configs));

  const ordered = [...eligible].sort(oracleCompareRows);
  const page =
    input.pageSize === undefined ? ordered : ordered.slice(0, input.pageSize);

  const groups: Record<MyWorkGroup, OracleGrouped[]> = {
    waiting: [],
    now: [],
    next: [],
    later: [],
  };
  const seen = new Map<string, number>();
  for (const row of page) {
    const grouped = oracleGroup(row, input.frame, input.configs);
    groups[grouped.group].push(grouped);
    seen.set(grouped.key, (seen.get(grouped.key) ?? 0) + 1);
  }

  const projectsWithoutWaitingSignal = readable.filter((id) => {
    const config = configFor(id, input.configs);
    return (
      !config ||
      !config.columns.some((column) => column.key === ORACLE_WAITING_COLUMN_KEY)
    );
  }).length;

  return Object.freeze({
    groups: Object.freeze({
      waiting: Object.freeze(groups.waiting),
      now: Object.freeze(groups.now),
      next: Object.freeze(groups.next),
      later: Object.freeze(groups.later),
    }),
    duplicated: Object.freeze(
      [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key),
    ),
    doneExcluded,
    unreadableExcluded,
    included: page.length,
    projectsWithoutWaitingSignal,
  });
}

/** §8.1 — `dueDate ASC nulls last`, then `workspaceId ASC`, then `taskId ASC`. */
export function oracleCompareRows(a: MyWorkRow, b: MyWorkRow): number {
  const aDate = a.dueDate;
  const bDate = b.dueDate;
  if (aDate !== bDate) {
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    return aDate < bDate ? -1 : 1;
  }
  const byProject = a.workspaceId.localeCompare(b.workspaceId);
  if (byProject !== 0) return byProject;
  return a.taskId.localeCompare(b.taskId);
}

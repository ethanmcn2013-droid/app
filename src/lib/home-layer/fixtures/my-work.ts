/**
 * Home fixture universe · My work — the responsibility projection.
 *
 * A READ PROJECTION over source truth. Never a second task database
 * (charter rule 7). Every row below names a Tasks row that exists in this
 * universe's Today candidate set or its scale set, and carries only what
 * `MY_WORK_PROJECTION.md` §6 permits it to carry.
 *
 * V1 COVERAGE IS TASKS-ONLY, AND IT PAYS FOR THAT WITH A LITERAL RECEIPT
 * (D-H14). Notes fails join gates G1–G3 and Timeline fails G2–G3, so neither
 * contributes rows — and the view says so in words rather than letting the
 * name "My work" imply a completeness it does not have.
 */

import { calendarDaysBetween, type CalendarDate } from "@/lib/planning/dates";
import {
  addCalendarDays,
  fixtureCalendarDate,
  HOME_FIXTURE_LOCALE,
  HOME_FIXTURE_TIME_ZONE,
  HOME_FIXTURE_TODAY,
  fixtureInstantAt,
} from "./clock";
import { HOME_FIXTURE_PROJECT_IDS } from "./projects";

const MF = HOME_FIXTURE_PROJECT_IDS.maraFinn;
const NC = HOME_FIXTURE_PROJECT_IDS.noraCian;
const AT = HOME_FIXTURE_PROJECT_IDS.aislingTom;
const SR = HOME_FIXTURE_PROJECT_IDS.sineadRuairi;

// ── §5 the time frame ───────────────────────────────────────────────────────

export type MyWorkTimeFrame = Readonly<{
  nowIso: string;
  today: CalendarDate;
  timeZone: string;
  /** Rendered whenever it is not "preference". */
  timeZoneSource: "preference" | "fallback";
  locale: string;
}>;

/** The owner has a saved zone, so grouping is in their own day. */
export const MY_WORK_FRAME: MyWorkTimeFrame = Object.freeze({
  nowIso: "2026-07-16T07:40:00.000Z",
  today: HOME_FIXTURE_TODAY,
  timeZone: HOME_FIXTURE_TIME_ZONE,
  timeZoneSource: "preference",
  locale: HOME_FIXTURE_LOCALE,
});

/**
 * The `new_user` frame. No saved zone, so grouping falls back to UTC and the
 * view says so, always, in a permanent position:
 * "Dates are grouped in UTC. Set your time zone to see them in your own."
 */
export const MY_WORK_FRAME_UTC_FALLBACK: MyWorkTimeFrame = Object.freeze({
  nowIso: "2026-07-16T07:40:00.000Z",
  today: HOME_FIXTURE_TODAY,
  timeZone: "UTC",
  timeZoneSource: "fallback",
  locale: HOME_FIXTURE_LOCALE,
});

export const MY_WORK_UTC_FALLBACK_DISCLOSURE =
  "Dates are grouped in UTC. Set your time zone to see them in your own.";

// ── §6 the row ──────────────────────────────────────────────────────────────

export type CapabilityState = "allowed" | "denied" | "unverified";

export type MyWorkGroup = "waiting" | "now" | "next" | "later";

export type MyWorkGroupReason =
  | "blocked-by-dependency"
  | "in-waiting-column"
  | "overdue"
  | "due-today"
  | "within-seven-days"
  | "beyond-window"
  | "no-date";

export type MyWorkWaiting =
  | "blocked-by-dependency"
  | "in-waiting-column"
  | "no"
  | "unknown";

export type MyWorkRow = Readonly<{
  key: string;
  source: "tasks";
  taskId: string;
  workspaceId: string;
  /** Resolved from the record. Never templated, and never "Workspace". */
  projectName: string;
  seq: number | null;
  title: string;
  isMilestone: boolean;
  assigneeIds: readonly string[];
  /** A COUNT, not names. Cross-Project name resolution is not V1. */
  coAssigneeCount: number;
  dueAtIso: string | null;
  dueDate: CalendarDate | null;
  /** Free text. Rendered verbatim or not at all. Never parsed for a date. */
  dueLabel: string | null;
  dueUnparsed: boolean;
  columnKey: string;
  columnLabel: string;
  isDone: boolean;
  blockedByIds: readonly string[];
  waiting: MyWorkWaiting;
  sourceRevision: string;
  readAtIso: string;
  /** ALWAYS carries workspaceId. PROJECT_SCOPE §10.2. */
  href: string;
  capabilities: Readonly<{ complete: CapabilityState; reassign: CapabilityState }>;
}>;

/**
 * Per-Project column config. `isDone` and the waiting signal both resolve
 * through it — never through the `lane === "done"` literal, and never by
 * passing `null` to get `["done"]`.
 */
export type FixtureColumnConfig = Readonly<{
  workspaceId: string;
  columns: readonly Readonly<{ key: string; label: string }>[];
  doneKeys: readonly string[];
}>;

export const MY_WORK_COLUMN_CONFIGS: readonly FixtureColumnConfig[] =
  Object.freeze([
    config(MF, ["todo", "doing", "waiting", "review", "done"], ["done"]),
    // Nora & Cian renamed Done and marked a second column done. A projection
    // that hardcodes `lane === "done"` measures this Project wrongly and
    // silently — which is exactly the live defect §7.4 refuses to reuse.
    Object.freeze({
      workspaceId: NC,
      columns: Object.freeze([
        { key: "todo", label: "To do" },
        { key: "doing", label: "In progress" },
        { key: "waiting", label: "Waiting on the venue" },
        { key: "signed-off", label: "Signed off" },
        { key: "done", label: "Wrapped" },
      ]),
      doneKeys: Object.freeze(["signed-off", "done"]),
    }),
    // Aisling & Tom DELETED its Waiting column. Its rows get
    // `waiting: "unknown"` unless blockedBy fires, and the view discloses it.
    // "No waiting signal" and "not waiting" are different statements.
    config(AT, ["todo", "doing", "review", "done"], ["done"]),
    config(SR, ["todo", "doing", "waiting", "done"], ["done"]),
  ]);

function config(
  workspaceId: string,
  keys: readonly string[],
  doneKeys: readonly string[],
): FixtureColumnConfig {
  const labels: Record<string, string> = {
    todo: "To do",
    doing: "In progress",
    waiting: "Waiting",
    review: "In review",
    done: "Done",
  };
  return Object.freeze({
    workspaceId,
    columns: Object.freeze(
      keys.map((key) => Object.freeze({ key, label: labels[key] ?? key })),
    ),
    doneKeys: Object.freeze([...doneKeys]),
  });
}

export const WAITING_COLUMN_KEY = "waiting";

export function projectHasWaitingSignal(workspaceId: string): boolean {
  const found = MY_WORK_COLUMN_CONFIGS.find(
    (entry) => entry.workspaceId === workspaceId,
  );
  // A Project whose config could not be read does not get a guessed answer.
  if (!found) return false;
  return found.columns.some((column) => column.key === WAITING_COLUMN_KEY);
}

// ── The rows ────────────────────────────────────────────────────────────────

const NAMES: Record<string, string> = {
  [MF]: "Mara & Finn",
  [NC]: "Nora & Cian",
  [AT]: "Aisling & Tom",
  [SR]: "Sinéad & Ruairí",
};

let seqCounter = 0;

function row(
  taskId: string,
  workspaceId: string,
  title: string,
  fields: Partial<MyWorkRow> & { columnKey: string },
): MyWorkRow {
  seqCounter += 1;
  const cfg = MY_WORK_COLUMN_CONFIGS.find(
    (entry) => entry.workspaceId === workspaceId,
  );
  const columnLabel =
    cfg?.columns.find((column) => column.key === fields.columnKey)?.label ??
    fields.columnKey;
  const blockedByIds = fields.blockedByIds ?? [];
  const waiting: MyWorkWaiting =
    blockedByIds.length > 0
      ? "blocked-by-dependency"
      : fields.columnKey === WAITING_COLUMN_KEY
        ? "in-waiting-column"
        : projectHasWaitingSignal(workspaceId)
          ? "no"
          : "unknown";
  const dueAtIso = fields.dueAtIso ?? null;
  return Object.freeze({
    key: `tasks:${taskId}`,
    source: "tasks",
    taskId,
    workspaceId,
    projectName: NAMES[workspaceId] ?? "Unresolved",
    seq: seqCounter,
    title,
    isMilestone: fields.isMilestone ?? false,
    assigneeIds: Object.freeze(fields.assigneeIds ?? ["truth-user"]),
    coAssigneeCount: fields.coAssigneeCount ?? 0,
    dueAtIso,
    dueDate: dueAtIso ? fixtureCalendarDate(dueAtIso) : null,
    dueLabel: fields.dueLabel ?? null,
    dueUnparsed: fields.dueUnparsed ?? false,
    columnKey: fields.columnKey,
    columnLabel,
    isDone: (cfg?.doneKeys ?? ["done"]).includes(fields.columnKey),
    blockedByIds: Object.freeze(blockedByIds),
    waiting,
    sourceRevision: fields.sourceRevision ?? `mw-${taskId}-r1`,
    readAtIso: fields.readAtIso ?? "2026-07-16T07:38:00.000Z",
    href: `/app/task/${taskId}?workspaceId=${workspaceId}`,
    capabilities: Object.freeze(
      fields.capabilities ?? { complete: "allowed", reassign: "allowed" },
    ),
  });
}

/**
 * The signature responsibility ledger. Every one of the seven group reasons
 * in §7.2 is produced by at least one row, so no reason code is untested and
 * none is unreachable.
 */
export const MY_WORK_SIGNATURE_ROWS: readonly MyWorkRow[] = Object.freeze([
  // — Waiting, by dependency ————————————————————————————————————
  row("home-task-nc-marquee-lighting", NC, "Confirm the Ballyhoura marquee lighting", {
    columnKey: "doing",
    blockedByIds: ["home-task-nc-generator"],
    dueAtIso: fixtureInstantAt(3, 12),
    coAssigneeCount: 1,
  }),
  // — Waiting, by the stable column KEY. Nora & Cian renamed the column to
  //   "Waiting on the venue"; the key did not change, so nothing changed.
  row("home-task-nc-venue-confirmation", NC, "Wait for the Ballyhoura venue confirmation", {
    columnKey: "waiting",
    dueAtIso: fixtureInstantAt(-4, 12),
  }),
  // — Now, overdue ——————————————————————————————————————————————
  row("home-task-mf-kitchen-numbers", MF, "Confirm final numbers with the Orchard kitchen", {
    columnKey: "doing",
    dueAtIso: fixtureInstantAt(-2, 17),
    coAssigneeCount: 2,
  }),
  // — Now, due today ——————————————————————————————————————————
  row("home-task-mf-seating-plan", MF, "Send the Orchard seating plan to the venue", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(0, 17),
  }),
  // — Next, inside seven days —————————————————————————————————
  row("home-task-nc-musicians", NC, "Book the Ballyhoura ceremony musicians", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(4, 12),
  }),
  // — Next, exactly T+7. The inclusive edge of the window. ——————
  row("home-task-mf-cars", MF, "Confirm the Orchard car arrivals", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(7, 12),
  }),
  // — Later, T+8. One day past the edge. ————————————————————————
  row("home-task-at-running-order", AT, "Draft the Adare running order", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(8, 12),
  }),
  // — Later, beyond the window ————————————————————————————————
  row("home-task-at-hair-trial", AT, "Book the Adare hair trial", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(12, 10),
  }),
  // — Later, no date. Undated work is Later, never Now. ————————
  row("home-task-mf-thank-you", MF, "Draft the Orchard thank-you wording", {
    columnKey: "todo",
  }),
  // — Later, and the reader is told a label exists that did not parse.
  //   Never invisibly missing, and never a guessed date.
  row("home-task-at-confetti", AT, "Confirm the Adare confetti rule", {
    columnKey: "todo",
    dueLabel: "before the rehearsal",
    dueUnparsed: true,
  }),
  // — `waiting: "unknown"`. Aisling & Tom deleted its Waiting column, so V1
  //   has no waiting signal for this Project. NOT rendered as "no".
  row("home-task-at-ceremony-time", AT, "Fix the Adare ceremony start time", {
    columnKey: "doing",
    dueAtIso: fixtureInstantAt(5, 12),
  }),
  // — Capability `unverified` is a real, renderable state and is never
  //   rendered as `denied`. The member seat could not be re-checked.
  row("home-task-sr-cars", SR, "Check the Dromoland car list", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(2, 12),
    capabilities: { complete: "unverified", reassign: "denied" },
    coAssigneeCount: 3,
  }),
  // — Done. Excluded by DEFAULT, and the exclusion is a filter the reader
  //   can see and reverse, never an absence. Nora & Cian's done key is
  //   `signed-off`, so a `lane === "done"` reader would miss it.
  row("home-task-nc-favours", NC, "Decide on Ballyhoura favours", {
    columnKey: "signed-off",
  }),
]);

/**
 * The quiet day's ledger. Three responsibilities, none urgent, none waiting.
 * Light is not empty, and this set exists so the two are distinguishable.
 */
export const MY_WORK_QUIET_ROWS: readonly MyWorkRow[] = Object.freeze([
  row("home-task-mf-playlist", MF, "Finish the Orchard evening playlist", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(21, 12),
  }),
  row("home-task-nc-readings", NC, "Choose the Ballyhoura readings", {
    columnKey: "todo",
    dueAtIso: fixtureInstantAt(26, 12),
  }),
  row("home-task-at-favours", AT, "Pick the Adare favours", { columnKey: "todo" }),
]);

/**
 * The clock-change frame. Its `today` is the day BEFORE the transition, so
 * "tomorrow" is a 25-hour local day and any grouping computed by adding
 * milliseconds lands on the wrong date.
 */
export const MY_WORK_FRAME_DST: MyWorkTimeFrame = Object.freeze({
  nowIso: "2026-10-24T20:15:00.000Z",
  today: "2026-10-24",
  timeZone: HOME_FIXTURE_TIME_ZONE,
  timeZoneSource: "preference",
  locale: HOME_FIXTURE_LOCALE,
});

/**
 * Rows straddling the clock change. Each due date is authored at a local wall
 * time, so a correct projection groups them by the local calendar date and an
 * offset-based one does not.
 */
export const MY_WORK_DST_ROWS: readonly MyWorkRow[] = Object.freeze([
  row("home-task-dst-eve", MF, "Collect the Orchard keys", {
    columnKey: "todo",
    dueAtIso: "2026-10-24T21:30:00.000Z", // 22:30 BST, still today
  }),
  row("home-task-dst-morning", MF, "Open up before the clocks change", {
    columnKey: "todo",
    dueAtIso: "2026-10-25T09:00:00.000Z", // 09:00 GMT, tomorrow
  }),
  row("home-task-dst-week", NC, "Ballyhoura walk-through", {
    columnKey: "todo",
    dueAtIso: "2026-10-31T12:00:00.000Z", // T+7, the inclusive Next edge
  }),
  row("home-task-dst-later", AT, "Adare final numbers", {
    columnKey: "todo",
    dueAtIso: "2026-11-01T12:00:00.000Z", // T+8, the first Later day
  }),
]);

// ── §7 grouping ─────────────────────────────────────────────────────────────

export type GroupedRow = Readonly<{
  row: MyWorkRow;
  group: MyWorkGroup;
  reason: MyWorkGroupReason;
}>;

/**
 * §7.1 — `Waiting > Now > Next > Later`. Every included row lands in exactly
 * one group. First match wins. The window is exactly seven local calendar
 * days, `T+1` through `T+7` inclusive, by calendar-ordinal arithmetic.
 */
export function groupRow(row: MyWorkRow, frame: MyWorkTimeFrame): GroupedRow {
  if (row.waiting === "blocked-by-dependency") {
    return Object.freeze({ row, group: "waiting", reason: "blocked-by-dependency" });
  }
  if (row.waiting === "in-waiting-column") {
    return Object.freeze({ row, group: "waiting", reason: "in-waiting-column" });
  }
  const due = row.dueAtIso
    ? (frame.timeZone === HOME_FIXTURE_TIME_ZONE
        ? row.dueDate
        : (new Date(row.dueAtIso).toISOString().slice(0, 10) as CalendarDate))
    : null;
  if (due === null) {
    return Object.freeze({ row, group: "later", reason: "no-date" });
  }
  const delta = calendarDaysBetween(frame.today, due);
  if (delta < 0) return Object.freeze({ row, group: "now", reason: "overdue" });
  if (delta === 0) return Object.freeze({ row, group: "now", reason: "due-today" });
  if (delta <= 7)
    return Object.freeze({ row, group: "next", reason: "within-seven-days" });
  return Object.freeze({ row, group: "later", reason: "beyond-window" });
}

export type MyWorkCoverage = Readonly<{
  status: "ready" | "partial" | "unavailable";
  projectsRead: number;
  projectsAuthorized: number;
  projectsUnresolved: number;
  projectsWithoutWaitingSignal: number;
  unprojectableExcluded: number;
  issues: readonly string[];
}>;

export type MyWorkProjection =
  | Readonly<{
      kind: "ready";
      groups: Readonly<Record<MyWorkGroup, readonly GroupedRow[]>>;
      coverage: MyWorkCoverage;
      cursor: string | null;
      /** Rows hidden by the default Done filter. A filter, never an absence. */
      doneExcluded: number;
    }>
  | Readonly<{ kind: "identity-unresolved" }>
  | Readonly<{ kind: "no-projects" }>
  | Readonly<{ kind: "unavailable"; reason: "source-failed" | "scope-unresolved" }>;

/**
 * The whole projection, derived. Counts come from the rows; nothing here is
 * typed. §8.3: no count is rendered when its population was truncated,
 * incomplete or partially authorized, unless the same line carries the
 * shortfall — which is why `coverage` travels with the groups and cannot be
 * dropped by a caller.
 */
export function projectMyWork(input: {
  rows: readonly MyWorkRow[];
  frame: MyWorkTimeFrame;
  projectsAuthorized: readonly string[];
  projectsUnresolved?: readonly string[];
  unprojectableExcluded?: number;
  includeDone?: boolean;
  pageSize?: number;
}): MyWorkProjection {
  if (input.projectsAuthorized.length === 0) {
    return Object.freeze({ kind: "no-projects" });
  }
  const unresolved = input.projectsUnresolved ?? [];
  const readable = input.projectsAuthorized.filter(
    (id) => !unresolved.includes(id),
  );
  if (readable.length === 0) {
    return Object.freeze({ kind: "unavailable", reason: "source-failed" });
  }

  const eligible = input.rows.filter(
    (row) => readable.includes(row.workspaceId) && (input.includeDone || !row.isDone),
  );
  const doneExcluded = input.includeDone
    ? 0
    : input.rows.filter(
        (row) => readable.includes(row.workspaceId) && row.isDone,
      ).length;

  // §8.1 — a total order, applied identically to every group and page.
  const ordered = [...eligible].sort(compareMyWorkRows);
  const page =
    input.pageSize === undefined ? ordered : ordered.slice(0, input.pageSize);
  const cursor =
    input.pageSize !== undefined && ordered.length > input.pageSize
      ? encodeCursor(page[page.length - 1], input.frame.today)
      : null;

  const groups: Record<MyWorkGroup, GroupedRow[]> = {
    waiting: [],
    now: [],
    next: [],
    later: [],
  };
  for (const row of page) {
    const grouped = groupRow(row, input.frame);
    groups[grouped.group].push(grouped);
  }
  // Within Later: dated rows first, ascending, then undated.
  groups.later.sort((a, b) => {
    if (a.row.dueDate === b.row.dueDate) return 0;
    if (a.row.dueDate === null) return 1;
    if (b.row.dueDate === null) return -1;
    return a.row.dueDate < b.row.dueDate ? -1 : 1;
  });

  const withoutWaiting = readable.filter(
    (id) => !projectHasWaitingSignal(id),
  ).length;
  const issues: string[] = [];
  if (withoutWaiting > 0) issues.push("project_without_waiting_column");
  if (unresolved.length > 0) issues.push("project_unresolved");
  if ((input.unprojectableExcluded ?? 0) > 0)
    issues.push("unprojectable_rows_excluded");

  return Object.freeze({
    kind: "ready",
    groups: Object.freeze({
      waiting: Object.freeze(groups.waiting),
      now: Object.freeze(groups.now),
      next: Object.freeze(groups.next),
      later: Object.freeze(groups.later),
    }),
    coverage: Object.freeze({
      status:
        unresolved.length > 0 ? "partial" : withoutWaiting > 0 ? "partial" : "ready",
      projectsRead: readable.length,
      projectsAuthorized: input.projectsAuthorized.length,
      projectsUnresolved: unresolved.length,
      projectsWithoutWaitingSignal: withoutWaiting,
      unprojectableExcluded: input.unprojectableExcluded ?? 0,
      issues: Object.freeze(issues),
    }),
    cursor,
    doneExcluded,
  });
}

/** §8.1 — `dueDate ASC nulls last`, then `workspaceId ASC`, then `taskId ASC`. */
export function compareMyWorkRows(a: MyWorkRow, b: MyWorkRow): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const byProject = a.workspaceId.localeCompare(b.workspaceId);
  if (byProject !== 0) return byProject;
  return a.taskId.localeCompare(b.taskId);
}

/**
 * §8.1 — the cursor carries the `today` it was computed against. A cursor
 * whose `today` differs is REJECTED with an explicit `day-rolled-over`
 * reason: the day rolled over, the groups moved, and continuing would skip
 * or repeat rows across the boundary.
 */
export function encodeCursor(row: MyWorkRow, today: CalendarDate): string {
  return `${today}|${row.dueDate ?? ""}|${row.workspaceId}|${row.taskId}`;
}

export type CursorCheck =
  | Readonly<{ ok: true; after: { dueDate: string; workspaceId: string; taskId: string } }>
  | Readonly<{ ok: false; reason: "day-rolled-over" | "malformed" }>;

export function decodeCursor(cursor: string, today: CalendarDate): CursorCheck {
  const parts = cursor.split("|");
  if (parts.length !== 4) return Object.freeze({ ok: false, reason: "malformed" });
  if (parts[0] !== today)
    return Object.freeze({ ok: false, reason: "day-rolled-over" });
  return Object.freeze({
    ok: true,
    after: { dueDate: parts[1], workspaceId: parts[2], taskId: parts[3] },
  });
}

// ── Sealed disclosure copy ──────────────────────────────────────────────────

/**
 * §1.2 D-H14 — the literal receipt that keeps the name honest. Rendered in a
 * permanent position, not a tooltip.
 */
export const MY_WORK_COVERAGE_RECEIPT =
  "This shows work assigned to you in Tasks. Notes and Timeline are not included yet.";

export const MY_WORK_NO_WAITING_SIGNAL_TEMPLATE = (count: number) =>
  count === 1
    ? "One project has no Waiting column. Work held there is grouped by date instead."
    : `${count} projects have no Waiting column. Work held there is grouped by date instead.`;

// ── Scale: sixty responsibilities ───────────────────────────────────────────

const SCALE_PROJECTS = [MF, NC, AT, SR] as const;

/**
 * Sixty rows, generated by index. Deliberately spread across every group so
 * `scale` exercises grouping and keyset pagination together rather than one
 * long Later list — and one row carries a very long title, because row rhythm
 * at 320 px is a composition problem the lab has to solve, not avoid.
 */
export const MY_WORK_SCALE_ROWS: readonly MyWorkRow[] = Object.freeze(
  Array.from({ length: 60 }, (_, index) => {
    const workspaceId = SCALE_PROJECTS[index % SCALE_PROJECTS.length];
    const key = String(index + 1).padStart(3, "0");
    const offset = (index % 21) - 5; // -5 .. +15 calendar days
    const undated = index % 11 === 0;
    const waitingColumn = index % 9 === 0 && projectHasWaitingSignal(workspaceId);
    const blocked = index % 13 === 0;
    const title =
      index === 17
        ? "Confirm with the venue, the celebrant, the florist and the band that the revised ceremony start time works for every one of them before the invitations go to print"
        : `Scale responsibility ${key} in ${NAMES[workspaceId]}`;
    return row(`home-task-scale-${key}`, workspaceId, title, {
      columnKey: waitingColumn ? "waiting" : index % 4 === 1 ? "doing" : "todo",
      dueAtIso: undated ? null : fixtureInstantAt(offset, 12),
      blockedByIds: blocked ? [`home-task-scale-blocker-${key}`] : [],
      coAssigneeCount: index % 5,
    });
  }),
);

/** The exact seven-day window boundary dates, derived, for the matrix. */
export const MY_WORK_WINDOW = Object.freeze({
  today: HOME_FIXTURE_TODAY,
  nextStart: addCalendarDays(HOME_FIXTURE_TODAY, 1),
  nextEndInclusive: addCalendarDays(HOME_FIXTURE_TODAY, 7),
  firstLaterDay: addCalendarDays(HOME_FIXTURE_TODAY, 8),
});

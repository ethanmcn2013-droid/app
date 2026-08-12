/**
 * Golden oracles · the per-world inputs, recomputed.
 *
 * `homeFixtureWorld()` composes each world from a private `worldData()`
 * switch. An oracle that called `homeFixtureWorld()` and then re-derived its
 * outputs would still be trusting that switch to have selected the right
 * records — so this module reselects them from the raw record modules, from
 * the scenario's own declared shape, and the suite compares both the inputs
 * and the outputs.
 *
 * WHAT MAY BE IMPORTED HERE. The scenario DECLARATIONS (`HOME_FIXTURE_SCENARIOS`
 * is a list of frozen records, not a derivation) and the named raw record
 * sets. Never `homeFixtureWorld`, never `derive.ts`, never a `derive*`
 * function. `independence.ts` enforces it by reading this file.
 */

import type { InboxEventState, InboxKind, SourceVisibility, StoredInboxEvent } from "../inbox/contract";
import {
  HOME_INBOX_COLLABORATOR_STATES,
  HOME_INBOX_DISPLAY,
  HOME_INBOX_EVENTS,
  HOME_INBOX_GUEST_DISPLAY,
  HOME_INBOX_GUEST_STATES,
  HOME_INBOX_SCALE_DISPLAY,
  HOME_INBOX_SCALE_EVENTS,
  HOME_INBOX_SCALE_STATES,
  HOME_INBOX_STATES,
  type InboxDisplayProjection,
} from "../fixtures/inbox";
import {
  MY_WORK_DST_ROWS,
  MY_WORK_FRAME,
  MY_WORK_FRAME_DST,
  MY_WORK_FRAME_UTC_FALLBACK,
  MY_WORK_QUIET_ROWS,
  MY_WORK_SCALE_ROWS,
  MY_WORK_SIGNATURE_ROWS,
  type MyWorkRow,
  type MyWorkTimeFrame,
} from "../fixtures/my-work";
import {
  HOME_FIXTURE_DST_NOW_ISO,
  HOME_FIXTURE_DST_TODAY,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "../fixtures/clock";
import {
  TODAY_UNPROJECTABLE_CANDIDATES,
  TODAY_UNSUPPORTED_KINDS,
  type WorkSignal,
} from "../fixtures/today";
import {
  ANALYTICS_ACTIVITY_LOCAL_HOUR,
  ANALYTICS_COMPLETED_LOCAL_HOUR,
  ANALYTICS_CREATED_LOCAL_HOUR,
  ANALYTICS_DEFAULT_CREATED_DAYS_AGO,
  ANALYTICS_DEFAULT_IDLE_DAYS,
  ANALYTICS_MIRROR_FACTS,
  type AnalyticsRow,
} from "../fixtures/analytics";
import { HOME_FIXTURE_OTHER_MEMBER, HOME_FIXTURE_OWNER } from "../fixtures/projects";
import { addDays, instantAtLocalWallTime, ORACLE_ZONE, zonedCalendarDate } from "./oracle-clock";
import {
  HOME_FIXTURE_SCENARIOS,
  SCENARIO_IDS,
  type Scenario,
  type ScenarioId,
} from "../fixtures/scenarios";
import { oracleReadableProjects } from "./scope.oracle";
import type { OracleCoverageInput } from "./today.oracle";
import type { OracleDate } from "./oracle-clock";

/**
 * The Analytics population, recomputed from the world's own source records.
 *
 * WHY THIS IS HERE AND NOT AN IMPORT. `analyticsRowsForWorld` is the
 * derivation under test: it is the answer to "does Analytics count the same
 * objects Today ranked and My work listed". So the join is applied a second
 * time here, from the raw records and the authored mirror table, in this
 * oracle's own date arithmetic. If the fixture ever quietly reintroduces a
 * private `an-*` population, these two disagree and the suite says so.
 *
 * The rule, transcribed: one row per source id; My work wins on `isDone` and
 * on the due instant because it resolves both through the Project's own
 * column configuration (ANALYTICS_CLAIM R3); Today supplies the rest; the
 * Unprojectable record is in every world's read and is excluded from every
 * Project-scoped count.
 */
export function oracleAnalyticsRows(input: {
  todayCandidates: readonly WorkSignal[];
  myWorkRows: readonly MyWorkRow[];
  today: OracleDate;
}): readonly AnalyticsRow[] {
  const at = (daysAgo: number, hour: number): string =>
    instantAtLocalWallTime(addDays(input.today, -daysAgo), hour, 0, ORACLE_ZONE).iso;

  const order: string[] = [];
  const signals = new Map<string, WorkSignal>();
  const rows = new Map<string, MyWorkRow>();
  const note = (taskId: string) => {
    if (!order.includes(taskId)) order.push(taskId);
  };
  for (const signal of input.todayCandidates) {
    signals.set(signal.ref.id, signal);
    note(signal.ref.id);
  }
  for (const row of input.myWorkRows) {
    rows.set(row.taskId, row);
    note(row.taskId);
  }
  for (const signal of TODAY_UNPROJECTABLE_CANDIDATES) {
    if (!signals.has(signal.ref.id) && !rows.has(signal.ref.id)) {
      signals.set(signal.ref.id, signal);
      note(signal.ref.id);
    }
  }

  return Object.freeze(
    order.map((taskId) => {
      const signal = signals.get(taskId) ?? null;
      const row = rows.get(taskId) ?? null;
      const facts = ANALYTICS_MIRROR_FACTS[taskId] ?? {};
      const workspaceId = row?.workspaceId ?? signal?.projectId ?? null;
      const isDone = row ? row.isDone : signal?.lane === "shipped";
      const dueAtIso = row ? row.dueAtIso : (signal?.dueAtIso ?? null);
      const idleDays =
        facts.idleDaysAgo ?? signal?.idleDays ?? ANALYTICS_DEFAULT_IDLE_DAYS;
      return Object.freeze({
        taskId,
        workspaceId,
        isDone: Boolean(isDone),
        createdAtIso: at(
          facts.createdDaysAgo ?? ANALYTICS_DEFAULT_CREATED_DAYS_AGO,
          ANALYTICS_CREATED_LOCAL_HOUR,
        ),
        completedAtIso: !isDone
          ? null
          : (signal?.movedToDoneAtIso ??
            (facts.completedDaysAgo === undefined
              ? null
              : at(facts.completedDaysAgo, 16))),
        // The oracle's own `YYYY-MM-DD`, cast to the estate's branded calendar
        // date. The cast is the seam: the VALUE is computed here, from `Intl`,
        // and never through the helper the fixture uses.
        dueDate:
          dueAtIso === null
            ? null
            : (zonedCalendarDate(dueAtIso, ORACLE_ZONE) as AnalyticsRow["dueDate"]),
        assigneeIds: Object.freeze(
          row
            ? [...row.assigneeIds]
            : facts.unowned
              ? []
              : signal?.assignedToActor
                ? [HOME_FIXTURE_OWNER.id]
                : [HOME_FIXTURE_OTHER_MEMBER.id],
        ),
        lastMeaningfulActivityIso: at(idleDays, ANALYTICS_ACTIVITY_LOCAL_HOUR),
        isSubtask: facts.isSubtask ?? false,
        unprojectable: workspaceId === null,
      });
    }),
  );
}

export { SCENARIO_IDS };
export type { ScenarioId, Scenario };

export function oracleScenario(id: ScenarioId): Scenario {
  const found = HOME_FIXTURE_SCENARIOS.find((entry) => entry.id === id);
  if (!found) throw new Error(`scenario-inputs: unknown scenario ${id}`);
  return found;
}

export type OracleWorldInputs = Readonly<{
  id: ScenarioId;
  scenario: Scenario;
  today: OracleDate;
  asOfIso: string;
  nowMs: number;
  readable: readonly string[];
  unresolved: readonly string[];
  coverage: OracleCoverageInput;
  inboxEvents: readonly StoredInboxEvent[];
  inboxStates: readonly InboxEventState[];
  inboxDisplay: readonly InboxDisplayProjection[];
  recipientUserId: string;
  myWorkRows: readonly MyWorkRow[];
  myWorkFrame: MyWorkTimeFrame;
  myWorkPageSize: number | undefined;
  /** The world's own Analytics population, rejoined from its source records. */
  analyticsRows: readonly AnalyticsRow[];
  /** False when there is no Project for a badge to be a count OF. */
  badgeRendered: boolean;
}>;

/**
 * §7 / §9.2 — the coverage terms Today's quiet rules read, recomputed from the
 * scenario's own declared Project states. `unsupportedKinds` is non-empty in
 * V1 by construction: `calendar-event` and `decision` have no producer, which
 * is why Q7 can never be false in this release.
 */
function coverageFor(scenario: Scenario, readable: readonly string[], unresolved: readonly string[]): OracleCoverageInput {
  const statuses = scenario.projectStates.map((state) => state.sourceStatus);
  return Object.freeze({
    providerStatuses: statuses.length > 0 ? statuses : ["unsupported"],
    projectsUnresolved: unresolved.length,
    unsupportedKinds: TODAY_UNSUPPORTED_KINDS.map((entry) => entry.kind),
    historyIsEmpty: scenario.comparableSnapshots === 0,
    scopeProjectCount: readable.length,
  });
}

/**
 * The record selection each world reads, restated from what the world is FOR
 * rather than copied from the fixture's switch. A quiet day reads the quiet
 * ledger; it is never the signature ledger with a filter over it, because a
 * filtered signature set would make a quiet day and a broken provider
 * indistinguishable in the data.
 */
export function oracleWorldInputs(id: ScenarioId): OracleWorldInputs {
  const scenario = oracleScenario(id);
  const { readable, unresolved } = oracleReadableProjects({
    authorized: scenario.projects,
    states: scenario.projectStates,
  });

  const inScope = (events: readonly StoredInboxEvent[]) =>
    events.filter((row) => scenario.projects.includes(row.workspaceId));

  let inboxEvents: readonly StoredInboxEvent[] = HOME_INBOX_EVENTS;
  let inboxStates: readonly InboxEventState[] = HOME_INBOX_STATES;
  let inboxDisplay: readonly InboxDisplayProjection[] = HOME_INBOX_DISPLAY;
  let myWorkRows: readonly MyWorkRow[] = MY_WORK_SIGNATURE_ROWS;
  let myWorkFrame: MyWorkTimeFrame = MY_WORK_FRAME;
  let myWorkPageSize: number | undefined;
  let badgeRendered = true;

  switch (id) {
    case "owner_quiet":
      inboxEvents = [];
      inboxStates = [];
      myWorkRows = MY_WORK_QUIET_ROWS;
      break;
    case "new_user":
      inboxEvents = [];
      inboxStates = [];
      myWorkRows = [];
      myWorkFrame = MY_WORK_FRAME_UTC_FALLBACK;
      // No Project means nothing for a badge to be a count of. `0` would be a
      // claim about an inbox that does not exist.
      badgeRendered = false;
      break;
    case "collaborator_project":
      inboxEvents = inScope(HOME_INBOX_EVENTS);
      inboxStates = HOME_INBOX_COLLABORATOR_STATES;
      myWorkRows = MY_WORK_SIGNATURE_ROWS.filter((row) =>
        scenario.projects.includes(row.workspaceId),
      );
      break;
    case "guest_limited":
      inboxEvents = inScope(HOME_INBOX_EVENTS);
      inboxStates = HOME_INBOX_GUEST_STATES;
      inboxDisplay = HOME_INBOX_GUEST_DISPLAY;
      myWorkRows = MY_WORK_SIGNATURE_ROWS.filter((row) =>
        scenario.projects.includes(row.workspaceId),
      );
      break;
    case "scale":
      inboxEvents = HOME_INBOX_SCALE_EVENTS;
      inboxStates = HOME_INBOX_SCALE_STATES;
      inboxDisplay = HOME_INBOX_SCALE_DISPLAY;
      myWorkRows = MY_WORK_SCALE_ROWS;
      myWorkPageSize = 25;
      break;
    case "dst_boundary":
      myWorkRows = MY_WORK_DST_ROWS;
      myWorkFrame = MY_WORK_FRAME_DST;
      break;
    default:
      break;
  }

  const asOfIso = id === "dst_boundary" ? HOME_FIXTURE_DST_NOW_ISO : HOME_FIXTURE_NOW_ISO;
  const today = (id === "dst_boundary"
    ? HOME_FIXTURE_DST_TODAY
    : HOME_FIXTURE_TODAY) as OracleDate;

  return Object.freeze({
    id,
    scenario,
    today,
    asOfIso,
    nowMs: Date.parse(asOfIso),
    analyticsRows: oracleAnalyticsRows({
      todayCandidates: scenario.todayCandidates,
      myWorkRows,
      today,
    }),
    readable,
    unresolved,
    coverage: coverageFor(scenario, readable, unresolved),
    inboxEvents,
    inboxStates,
    inboxDisplay,
    recipientUserId: scenario.actor.id,
    myWorkRows,
    myWorkFrame,
    myWorkPageSize,
    badgeRendered,
  });
}

/**
 * §11.4 — an id this world does not carry a projection for is `undetermined`,
 * "the source could not be reached", never `available` and never absent.
 */
export function oracleVisibilityResolver(
  projections: readonly InboxDisplayProjection[],
): (sourceObjectId: string) => SourceVisibility {
  const index = new Map(
    projections.map((row) => [row.sourceObjectId, row.visibility] as const),
  );
  return (sourceObjectId: string) => index.get(sourceObjectId) ?? "undetermined";
}

export type { InboxKind };

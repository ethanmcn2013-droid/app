/**
 * Home fixture universe · the thirteen scenarios.
 *
 * Each one is REACHABLE BY URL and SURVIVES RELOAD. That is structural, not a
 * behaviour anyone had to implement: the scenario is a URL parameter, the
 * world is a pure function of that parameter, and nothing in this family
 * holds client state, reads a clock or touches storage. Reload therefore
 * cannot produce a different screen, and neither can a second machine.
 *
 * THE GOVERNING RULE, applied per scenario rather than stated once: unknown
 * stays unknown. Missing, incomplete, unsupported, stale, permission-limited,
 * failed or insufficient-history data never renders as zero, healthy,
 * complete, empty or all clear. A quiet day and a broken provider are
 * visibly different worlds below, and the difference is in the data.
 */

import {
  HOME_FIXTURE_DST_NOW_ISO,
  HOME_FIXTURE_DST_TODAY,
  HOME_FIXTURE_NOW,
  HOME_FIXTURE_NOW_ISO,
  HOME_FIXTURE_TODAY,
} from "./clock";
import {
  ANALYTICS_SIGNATURE_CONTEXT,
  analyticsRowsForWorld,
  deriveClaims,
  deriveExceptions,
  deriveLedger,
  deriveTrend,
  resolveLens,
  SNAPSHOTS_AT_BASE,
  SNAPSHOTS_EARNED,
  SNAPSHOTS_SIGNATURE,
  type AnalyticsClaim,
  type AnalyticsRow,
  type ClaimContext,
} from "./analytics";
import {
  deriveBadge,
  HOME_INBOX_COLLABORATOR_STATES,
  HOME_INBOX_DISPLAY,
  HOME_INBOX_EVENTS,
  HOME_INBOX_GUEST_DISPLAY,
  HOME_INBOX_GUEST_STATES,
  HOME_INBOX_SCALE_DISPLAY,
  HOME_INBOX_SCALE_EVENTS,
  HOME_INBOX_SCALE_STATES,
  HOME_INBOX_STATES,
  visibilityResolver,
} from "./inbox";
import {
  MY_WORK_DST_ROWS,
  MY_WORK_FRAME,
  MY_WORK_FRAME_DST,
  MY_WORK_FRAME_UTC_FALLBACK,
  MY_WORK_QUIET_ROWS,
  MY_WORK_SCALE_ROWS,
  MY_WORK_SIGNATURE_ROWS,
  projectMyWork,
  type MyWorkProjection,
  type MyWorkRow,
  type MyWorkTimeFrame,
} from "./my-work";
import {
  HOME_FIXTURE_COLLABORATOR,
  HOME_FIXTURE_GUEST,
  HOME_FIXTURE_ORCHARD_PROJECT_IDS,
  HOME_FIXTURE_OWNER,
  HOME_FIXTURE_OWNER_PROJECT_IDS,
  HOME_FIXTURE_PROJECT_IDS,
  HOME_FIXTURE_SCALE_PROJECT_IDS,
  HOME_PROJECT_STATES_HEALTHY,
  HOME_PROJECT_STATES_PARTIAL,
  HOME_PROJECT_STATES_PROVIDER_FAILURE,
  HOME_PROJECT_STATES_REVOKED,
  HOME_PROJECT_STATES_STALE,
  type FixturePerson,
  type HomeProjectState,
} from "./projects";
import { rankToday, type TodayResult } from "./derive";
import {
  TODAY_DST_CANDIDATES,
  TODAY_GUEST_CANDIDATES,
  TODAY_NEW_USER_CANDIDATES,
  TODAY_QUIET_CANDIDATES,
  TODAY_SIGNATURE_CANDIDATES,
  TODAY_UNSUPPORTED_KINDS,
  type WorkSignal,
} from "./today";

// ── Modes and routes ────────────────────────────────────────────────────────

export const HOME_MODES = ["today", "inbox", "my-work", "analytics", "briefing"] as const;
export type HomeMode = (typeof HOME_MODES)[number];

export const HOME_ROUTES: Readonly<Record<HomeMode, string>> = Object.freeze({
  today: "/app/home",
  inbox: "/app/home/inbox",
  "my-work": "/app/home/my-work",
  analytics: "/app/home/analytics",
  briefing: "/app/home/briefing",
});

export const LAB_ROUTE = "/lab/home-operating-layer";

/** The four directions the Wave 3 lab builds. Labels stay neutral in review. */
export const LAB_DIRECTIONS = ["editorial-line", "context-rail", "reading-index", "signal-desk"] as const;
export type LabDirection = (typeof LAB_DIRECTIONS)[number];

// ── The thirteen ────────────────────────────────────────────────────────────

export const SCENARIO_IDS = [
  "owner_signature",
  "owner_quiet",
  "new_user",
  "collaborator_project",
  "guest_limited",
  "partial_coverage",
  "stale_data",
  "permission_changed",
  "provider_failure",
  "insufficient_history",
  "action_failure",
  "scale",
  "dst_boundary",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export type Scenario = Readonly<{
  id: ScenarioId;
  label: string;
  /** What this scenario exists to put on screen. One sentence. */
  proves: string;
  actor: FixturePerson;
  /** The authorized Project set for this world. */
  projects: readonly string[];
  /** Active Project — where a product link lands and a mutation targets. */
  activeProjectId: string | null;
  readScope: "current-project" | "planning-period" | "all-projects";
  planningPeriodId: string | null;
  /** Overlay. Neither axis. */
  lensProjectId: string | null;
  projectStates: readonly HomeProjectState[];
  todayCandidates: readonly WorkSignal[];
  /** Comparable daily snapshots available to the one trend. */
  comparableSnapshots: number;
  /** The pinned instant for THIS world. Only `dst_boundary` differs. */
  asOfIso: string;
  /** The single most important thing this world must not be allowed to say. */
  mustNeverRender: readonly string[];
}>;

const ORCHARD_PERIOD = "home-period-orchard-2026";

export const HOME_FIXTURE_SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "owner_signature",
    label: "Owner, a full day",
    proves:
      "The complete owner view: real attention, real events, real responsibility, and analytics that earned what they claim.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_SIGNATURE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["all clear", "nothing needs you", "you're on top of it"],
  },
  {
    id: "owner_quiet",
    label: "Owner, a quiet day",
    proves:
      "A genuinely quiet Today, an empty Inbox and light My work, with Analytics that stays honest instead of filling the space.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_QUIET_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: [
      // A quiet day is not a complete read. The calendar is still unseen.
      "everything is covered",
      "nothing to see",
    ],
  },
  {
    id: "new_user",
    label: "New, nothing yet",
    proves:
      "No Project, no history, and genuine setup and unsupported states rather than four empty boxes.",
    actor: HOME_FIXTURE_OWNER,
    projects: [],
    activeProjectId: null,
    readScope: "all-projects",
    planningPeriodId: null,
    lensProjectId: null,
    projectStates: [],
    todayCandidates: TODAY_NEW_USER_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["0 open", "all clear", "you're all caught up"],
  },
  {
    id: "collaborator_project",
    label: "Collaborator, one project",
    proves:
      "One selected Project and a narrower set of actions, with the narrowing visible rather than inferred from a role label.",
    actor: HOME_FIXTURE_COLLABORATOR,
    projects: [HOME_FIXTURE_PROJECT_IDS.noraCian],
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.noraCian,
    readScope: "current-project",
    planningPeriodId: null,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY.filter(
      (state) => state.projectId === HOME_FIXTURE_PROJECT_IDS.noraCian,
    ),
    todayCandidates: TODAY_SIGNATURE_CANDIDATES.filter(
      (signal) => signal.projectId === HOME_FIXTURE_PROJECT_IDS.noraCian,
    ),
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["Mara & Finn", "Aisling & Tom", "The Orchard"],
  },
  {
    id: "guest_limited",
    label: "Guest, limited",
    proves:
      "Permission-limited names, counts, evidence and mutations, each disclosed with its shortfall instead of quietly trimmed.",
    actor: HOME_FIXTURE_GUEST,
    projects: [HOME_FIXTURE_PROJECT_IDS.sineadRuairi],
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
    readScope: "current-project",
    planningPeriodId: null,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY.filter(
      (state) => state.projectId === HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
    ),
    todayCandidates: TODAY_GUEST_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["Éabha", "Niamh", "Orla"],
  },
  {
    id: "partial_coverage",
    label: "Partial coverage",
    proves:
      "One source answered for part of its scope. No false zero anywhere, and no reassurance offered in place of the missing part.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_PARTIAL,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["all clear", "complete", "0 in Aisling & Tom"],
  },
  {
    id: "stale_data",
    label: "Stale read",
    proves:
      "Data past its freshness threshold, described by when it was last read rather than as current.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_STALE,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["up to date", "just now", "live"],
  },
  {
    id: "permission_changed",
    label: "Permission revoked mid-session",
    proves:
      "A Project visible in the list is revoked before the detail read, and not one byte of its metadata survives the transition.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_OWNER_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
    readScope: "all-projects",
    planningPeriodId: null,
    lensProjectId: HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
    projectStates: HOME_PROJECT_STATES_REVOKED,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: [
      "Sinéad & Ruairí",
      "Dromoland",
      "you do not have permission",
      "forbidden",
      "deleted",
    ],
  },
  {
    id: "provider_failure",
    label: "One provider down",
    proves:
      "One Project could not be read at all while the others stay truthful. Never a global outage, and never a zero.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_PROVIDER_FAILURE,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES.filter(
      (signal) => signal.projectId !== HOME_FIXTURE_PROJECT_IDS.noraCian,
    ),
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["0 in Nora & Cian", "Nora & Cian is clear", "all clear"],
  },
  {
    id: "insufficient_history",
    label: "No earned trend",
    proves:
      "No trend is drawn, no flat line, no single point, no greyed axis. The words, the gap and the earliest possible date instead.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["no change", "flat", "steady", "0% change"],
  },
  {
    id: "action_failure",
    label: "A source action fails",
    proves:
      "A source mutation is refused, the event stays open, the optimistic UI rolls back visibly, and recovery is offered.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "all-projects",
    planningPeriodId: null,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["Approved", "Done", "Saved"],
  },
  {
    id: "scale",
    label: "Eighteen projects",
    proves:
      "Eighteen Projects, fifty grouped events, sixty responsibilities, long and translated names, and pagination that stays stable.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_SCALE_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "all-projects",
    planningPeriodId: null,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_SIGNATURE_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_EARNED,
    asOfIso: HOME_FIXTURE_NOW_ISO,
    mustNeverRender: ["and 43 more", "…"],
  },
  {
    id: "dst_boundary",
    label: "The clocks go back",
    proves:
      "Date grouping and snooze resurfacing across a Europe/London clock change, on the one night a fixed millisecond offset is wrong.",
    actor: HOME_FIXTURE_OWNER,
    projects: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    activeProjectId: HOME_FIXTURE_PROJECT_IDS.maraFinn,
    readScope: "planning-period",
    planningPeriodId: ORCHARD_PERIOD,
    lensProjectId: null,
    projectStates: HOME_PROJECT_STATES_HEALTHY,
    todayCandidates: TODAY_DST_CANDIDATES,
    comparableSnapshots: SNAPSHOTS_AT_BASE,
    asOfIso: HOME_FIXTURE_DST_NOW_ISO,
    mustNeverRender: ["25 hours", "24 hours from now"],
  },
]);

export function scenario(id: ScenarioId): Scenario {
  const found = HOME_FIXTURE_SCENARIOS.find((entry) => entry.id === id);
  if (!found) throw new Error(`home-fixtures/scenarios: unknown scenario ${id}`);
  return found;
}

// ── URLs ────────────────────────────────────────────────────────────────────

/**
 * The lab URL for one (direction, mode, scenario). Serialised through one
 * builder in a fixed parameter order, so the same world always produces the
 * same string and a capture filename is stable across runs.
 */
export function labUrl(
  direction: LabDirection,
  mode: HomeMode,
  id: ScenarioId,
): string {
  const world = scenario(id);
  const params = new URLSearchParams();
  params.set("direction", direction);
  params.set("mode", mode);
  params.set("scenario", id);
  params.set(
    "homeScope",
    world.readScope === "current-project"
      ? "project"
      : world.readScope === "planning-period"
        ? "planning-period"
        : "all",
  );
  if (world.planningPeriodId) params.set("planningPeriodId", world.planningPeriodId);
  if (world.activeProjectId) params.set("workspaceId", world.activeProjectId);
  if (world.lensProjectId) params.set("lensProjectId", world.lensProjectId);
  return `${LAB_ROUTE}?${params.toString()}`;
}

/** The production Home URL the same world maps to, once Wave 4 lands. */
export function homeUrl(mode: HomeMode, id: ScenarioId): string {
  const world = scenario(id);
  const params = new URLSearchParams();
  params.set(
    "homeScope",
    world.readScope === "current-project"
      ? "project"
      : world.readScope === "planning-period"
        ? "planning-period"
        : "all",
  );
  if (world.planningPeriodId) params.set("planningPeriodId", world.planningPeriodId);
  if (world.activeProjectId) params.set("workspaceId", world.activeProjectId);
  if (world.lensProjectId) params.set("lensProjectId", world.lensProjectId);
  return `${HOME_ROUTES[mode]}?${params.toString()}`;
}

// ── Per-world data selection ────────────────────────────────────────────────

/**
 * Which Inbox rows, My work rows and time frame each world reads. This is a
 * SELECTION, never a transformation: every world reads a named set that was
 * authored for it, so "the quiet day" is genuinely different data rather than
 * the signature data with a filter over it. A filtered signature set would
 * make a quiet day and a broken provider indistinguishable in the fixture,
 * which is the exact confusion the governing rule forbids on screen.
 */
function worldData(id: ScenarioId, world: Scenario) {
  const inboxFor = (workspaceIds: readonly string[]) =>
    HOME_INBOX_EVENTS.filter((row) => workspaceIds.includes(row.workspaceId));

  switch (id) {
    case "owner_quiet":
      return {
        events: [] as typeof HOME_INBOX_EVENTS,
        states: [] as typeof HOME_INBOX_STATES,
        display: HOME_INBOX_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_QUIET_ROWS as readonly MyWorkRow[],
        frame: MY_WORK_FRAME as MyWorkTimeFrame,
        badgeRendered: true,
      };
    case "new_user":
      return {
        events: [] as typeof HOME_INBOX_EVENTS,
        states: [] as typeof HOME_INBOX_STATES,
        display: HOME_INBOX_DISPLAY,
        recipientUserId: world.actor.id,
        rows: [] as readonly MyWorkRow[],
        frame: MY_WORK_FRAME_UTC_FALLBACK as MyWorkTimeFrame,
        // With no Project there is nothing for a badge to be a count OF.
        // Rendering `0` would be a claim about an inbox that does not exist.
        badgeRendered: false,
      };
    case "collaborator_project":
      return {
        events: inboxFor(world.projects),
        states: HOME_INBOX_COLLABORATOR_STATES,
        display: HOME_INBOX_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_SIGNATURE_ROWS.filter((row) =>
          world.projects.includes(row.workspaceId),
        ),
        frame: MY_WORK_FRAME as MyWorkTimeFrame,
        badgeRendered: true,
      };
    case "guest_limited":
      return {
        events: inboxFor(world.projects),
        states: HOME_INBOX_GUEST_STATES,
        display: HOME_INBOX_GUEST_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_SIGNATURE_ROWS.filter((row) =>
          world.projects.includes(row.workspaceId),
        ),
        frame: MY_WORK_FRAME as MyWorkTimeFrame,
        badgeRendered: true,
      };
    case "scale":
      return {
        events: HOME_INBOX_SCALE_EVENTS,
        states: HOME_INBOX_SCALE_STATES,
        display: HOME_INBOX_SCALE_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_SCALE_ROWS as readonly MyWorkRow[],
        frame: MY_WORK_FRAME as MyWorkTimeFrame,
        badgeRendered: true,
      };
    case "dst_boundary":
      return {
        events: HOME_INBOX_EVENTS,
        states: HOME_INBOX_STATES,
        display: HOME_INBOX_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_DST_ROWS as readonly MyWorkRow[],
        frame: MY_WORK_FRAME_DST as MyWorkTimeFrame,
        badgeRendered: true,
      };
    default:
      return {
        events: HOME_INBOX_EVENTS,
        states: HOME_INBOX_STATES,
        display: HOME_INBOX_DISPLAY,
        recipientUserId: world.actor.id,
        rows: MY_WORK_SIGNATURE_ROWS as readonly MyWorkRow[],
        frame: MY_WORK_FRAME as MyWorkTimeFrame,
        badgeRendered: true,
      };
  }
}

// ── The composed world ──────────────────────────────────────────────────────

export type HomeFixtureWorld = Readonly<{
  scenario: Scenario;
  today: TodayResult;
  badge: ReturnType<typeof deriveBadge>;
  /** False when there is no Project for the badge to be a count of. */
  badgeRendered: boolean;
  myWork: MyWorkProjection;
  /**
   * The Analytics projection of THIS world's own source records. Not a
   * separate population: every row is one of the records Today ranked or My
   * work listed, under the same id (charter rule 6).
   */
  analyticsRows: readonly AnalyticsRow[];
  claims: readonly AnalyticsClaim[];
  exceptions: ReturnType<typeof deriveExceptions>;
  ledger: ReturnType<typeof deriveLedger>;
  trend: ReturnType<typeof deriveTrend>;
  lens: ReturnType<typeof resolveLens>;
}>;

/**
 * One pure function from a scenario id to everything the five modes render.
 * No argument beyond the id, no clock, no environment. Call it twice and the
 * two results are deep-equal — asserted by `determinism.test.ts`.
 */
export function homeFixtureWorld(id: ScenarioId): HomeFixtureWorld {
  const world = scenario(id);
  const statuses = world.projectStates.map((state) => state.sourceStatus);
  const unresolvedProjects = world.projectStates
    .filter((state) => state.routeState === "unavailable")
    .map((state) => state.projectId);
  const readableProjects = world.projects.filter(
    (projectId) => !unresolvedProjects.includes(projectId),
  );

  /** A world with no Project state has no provider that answered at all. */
  const providerStatuses = statuses.length > 0 ? statuses : ["unsupported"];

  const today = rankToday({
    candidates: world.todayCandidates,
    asOfIso: world.asOfIso,
    today: id === "dst_boundary" ? HOME_FIXTURE_DST_TODAY : undefined,
    coverage: {
      providerStatuses,
      projectsUnresolved: unresolvedProjects.length,
      unsupportedKinds: TODAY_UNSUPPORTED_KINDS.map((entry) => entry.kind),
      historyIsEmpty: world.comparableSnapshots === 0,
      scopeProjectCount: readableProjects.length,
      /**
       * TODAY_RANKING §6, last paragraph, read literally: a term that cannot
       * be computed "because a provider is `unavailable`, `partial` or
       * `unsupported`" withholds the WHOLE accounting. A partial provider
       * answered for part of its scope, so `read` is not a count of the
       * scope — and a `read` that silently means "some of it" is the exact
       * false denominator §6 exists to refuse. `stale` is not on that list
       * and does not withhold: a stale read is complete and old, and §7 asks
       * for its age in words instead.
       */
      accountingComputable: providerStatuses.every(
        (status) => status === "ready" || status === "stale",
      ),
    },
  });

  const data = worldData(id, world);
  const badge = deriveBadge({
    events: data.events,
    states: data.states,
    recipientUserId: data.recipientUserId,
    now: id === "dst_boundary" ? Date.parse(HOME_FIXTURE_DST_NOW_ISO) : HOME_FIXTURE_NOW,
    liveProjectIds: readableProjects,
    unreadableProjectCount: unresolvedProjects.length,
    visibilityOf: visibilityResolver(data.display),
  });

  const myWork = projectMyWork({
    rows: data.rows,
    frame: data.frame,
    projectsAuthorized: world.projects,
    projectsUnresolved: unresolvedProjects,
    unprojectableExcluded: id === "new_user" ? 0 : 1,
    pageSize: id === "scale" ? 25 : undefined,
  });

  /**
   * ONE population per world, read by all three counting surfaces. Today
   * ranks it, My work projects the actor's slice of it, and Analytics counts
   * it — so a reviewer who switches modes stays inside one world instead of
   * being handed a second, unfalsifiable one.
   */
  const analyticsRows = analyticsRowsForWorld({
    todayCandidates: world.todayCandidates,
    myWorkRows: data.rows,
    today: id === "dst_boundary" ? HOME_FIXTURE_DST_TODAY : HOME_FIXTURE_TODAY,
  });

  const claimContext: ClaimContext = Object.freeze({
    ...ANALYTICS_SIGNATURE_CONTEXT,
    readScope: world.readScope,
    projects: readableProjects,
    asOfIso: world.asOfIso,
    rows: analyticsRows,
    unresolved: unresolvedProjects.length,
    coverageStatus: statuses.includes("unavailable")
      ? "unavailable"
      : statuses.includes("stale")
        ? "stale"
        : statuses.includes("partial")
          ? "partial"
          : statuses.length === 0
            ? "unsupported"
            : "ready",
    coverageIssues: Object.freeze([
      ...new Set(world.projectStates.flatMap((state) => state.issues)),
    ]),
    timezoneSource: id === "new_user" ? "utc_fallback" : "user_setting",
    comparableSnapshots: world.comparableSnapshots,
  });

  return Object.freeze({
    scenario: world,
    today,
    badge,
    badgeRendered: data.badgeRendered,
    myWork,
    analyticsRows,
    claims: deriveClaims(claimContext),
    exceptions: deriveExceptions(claimContext),
    ledger: deriveLedger({
      projects: world.projects,
      unresolved: unresolvedProjects,
      rows: analyticsRows,
      asOfIso: world.asOfIso,
    }),
    trend: deriveTrend(world.comparableSnapshots, world.asOfIso),
    lens: resolveLens(world.lensProjectId, readableProjects),
  });
}

/** Every (direction, mode, scenario) triple the lab must be able to render. */
export function labMatrix(): readonly Readonly<{
  direction: LabDirection;
  mode: HomeMode;
  scenario: ScenarioId;
  url: string;
}>[] {
  return Object.freeze(
    LAB_DIRECTIONS.flatMap((direction) =>
      HOME_MODES.flatMap((mode) =>
        SCENARIO_IDS.map((id) =>
          Object.freeze({ direction, mode, scenario: id, url: labUrl(direction, mode, id) }),
        ),
      ),
    ),
  );
}

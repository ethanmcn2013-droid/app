/**
 * WP0 · The deterministic multi-Project truth fixture.
 *
 * One story, fourteen Projects, told once so every Active Project surface —
 * the WP5 design lab, the WP6 selector, and the browser journeys in
 * `experience/feature-tests/project-switch-journeys.spec.ts` — argues from the
 * same data instead of inventing its own.
 *
 * WHY THIS EXISTS. `src/lib/review-suite-fixture.ts` proves the opposite
 * shape: ONE Project (`demo-ws` / `the-orchard`) with three Timeline-local
 * children. That proves Timeline-child switching. It cannot prove an A/B
 * Tasks Project journey, which is the whole point of this wave
 * (`docs/wave/DECISIONS.md` D-009). This file is additive: the review-suite
 * fixture is untouched and still owns the demo/review surfaces.
 *
 * TYPES ARE LOCAL AND TEMPORARY. WP2 owns the real `ProjectId`,
 * `ProjectSummary` and `ProjectCapabilities` in `src/lib/projects/**` and
 * `src/server/projects/**`. The types below mirror ADR 0001 §3 and the plan's
 * §5 catalog shape so the fixture is already in the right shape, but they are
 * declared here on purpose — WP2's types supersede these, and this file should
 * be re-pointed at them (not duplicated) the moment they land.
 *
 * Like the review-suite fixture, this file carries identifiers and
 * presentation facts only: no auth, no database, no framework imports.
 * Production access still resolves through the normal membership checks — a
 * fixture never grants anything.
 */

import type { PlanningPeriodContext } from "./planning/context";

/**
 * One review clock, shared with the review suite. This MUST equal
 * PINNED_REVIEW_CALENDAR_FRAME.today (src/lib/calendar-frame.ts) and
 * REVIEW_SUITE_FIXTURE.reviewToday, or this fixture's Projects read as
 * overdue against the pinned today the rest of the suite renders.
 * Guarded by a drift test in `src/lib/project-truth-fixture.test.ts`.
 */
export const PROJECT_TRUTH_TODAY = "2026-07-16";

/** The single actor every scenario below is told from. */
export const PROJECT_TRUTH_ACTOR = {
  id: "truth-user",
  name: "Orla",
} as const;

// ── Types (WP2 supersedes: see the file header) ─────────────────────────────

/**
 * ADR 0001 §3 brands this as `Brand<string, "TasksWorkspaceId">`. A fixture
 * cannot import that brand without coupling to WP2's unmerged module, so the
 * alias is nominal-in-name only here. WP2 replaces it with the real brand.
 */
export type FixtureProjectId = string;

export type FixtureProjectRole = "primary-owner" | "owner" | "member";

/**
 * The eight rows of the plan's §5 capability table, one field each, so a
 * fixture Project can never imply an action its role does not have.
 */
export type FixtureProjectCapabilities = Readonly<{
  openProject: boolean;
  viewPrivateTimeline: boolean;
  editTasks: boolean;
  manageProject: boolean;
  moveIntoPlanningPeriod: boolean;
  curatePrimaryTimeline: boolean;
  publishTimeline: boolean;
  deleteOrTransferOwnership: boolean;
}>;

export type FixturePlanningPeriod = Readonly<{
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  contextType: PlanningPeriodContext;
}>;

/** Mirrors the plan §5 / ADR §3 `ProjectSummary` field for field. */
export type FixtureProjectSummary = Readonly<{
  id: FixtureProjectId;
  slug: string;
  name: string;
  role: FixtureProjectRole;
  capabilities: FixtureProjectCapabilities;
  planningPeriod: FixturePlanningPeriod | null;
  position: number;
  revision: number;
  archivedAt: number | null;
  activeRootTaskCount: number;
  disambiguator: string | null;
}>;

/**
 * Timeline readiness per Project. ADR §6: one Project binds to one hidden
 * Timeline workspace with one primary Timeline; extra children are manual and
 * never Projects.
 */
export type FixtureTimelineState =
  | "ready"
  | "empty"
  | "absent"
  | "legacy-multiple"
  | "archived";

/** Which catalog group the plan's §5 rules should place this Project in. */
export type FixtureCatalogGroup = "period" | "loose" | "shared" | "archived";

/** Deliberate layout stress carried by a Project's name. */
export type FixtureLayoutStress = "none" | "long" | "diacritics" | "cjk";

/**
 * The visible half of the fixture: what a correct render of this Project puts
 * on screen. `distinctWord` is the load-bearing field — it appears in this
 * Project's own copy and in no other Project's, so a wrong-Project render is
 * a failed string assertion rather than a subtle judgement call.
 */
export type FixtureProjectContent = Readonly<{
  projectId: FixtureProjectId;
  distinctWord: string;
  headline: string;
  rootTaskTitles: readonly string[];
  timelineState: FixtureTimelineState;
  timelineSlugs: readonly string[];
  expectedGroup: FixtureCatalogGroup;
  layoutStress: FixtureLayoutStress;
}>;

// ── Capability derivation ───────────────────────────────────────────────────

/**
 * The plan's §5 capability table, expressed once. Archived collapses every
 * Project-scoped write to false per ADR §5 (read-only, no new publishing)
 * while leaving the Project openable through an explicit link.
 */
export function fixtureCapabilitiesFor(
  role: FixtureProjectRole,
  options: { archived: boolean } = { archived: false },
): FixtureProjectCapabilities {
  const primaryOwner = role === "primary-owner";
  const coOwner = role === "owner";
  const manages = primaryOwner || coOwner;
  const live = !options.archived;
  return Object.freeze({
    openProject: true,
    viewPrivateTimeline: true,
    editTasks: live,
    manageProject: manages && live,
    // A co-owner may only move a Project into a period they own or manage;
    // the fixture's co-owned Project is loose, so this stays primary-owner.
    moveIntoPlanningPeriod: primaryOwner && live,
    curatePrimaryTimeline: manages && live,
    publishTimeline: manages && live,
    deleteOrTransferOwnership: primaryOwner,
  });
}

// ── Planning Periods ────────────────────────────────────────────────────────

export const PROJECT_TRUTH_PERIOD_SEASON_2026: FixturePlanningPeriod =
  Object.freeze({
    id: "truth-period-season-2026",
    name: "2026 wedding season",
    startDate: "2026-04-01",
    // Spans PROJECT_TRUTH_TODAY, so this period is the current one.
    endDate: "2026-10-31",
    contextType: "wedding_season",
  });

export const PROJECT_TRUTH_PERIOD_SEASON_2027: FixturePlanningPeriod =
  Object.freeze({
    id: "truth-period-season-2027",
    name: "2027 wedding season",
    startDate: "2027-04-01",
    endDate: "2027-10-31",
    contextType: "wedding_season",
  });

export const PROJECT_TRUTH_PERIOD_CORPORATE_2026: FixturePlanningPeriod =
  Object.freeze({
    id: "truth-period-corporate-2026",
    name: "Corporate autumn 2026",
    startDate: "2026-09-01",
    endDate: "2026-12-20",
    contextType: "general",
  });

export const PROJECT_TRUTH_PERIODS: readonly FixturePlanningPeriod[] =
  Object.freeze([
    PROJECT_TRUTH_PERIOD_SEASON_2026,
    PROJECT_TRUTH_PERIOD_SEASON_2027,
    PROJECT_TRUTH_PERIOD_CORPORATE_2026,
  ]);

// ── Project ids ─────────────────────────────────────────────────────────────

export const PROJECT_TRUTH_IDS = {
  /** A — owner, the reference Project. */
  harbourHouse: "truth-ws-harbour-house",
  /** B — owner, deliberately unmistakable beside A. */
  saltmarshBarn: "truth-ws-saltmarsh-barn",
  autumnShowcase2026: "truth-ws-autumn-showcase-2026",
  /** D — archived. */
  cliffWalk: "truth-ws-cliff-walk-hotel",
  autumnShowcase2027: "truth-ws-autumn-showcase-2027",
  coastguardStation: "truth-ws-coastguard-station",
  bainisUiChonchuir: "truth-ws-bainis-ui-chonchuir",
  kilbegOffsite: "truth-ws-kilbeg-offsite",
  akiKigyoGasshuku: "truth-ws-aki-kigyo-gasshuku",
  betriebsversammlung: "truth-ws-betriebsversammlung",
  rosewalkTrial: "truth-ws-rosewalk-trial",
  clonmelHouse: "truth-ws-clonmel-house",
  /** C — the actor is a member here, not an owner. */
  riversideRooms: "truth-ws-riverside-rooms",
  glenveaghLodge: "truth-ws-glenveagh-lodge",
} as const;

/**
 * A well-formed Project id the actor has no membership of. Requesting it must
 * produce ADR §3's neutral `unavailable` — never a substitute Project, and
 * never a hint that it exists (ADR §4: an existence leak is a privacy defect).
 */
export const PROJECT_TRUTH_INACCESSIBLE_ID: FixtureProjectId =
  "truth-ws-not-yours";

/**
 * A Project id that is not even shape-valid. Distinct from the inaccessible
 * id because the resolver rejects it earlier — both must collapse to the same
 * neutral state on the client.
 */
export const PROJECT_TRUTH_MALFORMED_ID = "../../etc/passwd";

// 2026-05-02T09:00:00.000Z — comfortably before PROJECT_TRUTH_TODAY, so the
// archived Project reads as archived rather than as a future event.
const CLIFF_WALK_ARCHIVED_AT = Date.UTC(2026, 4, 2, 9, 0, 0);

// ── The Projects ────────────────────────────────────────────────────────────

export const PROJECT_TRUTH_PROJECTS: readonly FixtureProjectSummary[] =
  Object.freeze([
    {
      id: PROJECT_TRUTH_IDS.harbourHouse,
      slug: "harbour-house",
      name: "Harbour House weddings",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2026,
      position: 1,
      revision: 7,
      archivedAt: null,
      activeRootTaskCount: 9,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.saltmarshBarn,
      slug: "saltmarsh-barn",
      name: "Saltmarsh Barn weddings",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2026,
      position: 2,
      revision: 4,
      archivedAt: null,
      // Deliberately a different count from A: a wrong-Project render shows a
      // wrong number as well as wrong words.
      activeRootTaskCount: 3,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.autumnShowcase2026,
      slug: "autumn-showcase",
      name: "Autumn showcase",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2026,
      position: 3,
      revision: 2,
      archivedAt: null,
      activeRootTaskCount: 5,
      // Same name as the 2027 Project below. The period is the permission-safe
      // disambiguator: the actor owns both, so naming it leaks nothing.
      disambiguator: "2026 wedding season",
    },
    {
      id: PROJECT_TRUTH_IDS.cliffWalk,
      slug: "cliff-walk-hotel",
      name: "Cliff Walk Hotel weddings",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner", { archived: true }),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2026,
      position: 4,
      revision: 11,
      archivedAt: CLIFF_WALK_ARCHIVED_AT,
      activeRootTaskCount: 0,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.autumnShowcase2027,
      slug: "autumn-showcase-2027",
      name: "Autumn showcase",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2027,
      position: 1,
      revision: 1,
      archivedAt: null,
      activeRootTaskCount: 0,
      disambiguator: "2027 wedding season",
    },
    {
      id: PROJECT_TRUTH_IDS.coastguardStation,
      slug: "old-coastguard-station",
      name:
        "The Old Coastguard Station at Ballynagaul — full-day wedding " +
        "coordination including the pier crossing and the Sunday brunch",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2027,
      position: 2,
      revision: 3,
      archivedAt: null,
      activeRootTaskCount: 12,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.bainisUiChonchuir,
      slug: "bainis-ui-chonchuir",
      name: "Bainis Uí Chonchúir · Cóisir na Samhna",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_SEASON_2027,
      position: 3,
      revision: 2,
      archivedAt: null,
      activeRootTaskCount: 4,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.kilbegOffsite,
      slug: "kilbeg-group-offsite",
      name: "Kilbeg Group offsite",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_CORPORATE_2026,
      position: 1,
      revision: 5,
      archivedAt: null,
      activeRootTaskCount: 6,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.akiKigyoGasshuku,
      slug: "aki-kigyo-gasshuku",
      name: "秋季企業合宿 · 海辺の懇親会",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_CORPORATE_2026,
      position: 2,
      revision: 1,
      archivedAt: null,
      activeRootTaskCount: 2,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.betriebsversammlung,
      slug: "betriebsversammlung-ballybunion",
      name: "Betriebsversammlung und Jahresabschlussfeier Ballybunion",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: PROJECT_TRUTH_PERIOD_CORPORATE_2026,
      position: 3,
      revision: 2,
      archivedAt: null,
      activeRootTaskCount: 3,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.rosewalkTrial,
      slug: "rosewalk-ceremony-trial",
      name: "Rosewalk ceremony trial",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      // Loose: belongs to no Planning Period.
      planningPeriod: null,
      position: 1,
      revision: 1,
      archivedAt: null,
      activeRootTaskCount: 2,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.clonmelHouse,
      slug: "clonmel-house",
      name: "Clonmel House weddings (2024)",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: null,
      position: 2,
      revision: 9,
      archivedAt: null,
      activeRootTaskCount: 1,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.riversideRooms,
      slug: "riverside-rooms",
      name: "Riverside Rooms weddings",
      role: "member",
      capabilities: fixtureCapabilitiesFor("member"),
      // Never expose another owner's Planning Period to a shared member
      // (plan §5). Shared Projects carry no period and group under
      // "Shared with you".
      planningPeriod: null,
      position: 1,
      revision: 6,
      archivedAt: null,
      activeRootTaskCount: 8,
      disambiguator: null,
    },
    {
      id: PROJECT_TRUTH_IDS.glenveaghLodge,
      slug: "glenveagh-lodge",
      name: "Glenveagh Lodge weddings",
      // The existing membership value `role = "owner"` is the co-owner:
      // reversible management after a fresh server check, but never permanent
      // delete or ownership transfer (plan §5, WP0 codification).
      role: "owner",
      capabilities: fixtureCapabilitiesFor("owner"),
      planningPeriod: null,
      position: 2,
      revision: 2,
      archivedAt: null,
      activeRootTaskCount: 4,
      disambiguator: null,
    },
  ]);

// ── Visible content, one record per Project ─────────────────────────────────

export const PROJECT_TRUTH_CONTENT: readonly FixtureProjectContent[] =
  Object.freeze([
    {
      projectId: PROJECT_TRUTH_IDS.harbourHouse,
      distinctWord: "Harbour",
      headline: "Harbour House, the pier ceremony and the late boat back.",
      rootTaskTitles: [
        "Confirm the Harbour wall cordon with the harbourmaster",
        "Book the pier lighting for the ceremony hour",
        "Agree the late boat return time with the skipper",
      ],
      timelineState: "ready",
      timelineSlugs: ["harbour-house"],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.saltmarshBarn,
      distinctWord: "Saltmarsh",
      headline: "Saltmarsh Barn, a hay-loft ceremony and a long table inside.",
      rootTaskTitles: [
        "Sweep the Saltmarsh hay loft before the rehearsal",
        "Order the long-table linen",
      ],
      timelineState: "ready",
      timelineSlugs: ["saltmarsh-barn"],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.autumnShowcase2026,
      distinctWord: "Michaelmas",
      headline: "The Michaelmas open evening for couples booking next season.",
      rootTaskTitles: ["Print the Michaelmas invitation cards"],
      timelineState: "empty",
      timelineSlugs: ["autumn-showcase"],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.cliffWalk,
      distinctWord: "Clifftop",
      headline: "Clifftop weddings, closed after the hotel changed hands.",
      rootTaskTitles: [],
      timelineState: "archived",
      timelineSlugs: ["cliff-walk-hotel"],
      expectedGroup: "archived",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.autumnShowcase2027,
      distinctWord: "Lughnasa",
      headline: "Next year's Lughnasa showcase, nothing planned yet.",
      rootTaskTitles: [],
      // Deliberately unprepared: no Timeline exists for this Project.
      timelineState: "absent",
      timelineSlugs: [],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.coastguardStation,
      distinctWord: "Ballynagaul",
      headline:
        "Ballynagaul, a full day that starts at the station and ends at " +
        "Sunday brunch.",
      rootTaskTitles: [
        "Walk the Ballynagaul pier crossing at high tide",
        "Confirm the Sunday brunch covers",
      ],
      timelineState: "ready",
      timelineSlugs: ["old-coastguard-station"],
      expectedGroup: "period",
      layoutStress: "long",
    },
    {
      projectId: PROJECT_TRUTH_IDS.bainisUiChonchuir,
      distinctWord: "Chonchúir",
      headline: "Bainis Uí Chonchúir, an Irish-language ceremony in November.",
      rootTaskTitles: ["Cuir an ceol tráthnóna in áirithe"],
      timelineState: "empty",
      timelineSlugs: ["bainis-ui-chonchuir"],
      expectedGroup: "period",
      layoutStress: "diacritics",
    },
    {
      projectId: PROJECT_TRUTH_IDS.kilbegOffsite,
      distinctWord: "Kilbeg",
      headline: "The Kilbeg Group offsite, two nights and a closing dinner.",
      rootTaskTitles: [
        "Hold the Kilbeg meeting room for both mornings",
        "Confirm the closing dinner numbers",
      ],
      timelineState: "ready",
      timelineSlugs: ["kilbeg-group-offsite"],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.akiKigyoGasshuku,
      distinctWord: "懇親会",
      headline: "秋季企業合宿。海辺の懇親会と朝の散歩。",
      rootTaskTitles: ["懇親会の席次を決める"],
      timelineState: "absent",
      timelineSlugs: [],
      expectedGroup: "period",
      layoutStress: "cjk",
    },
    {
      projectId: PROJECT_TRUTH_IDS.betriebsversammlung,
      distinctWord: "Jahresabschlussfeier",
      headline:
        "Betriebsversammlung am Nachmittag, Jahresabschlussfeier am Abend.",
      rootTaskTitles: ["Jahresabschlussfeier: Menü bestätigen"],
      timelineState: "empty",
      timelineSlugs: ["betriebsversammlung-ballybunion"],
      expectedGroup: "period",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.rosewalkTrial,
      distinctWord: "Rosewalk",
      headline: "A Rosewalk ceremony trial before we offer it to couples.",
      rootTaskTitles: ["Set the Rosewalk chairs for forty"],
      timelineState: "empty",
      timelineSlugs: ["rosewalk-ceremony-trial"],
      expectedGroup: "loose",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.clonmelHouse,
      distinctWord: "Clonmel",
      headline: "Clonmel House, kept for the 2024 records and the old links.",
      rootTaskTitles: ["Keep the Clonmel guest list until the album ships"],
      // The legacy shape ADR §6 refuses to treat as Projects: one hidden
      // Timeline workspace holding several children, one of them unclaimed.
      timelineState: "legacy-multiple",
      timelineSlugs: [
        "clonmel-house",
        "clonmel-house-2024",
        "clonmel-house-drafts",
      ],
      expectedGroup: "loose",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.riversideRooms,
      distinctWord: "Riverside",
      headline: "Riverside Rooms, shared with you by another planner.",
      rootTaskTitles: [
        "Check the Riverside chair count against the plan",
        "Send the supplier list back to the owner",
      ],
      timelineState: "ready",
      timelineSlugs: ["riverside-rooms"],
      expectedGroup: "shared",
      layoutStress: "none",
    },
    {
      projectId: PROJECT_TRUTH_IDS.glenveaghLodge,
      distinctWord: "Glenveagh",
      headline: "Glenveagh Lodge, shared with you as a co-owner.",
      rootTaskTitles: ["Approve the Glenveagh running order"],
      timelineState: "ready",
      timelineSlugs: ["glenveagh-lodge"],
      expectedGroup: "shared",
      layoutStress: "none",
    },
  ]);

// ── Named Projects the journeys argue from ──────────────────────────────────

function projectById(id: FixtureProjectId): FixtureProjectSummary {
  const found = PROJECT_TRUTH_PROJECTS.find((project) => project.id === id);
  if (!found) throw new Error(`project-truth-fixture: unknown Project ${id}`);
  return found;
}

export function projectTruthContentFor(
  id: FixtureProjectId,
): FixtureProjectContent {
  const found = PROJECT_TRUTH_CONTENT.find((entry) => entry.projectId === id);
  if (!found) throw new Error(`project-truth-fixture: no content for ${id}`);
  return found;
}

/** A — the Project a journey starts in. */
export const PROJECT_TRUTH_A = projectById(PROJECT_TRUTH_IDS.harbourHouse);
/** B — the Project a journey switches to. Visibly nothing like A. */
export const PROJECT_TRUTH_B = projectById(PROJECT_TRUTH_IDS.saltmarshBarn);
/** C — the actor is a member here, not an owner. */
export const PROJECT_TRUTH_C = projectById(PROJECT_TRUTH_IDS.riversideRooms);
/** D — archived, openable read-only through an explicit link (ADR §5). */
export const PROJECT_TRUTH_D = projectById(PROJECT_TRUTH_IDS.cliffWalk);

// ── Selectable scenarios ────────────────────────────────────────────────────

export type FixtureScenarioId = "zero-projects" | "one-project" | "full-catalog";

export type FixtureScenario = Readonly<{
  id: FixtureScenarioId;
  label: string;
  /** What this scenario exists to put on screen. */
  proves: string;
  projectIds: readonly FixtureProjectId[];
}>;

/**
 * Three separately selectable worlds. Zero and one are not edge cases of the
 * full catalog — they are different surfaces (plan §7.4: with no Projects
 * Tasks creates the first one; with one, the receipt stays visible and the
 * chooser still opens), so they are selected, not derived.
 */
export const PROJECT_TRUTH_SCENARIOS: readonly FixtureScenario[] = Object.freeze(
  [
    {
      id: "zero-projects",
      label: "No projects",
      proves:
        "Tasks offers to create the first Project, Timeline points at Tasks, " +
        "and Notes keeps capturing privately.",
      projectIds: [],
    },
    {
      id: "one-project",
      label: "One project",
      proves:
        "The context receipt stays visible and the chooser still opens for " +
        "management with nothing to switch to.",
      projectIds: [PROJECT_TRUTH_IDS.harbourHouse],
    },
    {
      id: "full-catalog",
      label: "Fourteen projects",
      proves:
        "Three planning periods, loose and shared groups, duplicate names, " +
        "long and translated names, and one archived project.",
      projectIds: PROJECT_TRUTH_PROJECTS.map((project) => project.id),
    },
  ],
);

export function projectTruthScenario(id: FixtureScenarioId): FixtureScenario {
  const found = PROJECT_TRUTH_SCENARIOS.find((scenario) => scenario.id === id);
  if (!found) throw new Error(`project-truth-fixture: unknown scenario ${id}`);
  return found;
}

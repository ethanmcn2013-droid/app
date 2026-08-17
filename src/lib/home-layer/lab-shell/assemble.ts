/**
 * The shared server-side data assembly.
 *
 * ONE read of the fixture universe, on the server, producing ONE
 * `HomeCandidateProps`. All four directions receive the object this file
 * returns, byte for byte. That is the mechanism behind the fairness rule: if
 * two directions render different counts, different provenance or different
 * words, one of them read something it was not handed, and the contract test
 * that walks the lab's import graph is where that shows up.
 *
 * THREE THINGS THIS FILE IS CAREFUL ABOUT.
 *
 * 1. It never types a number. Every count is derived by the fixture universe's
 *    own functions — `rankToday`, `deriveBadge`, `projectMyWork`,
 *    `deriveClaims`, `deriveLedger`, `deriveTrend` — and this file formats
 *    what they return. A plausible number is the most expensive thing a
 *    review surface can render.
 *
 * 2. Read Scope is real. A reviewer who changes `homeScope` gets a genuinely
 *    narrower read, re-derived through the same functions with a narrower
 *    Project set, not the same screen with a different label. Where a term
 *    cannot be re-derived under a narrowed scope, it is WITHHELD with a
 *    sentence saying so, never estimated.
 *
 * 3. Unknown stays unknown. Missing, incomplete, unsupported, stale,
 *    permission-limited, failed and insufficient-history data reach the
 *    candidate as a named state and a written sentence, and never as zero.
 *    A candidate cannot accidentally render a false all-clear, because the
 *    all-clear sentence is only ever populated in the one world entitled to
 *    it.
 */

import { calendarDaysBetween, type CalendarDate } from "@/lib/planning/dates";
import {
  badgeDisplay,
  deriveBadge,
  deriveClaims,
  deriveExceptions,
  deriveLedger,
  deriveTrend,
  effectiveDisposition,
  fixtureCalendarDate,
  homeFixtureWorld,
  HOME_FIXTURE_ALL_PROJECTS,
  HOME_FIXTURE_DST_NOW_ISO,
  HOME_FIXTURE_LOCALE,
  HOME_FIXTURE_NOW,
  HOME_FIXTURE_ORCHARD_PROJECT_IDS,
  HOME_FIXTURE_PERIOD_ORCHARD,
  HOME_FIXTURE_TIME_ZONE,
  HOME_INBOX_ATTEMPTS,
  HOME_INBOX_COLLABORATOR_STATES,
  HOME_INBOX_DISPLAY,
  HOME_INBOX_EVENTS,
  HOME_INBOX_GUEST_DISPLAY,
  HOME_INBOX_GUEST_STATES,
  HOME_INBOX_SCALE_DISPLAY,
  HOME_INBOX_SCALE_EVENTS,
  HOME_INBOX_SCALE_STATES,
  HOME_INBOX_SNOOZE_CASES,
  HOME_INBOX_STATES,
  MY_WORK_UTC_FALLBACK_DISCLOSURE,
  rankToday,
  scenario as scenarioOf,
  TODAY_UNSUPPORTED_KINDS,
  visibilityResolver,
  type AnalyticsClaim,
  type ClaimContext,
  type GroupedRow,
  type HomeFixtureWorld,
  type HomeMode,
  type InboxDisplayProjection,
  type MyWorkGroup,
  type RankedRow,
  type Scenario,
  type ScenarioId,
  type SectionName,
  type TodayResult,
} from "../fixtures";
import type { InboxEventState, StoredInboxEvent } from "../inbox/contract";
import type {
  AnalyticsClaimView,
  AnalyticsExceptionView,
  AnalyticsLedgerRowView,
  AnalyticsView,
  BriefingView,
  Disclosure,
  FirstRunView,
  HomeCandidateProps,
  HomeChrome,
  HomeModeLink,
  HomeStateName,
  InboxGroup,
  InboxRow,
  InboxView,
  MotionContext,
  MyWorkGroupView,
  MyWorkRowView,
  MyWorkView,
  Provenance,
  RowAction,
  ScopeOption,
  TodayRow,
  TodaySection,
  TodaySectionId,
  TodayView,
  WhenLabel,
} from "./contract";
import {
  ANALYTICS_LEAD,
  CLAIMED_ABOVE,
  COMING_UP_WINDOW,
  DOCUMENT_TITLES,
  FIRST_RUN,
  FIRST_RUN_ACCOUNTING_LINE,
  FIRST_RUN_DISCLOSURE,
  FIRST_RUN_QUIET_LINE,
  HOME_LAB_COPY,
  INBOX_KIND_LABELS,
  MODE_HEADLINES,
  MODE_NAMES,
  MY_WORK_GROUP_HEADINGS,
  MY_WORK_GROUP_NOTES,
  SECTION_HEADINGS,
  STATE_NAMES,
  SUPPRESSED_BY_CAP,
} from "./copy";
import {
  buildLabHref,
  labViewState,
  LAB_MODE_TO_HOME_ROUTE,
  type LabScope,
  type LabViewState,
} from "./lab-url";

// ── Formatting, in the world's own zone ─────────────────────────────────────

const dateFormat = new Intl.DateTimeFormat(HOME_FIXTURE_LOCALE, {
  timeZone: HOME_FIXTURE_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormat = new Intl.DateTimeFormat(HOME_FIXTURE_LOCALE, {
  timeZone: HOME_FIXTURE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const absoluteDate = (iso: string) => dateFormat.format(new Date(iso));
const wallTime = (iso: string) => timeFormat.format(new Date(iso));

function relativeDay(days: number): string {
  if (days < -1) return `${-days} days late`;
  if (days === -1) return "1 day late";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function whenLabel(iso: string | null, today: CalendarDate): WhenLabel | null {
  if (!iso) return null;
  const days = calendarDaysBetween(today, fixtureCalendarDate(iso));
  return Object.freeze({
    iso,
    absolute: absoluteDate(iso),
    relative: relativeDay(days),
    overdue: days < 0,
  });
}

function occurredLine(occurredAt: number, today: CalendarDate): string {
  const iso = new Date(occurredAt).toISOString();
  const days = calendarDaysBetween(today, fixtureCalendarDate(iso));
  const at = wallTime(iso);
  if (days === 0) return `Today at ${at}`;
  if (days === -1) return `Yesterday at ${at}`;
  if (days < -1) return `${absoluteDate(iso)} at ${at}`;
  return `${absoluteDate(iso)} at ${at}`;
}

const plural = (count: number, one: string, many: string) =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;

// ── Projects ────────────────────────────────────────────────────────────────

const projectName = (id: string | null): string | null =>
  id === null
    ? null
    : (HOME_FIXTURE_ALL_PROJECTS.find((project) => project.id === id)?.name ?? null);

function provenanceFor(
  product: Provenance["product"],
  projectId: string | null,
  unreadable: ReadonlySet<string>,
): Provenance {
  // A null projectId is a row that spans the read — a reading, an aggregate —
  // not a failure. Only a Project that exists and did not resolve is
  // "could not be read". Before round 5 the two were conflated, and every
  // healthy reading row carried failure text (found by the Meridian lane,
  // 2026-08-17; the round-3 rule applies — a fault in shared material is
  // fixed at source, once).
  if (projectId === null) {
    return Object.freeze({
      product,
      projectId,
      projectName: null,
      text: `${product} · across this read`,
    });
  }
  const readable = !unreadable.has(projectId);
  const name = readable ? projectName(projectId) : null;
  return Object.freeze({
    product,
    projectId,
    projectName: name,
    // Content parity is a hard rule (D-HX08): this string is the row's
    // meaning, not decoration, and no width may drop it. A Project that could
    // not be read carries no name at all, not a placeholder.
    text: name ? `${product} · ${name}` : `${product} · project could not be read`,
  });
}

// ── Read Scope ──────────────────────────────────────────────────────────────

export type ResolvedScope = Readonly<{
  kind: LabScope;
  /** Projects Home may read together, after the scope is applied. */
  projectIds: readonly string[];
  /**
   * Projects whose route did not resolve at all: revoked, missing or deleted.
   * NOT ONE BYTE of their metadata may reach a candidate, including the name.
   */
  unresolvedIds: readonly string[];
  /**
   * Projects that resolved but whose SOURCE did not answer. Different fact,
   * different treatment: the name is fine, the counts are not.
   *
   * This set exists because the fixture universe derives its ledger from
   * `routeState` alone, so `provider_failure` publishes Nora & Cian as
   * `state: "ready"` with a count while its `sourceStatus` is
   * `unavailable`. The shell refuses to pass that on: a count from a source
   * that did not answer is withheld here, whatever the ledger returned.
   */
  sourceFailedIds: readonly string[];
  label: string;
  helpLine: string;
  /** True when the reviewer moved scope away from this world's own. */
  narrowed: boolean;
}>;

/** The scope each world was authored with. Feeds the URL parser's defaults. */
export function scenarioScopeOf(id: ScenarioId) {
  const world = scenarioOf(id);
  return Object.freeze({
    homeScope: (world.readScope === "current-project"
      ? "project"
      : world.readScope === "planning-period"
        ? "planning-period"
        : "all") as LabScope,
    workspaceId: world.activeProjectId,
    planningPeriodId: world.planningPeriodId,
    lensProjectId: world.lensProjectId,
  });
}

function projectsForScope(
  kind: LabScope,
  world: Scenario,
  workspaceId: string | null,
): readonly string[] {
  if (kind === "project") {
    const chosen = workspaceId ?? world.activeProjectId;
    return chosen !== null && world.projects.includes(chosen) ? [chosen] : [];
  }
  if (kind === "planning-period") {
    return world.projects.filter((id) => HOME_FIXTURE_ORCHARD_PROJECT_IDS.includes(id));
  }
  return world.projects;
}

/**
 * `unreadable` is not optional politeness. A Project that did not resolve
 * carries no metadata to a candidate, and its name reaching a scope label is
 * the same leak as its name reaching a row.
 */
function scopeLabel(
  kind: LabScope,
  projectIds: readonly string[],
  unreadable: ReadonlySet<string>,
): string {
  if (kind === "project") {
    const id = projectIds[0] ?? null;
    // No id at all is a first run, not a failure. "Could not be read" is
    // reserved for a Project that exists and did not resolve — before round 5
    // the two shared one phrase, and the failure text leaked into the
    // new-user world's scope options (found by the Meridian lane, 2026-08-17).
    if (id === null) return "No project yet";
    const name = unreadable.has(id) ? null : projectName(id);
    return name ?? "One project, and it could not be read";
  }
  if (kind === "planning-period") {
    // A first-run world has no season to name; naming the fixture season
    // there was the same leak in season form.
    return projectIds.length === 0
      ? "No season set up yet"
      : HOME_FIXTURE_PERIOD_ORCHARD.name;
  }
  return "Across all projects";
}

const SCOPE_HELP: Readonly<Record<LabScope, string>> = Object.freeze({
  project: "Home is reading one project. Changing this changes what you see, not where your work goes.",
  "planning-period": "Home is reading every project in this season. Changing this changes what you see, not where your work goes.",
  all: "Home is reading every project you can see. Changing this changes what you see, not where your work goes.",
});

export function resolveScope(state: LabViewState, world: Scenario): ResolvedScope {
  const unresolvedIds = world.projectStates
    .filter((entry) => entry.routeState === "unavailable")
    .map((entry) => entry.projectId);
  const sourceFailedIds = world.projectStates
    .filter(
      (entry) => entry.sourceStatus === "unavailable" && entry.routeState !== "unavailable",
    )
    .map((entry) => entry.projectId);
  const allUnreadable = new Set(unresolvedIds);
  const projectIds = projectsForScope(state.homeScope, world, state.workspaceId);
  const authored = scenarioScopeOf(world.id);
  const authoredIds = projectsForScope(authored.homeScope, world, authored.workspaceId);
  const narrowed =
    state.homeScope !== authored.homeScope ||
    projectIds.length !== authoredIds.length ||
    projectIds.some((id, index) => id !== authoredIds[index]);
  return Object.freeze({
    kind: state.homeScope,
    projectIds: Object.freeze(projectIds),
    unresolvedIds: Object.freeze(unresolvedIds.filter((id) => projectIds.includes(id))),
    sourceFailedIds: Object.freeze(sourceFailedIds.filter((id) => projectIds.includes(id))),
    label: scopeLabel(state.homeScope, projectIds, allUnreadable),
    helpLine: SCOPE_HELP[state.homeScope],
    narrowed,
  });
}

// ── The Inbox rows the world holds ──────────────────────────────────────────

/**
 * `homeFixtureWorld` publishes the badge but not the rows behind it, and the
 * per-world selection that produces them is private to the fixture module. So
 * it is mirrored here, and `assemble.test.ts` asserts that `deriveBadge` over
 * this mirror equals `homeFixtureWorld(id).badge` for all thirteen worlds. The
 * duplication is real; the test is what stops it drifting silently.
 */
function inboxDataFor(world: Scenario): Readonly<{
  events: readonly StoredInboxEvent[];
  states: readonly InboxEventState[];
  display: readonly InboxDisplayProjection[];
  now: number;
}> {
  const inProjects = (ids: readonly string[]) =>
    HOME_INBOX_EVENTS.filter((row) => ids.includes(row.workspaceId));
  const now =
    world.id === "dst_boundary" ? Date.parse(HOME_FIXTURE_DST_NOW_ISO) : HOME_FIXTURE_NOW;

  switch (world.id) {
    case "owner_quiet":
    case "new_user":
      return Object.freeze({ events: [], states: [], display: HOME_INBOX_DISPLAY, now });
    case "collaborator_project":
      return Object.freeze({
        events: inProjects(world.projects),
        states: HOME_INBOX_COLLABORATOR_STATES,
        display: HOME_INBOX_DISPLAY,
        now,
      });
    case "guest_limited":
      return Object.freeze({
        events: inProjects(world.projects),
        states: HOME_INBOX_GUEST_STATES,
        display: HOME_INBOX_GUEST_DISPLAY,
        now,
      });
    case "scale":
      return Object.freeze({
        events: HOME_INBOX_SCALE_EVENTS,
        states: HOME_INBOX_SCALE_STATES,
        display: HOME_INBOX_SCALE_DISPLAY,
        now,
      });
    default:
      return Object.freeze({
        events: HOME_INBOX_EVENTS,
        states: HOME_INBOX_STATES,
        display: HOME_INBOX_DISPLAY,
        now,
      });
  }
}

// ── States and disclosures ──────────────────────────────────────────────────

/**
 * THE FIRST-RUN TEST, and why it is the reader's Project set rather than the
 * scope's.
 *
 * A reader with no Project has not started. A reader who narrowed Read Scope
 * onto a Project that could not be read has started and hit a failure. Both
 * resolve to zero Projects in scope, and the two are not the same fact, so the
 * test has to be the one that can tell them apart: does this reader have a
 * Project at all.
 */
function readerHasNoProjects(world: Scenario): boolean {
  return world.projects.length === 0;
}

function coverageState(world: Scenario, scope: ResolvedScope): HomeStateName {
  const statuses = world.projectStates
    .filter((entry) => scope.projectIds.includes(entry.projectId))
    .map((entry) => entry.sourceStatus);
  // Before every other test. Nothing was attempted, so nothing can have
  // failed, and `unavailable` would be a claim about a read that never ran.
  if (readerHasNoProjects(world)) return "first-run";
  if (scope.projectIds.length === 0) return "unavailable";
  if (statuses.length === 0) return "unavailable";
  if (statuses.every((status) => status === "unavailable")) return "unavailable";
  if (statuses.includes("unavailable")) return "partial";
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("stale")) return "stale";
  if (world.actor.seat === "guest") return "permission-limited";
  return "ready";
}

function coverageDisclosures(world: Scenario, scope: ResolvedScope): readonly Disclosure[] {
  const out: Disclosure[] = [];
  const states = world.projectStates.filter((entry) =>
    scope.projectIds.includes(entry.projectId),
  );
  const unresolved = states.filter((entry) => entry.routeState === "unavailable");
  const partial = states.filter((entry) => entry.sourceStatus === "partial");
  const stale = states.filter((entry) => entry.sourceStatus === "stale");
  // Resolved, in scope, and its source did not come back. Without this the
  // provider-failure world renders `partial` with nothing on the page saying
  // so, and a broken provider looks like a quiet day.
  const silent = states.filter(
    (entry) => entry.routeState !== "unavailable" && entry.sourceStatus === "unavailable",
  );

  if (readerHasNoProjects(world)) {
    out.push({
      id: "first-run",
      tone: "setup",
      state: "first-run",
      text: FIRST_RUN_DISCLOSURE,
    });
  } else if (scope.projectIds.length === 0) {
    out.push({
      id: "scope-empty",
      tone: "scope",
      state: "unavailable",
      text: "Home could not read any project at this scope.",
    });
  }
  if (unresolved.length > 0) {
    out.push({
      id: "coverage-unresolved",
      tone: "coverage",
      state: "partial",
      text: `${plural(scope.projectIds.length - unresolved.length, "project", "projects")} of ${scope.projectIds.length} answered. The rest could not be read, so nothing here counts them.`,
    });
  }
  if (silent.length > 0) {
    out.push({
      id: "coverage-source-failed",
      tone: "failure",
      state: "partial",
      text: `${plural(silent.length, "project", "projects")} did not answer at all. Nothing here counts ${silent.length === 1 ? "it" : "them"} as zero, and no total includes ${silent.length === 1 ? "it" : "them"}.`,
    });
  }
  if (partial.length > 0) {
    out.push({
      id: "coverage-partial",
      tone: "coverage",
      state: "partial",
      text: `${plural(partial.length, "project", "projects")} answered for part of what was asked. The missing part is not counted as zero.`,
    });
  }
  for (const entry of stale) {
    out.push({
      id: `coverage-stale-${entry.projectId}`,
      tone: "freshness",
      state: "stale",
      text: entry.lastSuccessfulReadIso
        ? `${projectName(entry.projectId) ?? "One project"} was last read at ${wallTime(entry.lastSuccessfulReadIso)} on ${absoluteDate(entry.lastSuccessfulReadIso)}. It has not answered since.`
        : `${projectName(entry.projectId) ?? "One project"} has never answered, so nothing here reads it as current.`,
    });
  }
  if (world.actor.seat === "guest") {
    out.push({
      id: "permission-guest",
      tone: "permission",
      state: "permission-limited",
      text: "You have a limited seat here. Some names, counts and actions are held back, and each one says so where it happens.",
    });
  }
  if (scope.narrowed) {
    out.push({
      id: "scope-changed",
      tone: "scope",
      state: "ready",
      text: `Read Scope was changed to ${scope.label}. This world was written at a different scope, so some totals are held back rather than estimated.`,
    });
  }
  return Object.freeze(out);
}

// ── Today ───────────────────────────────────────────────────────────────────

const SECTION_ORDER: readonly SectionName[] = Object.freeze([
  "todaysSignal",
  "needsReview",
  "comingUp",
  "movingWell",
]);

function todayRow(
  row: RankedRow,
  today: CalendarDate,
  unreadable: ReadonlySet<string>,
  href: (patch: Partial<LabViewState>) => string,
): TodayRow {
  const projectId = row.ref?.projectId ?? null;
  const key = row.ref ? `${row.ref.product}:${row.ref.kind}:${row.ref.id}` : `reading:${row.origin}`;
  return Object.freeze({
    key,
    title: row.title,
    reason: row.reason,
    provenance: provenanceFor("Tasks", projectId, unreadable),
    due: whenLabel(row.dueAtIso, today),
    idleLine: row.idleDays > 0 ? `Quiet for ${plural(row.idleDays, "day", "days")}` : null,
    isReading: row.ref === null,
    memberCount: row.members.length,
    href: row.ref ? href({ item: row.ref.id }) : href({ mode: "briefing" }),
    sourcePath: row.ref
      ? `/app/task/${row.ref.id}`
      : LAB_MODE_TO_HOME_ROUTE.briefing,
    actions: Object.freeze([]),
  });
}

function todaySections(
  result: TodayResult,
  today: CalendarDate,
  unreadable: ReadonlySet<string>,
  href: (patch: Partial<LabViewState>) => string,
  uncapped: boolean,
): readonly TodaySection[] {
  return Object.freeze(
    SECTION_ORDER.map((name) => {
      const accounting = result.sectionAccounting[name];
      const suppressed = accounting.suppressed;
      const parts: string[] = [];
      if (!uncapped && accounting.cappedOut > 0) {
        parts.push(SUPPRESSED_BY_CAP(accounting.cappedOut, SECTION_HEADINGS[name as TodaySectionId].toLowerCase()));
      }
      if (accounting.claimedAbove > 0) parts.push(CLAIMED_ABOVE(accounting.claimedAbove));
      return Object.freeze({
        id: name as TodaySectionId,
        heading: SECTION_HEADINGS[name as TodaySectionId],
        windowLine: name === "comingUp" ? COMING_UP_WINDOW : null,
        rows: Object.freeze(
          result.sections[name].map((row) => todayRow(row, today, unreadable, href)),
        ),
        suppressedLine: suppressed > 0 && parts.length > 0 ? parts.join(" ") : null,
        moreHref: suppressed > 0 && !uncapped ? href({ mode: "briefing" }) : null,
        moreLabel: suppressed > 0 && !uncapped ? HOME_LAB_COPY.actions.openBriefing : null,
      });
    }),
  );
}

function accountingLineOf(result: TodayResult): string | null {
  const accounting = result.accounting;
  if (!accounting) return null;
  return `Signal read ${plural(accounting.read, "item", "items")}, showed ${accounting.shown}, held back ${accounting.cappedOut}, skipped ${accounting.dismissed} you silenced, and found ${accounting.cleared} that crossed nothing.`;
}

const QUIET_REASONS: Readonly<Record<string, string>> = Object.freeze({
  Q1: "one source did not answer in full",
  Q2: "the read could not be accounted for exactly",
  Q3: "something crossed a rule",
  Q4: "more crossed a rule than fits here",
  Q5: "you silenced something that would otherwise be here",
  Q6: "a project could not be read",
  Q7: "a kind of work has no source connected",
  Q8: "there is no history to read",
  Q9: "there is no project in scope",
});

/**
 * The two conditions that are facts about the PLATFORM in v1, not about this
 * reader's day.
 *
 * Q7: `calendar-event` is an eligible kind with no producer, so it fires for
 * every reader in every world (TODAY_RANKING TR-7, which calls that the correct
 * outcome rather than a bug). Q8: nothing writes analytics snapshots yet
 * (finding F7), so a world with no comparable history fires it whatever the
 * reader did today.
 *
 * Every other code is a fact about the read itself: something crossed a rule,
 * something was held back, something was silenced, a project or a source did
 * not answer.
 */
const PLATFORM_LIMIT_CODES: ReadonlySet<string> = new Set(["Q7", "Q8"]);

function quietState(
  result: TodayResult,
  firstRun: boolean,
): Readonly<{
  allowed: boolean;
  readIsQuiet: boolean;
  blockedBy: readonly string[];
  line: string;
}> {
  const blockedBy = Object.freeze([...result.quiet.blockedBy]);
  const worded = (codes: readonly string[]) =>
    codes
      .map((code) => QUIET_REASONS[code])
      .filter((text): text is string => Boolean(text));

  /**
   * A first screen, before the ordinary wording gets to it.
   *
   * The codes are still published whole, so nothing is hidden: Q9 fired
   * because there is no project in scope, and a direction that discloses the
   * codes one at a time still gets all of them. What changes is the sentence.
   * `readIsQuiet` stays false because this read was not quiet, it did not
   * happen, and a direction keying its calm-day composition off that flag must
   * not be handed a new reader by mistake.
   */
  if (firstRun) {
    return Object.freeze({
      allowed: false,
      readIsQuiet: false,
      blockedBy,
      line: FIRST_RUN_QUIET_LINE,
    });
  }

  // The unqualified all clear. §9.2 permits it only with Q1 to Q9 all false,
  // which v1 cannot reach, so this branch exists to be correct rather than to
  // be taken.
  if (result.quiet.allowed) {
    return Object.freeze({
      allowed: true,
      readIsQuiet: true,
      blockedBy,
      line: "Nothing crossed a rule today, every source answered, and every project was read.",
    });
  }

  const limits = blockedBy.filter((code) => PLATFORM_LIMIT_CODES.has(code));
  const readIsQuiet = limits.length === blockedBy.length;

  // §9.2 part 3, the specific true statement, followed by part 2, what was not
  // read. Nothing about this reader's own work is unresolved, so the sentence
  // says so plainly and then refuses the all clear by naming what is missing.
  if (readIsQuiet) {
    const missing = worded(limits);
    return Object.freeze({
      allowed: false,
      readIsQuiet: true,
      blockedBy,
      line: `Nothing you are carrying crossed a rule today, and every project answered. This is still not an all clear, because ${joinPlainly(missing)}.`,
    });
  }

  const reasons = worded(blockedBy.filter((code) => !PLATFORM_LIMIT_CODES.has(code)));
  const first = reasons[0] ?? "the read is not complete";
  const rest = reasons.length - 1;
  return Object.freeze({
    allowed: false,
    readIsQuiet: false,
    blockedBy,
    line:
      rest > 0
        ? `This is not an all clear: ${first}, and ${plural(rest, "other thing is", "other things are")} unresolved.`
        : `This is not an all clear: ${first}.`,
  });
}

/**
 * The ledger accounts for every Project it could not read, and it separates the
 * two reasons. A Project whose route did not resolve and a Project whose source
 * did not answer are different facts, and a reader who is deciding whether to
 * trust the numbers needs to know which one happened.
 */
function ledgerCoverageLine(unresolved: number, sourceFailed: number): string | null {
  const parts: string[] = [];
  if (unresolved > 0) {
    parts.push(
      `${plural(unresolved, "project", "projects")} could not be read at all`,
    );
  }
  if (sourceFailed > 0) {
    parts.push(`${plural(sourceFailed, "project", "projects")} did not answer`);
  }
  if (parts.length === 0) return null;
  return `${joinPlainly(parts)}. ${unresolved + sourceFailed === 1 ? "It is" : "They are"} listed with that state rather than left out, and no count is shown for ${unresolved + sourceFailed === 1 ? "it" : "them"}.`;
}

/** "a, b and c". Used only for sentences the shell composes itself. */
function joinPlainly(parts: readonly string[]): string {
  if (parts.length === 0) return "the read is not complete";
  if (parts.length === 1) return parts[0] as string;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] as string}`;
}

const UNSUPPORTED_DISCLOSURES: readonly Disclosure[] = Object.freeze(
  TODAY_UNSUPPORTED_KINDS.map((entry) =>
    Object.freeze({
      id: `unsupported-${entry.kind}`,
      tone: "setup" as const,
      state: "unavailable" as HomeStateName,
      text: `${entry.reason} Nothing here counts that as zero.`,
    }),
  ),
);

// ── The assembly ────────────────────────────────────────────────────────────

/**
 * `state` is a `LabViewState`, so it does not carry `v`. The assembly cannot
 * see which candidate is on screen and therefore cannot vary by it: that is the
 * fairness rule, enforced by the type rather than by discipline. The shell puts
 * the candidate back into the links afterwards (`withCandidateVariant`).
 */
export type AssembleInput = Readonly<{ state: LabViewState }>;

const MOTION: MotionContext = Object.freeze({
  replaysOnRemount: true,
  durations: Object.freeze({ fastMs: 120, baseMs: 220, slowMs: 400 }),
  ceilingMs: 300,
});

export function assembleCandidateProps(input: AssembleInput): HomeCandidateProps {
  const { state } = input;
  const world = scenarioOf(state.scenario);
  const fixture: HomeFixtureWorld = homeFixtureWorld(state.scenario);
  const scope = resolveScope(state, world);
  const today = fixtureCalendarDate(world.asOfIso);
  const unreadable = new Set(scope.unresolvedIds);
  const sourceFailed = new Set(scope.sourceFailedIds);
  /**
   * A Project that did not resolve is IN the ledger and OUT of the content. It
   * is named as unread in the one place that has to account for every Project,
   * and it contributes no row, no title and no name anywhere else — a revoked
   * Project's work is not the reader's to see, and its titles are its work.
   */
  const inScope = (projectId: string | null) =>
    projectId === null
      ? scope.kind === "all"
      : scope.projectIds.includes(projectId) && !unreadable.has(projectId);
  const readableName = (id: string | null): string | null =>
    id === null || unreadable.has(id) ? null : projectName(id);

  const href = (patch: Partial<LabViewState>): string =>
    buildLabHref({ ...state, ...patch });

  // — Today, and the full briefing, from one ranking ————————————————
  const scopedCandidates = world.todayCandidates.filter((signal) =>
    inScope(signal.projectId),
  );
  const scopedStatuses = world.projectStates
    .filter((entry) => scope.projectIds.includes(entry.projectId))
    .map((entry) => entry.sourceStatus);
  const providerStatuses = scopedStatuses.length > 0 ? scopedStatuses : ["unsupported"];
  const coverageInput = {
    providerStatuses,
    projectsUnresolved: scope.unresolvedIds.length,
    unsupportedKinds: TODAY_UNSUPPORTED_KINDS.map((entry) => entry.kind),
    historyIsEmpty: world.comparableSnapshots === 0,
    scopeProjectCount: scope.projectIds.length - scope.unresolvedIds.length,
    accountingComputable: providerStatuses.every(
      (status) => status === "ready" || status === "stale",
    ),
  };

  const todayResult = scope.narrowed
    ? rankToday({
        candidates: scopedCandidates,
        asOfIso: world.asOfIso,
        today: world.id === "dst_boundary" ? today : undefined,
        coverage: coverageInput,
      })
    : fixture.today;

  const briefingResult = rankToday({
    candidates: scopedCandidates,
    asOfIso: world.asOfIso,
    today: world.id === "dst_boundary" ? today : undefined,
    coverage: coverageInput,
    limit: "all",
  });

  const state0 = coverageState(world, scope);
  const shared = coverageDisclosures(world, scope);
  /**
   * One reader-level fact, read once and used by every mode below. It is
   * deliberately not derived from `state0`: a mode that decided it was in a
   * first run because its own state said so would be re-deriving the reader
   * from the read, which is the inversion that produced the defect.
   */
  const firstRun = readerHasNoProjects(world);
  const firstRunView: FirstRunView | null = firstRun ? FIRST_RUN : null;

  const todaySelectionKey = state.item;
  const todayViewSections = todaySections(todayResult, today, unreadable, href, false);
  const todayRows = todayViewSections.flatMap((section) => section.rows);
  const todaySelection =
    todaySelectionKey === null
      ? null
      : (todayRows.find((row) => row.key.endsWith(`:${todaySelectionKey}`)) ?? null);

  const today_: TodayView = Object.freeze({
    state: state0,
    headline: MODE_HEADLINES.today,
    sections: todayViewSections,
    accountingLine: accountingLineOf(todayResult),
    accountingWithheldLine: todayResult.accounting
      ? null
      : firstRun
        ? FIRST_RUN_ACCOUNTING_LINE
        : "The read cannot be accounted for exactly, because at least one source did not answer in full. No total is shown rather than a total that would be wrong.",
    quiet: quietState(todayResult, firstRun),
    unsupported: UNSUPPORTED_DISCLOSURES,
    disclosures: shared,
    briefingHref: href({ mode: "briefing", item: null }),
    briefingLabel: HOME_LAB_COPY.actions.openBriefing,
    selection: todaySelection,
    selectionMissingLine:
      todaySelectionKey !== null && todaySelection === null
        ? "That item is not in this read. It may have moved, or you may not be able to see it."
        : null,
  });

  // — Inbox ————————————————————————————————————————————————————————
  const inboxData = inboxDataFor(world);
  const visibilityOf = visibilityResolver(inboxData.display);
  const recipientId = world.actor.id;
  const liveProjects = scope.projectIds.filter((id) => !unreadable.has(id));

  const badge = deriveBadge({
    events: inboxData.events,
    states: inboxData.states,
    recipientUserId: recipientId,
    now: inboxData.now,
    liveProjectIds: liveProjects,
    unreadableProjectCount: scope.unresolvedIds.length,
    visibilityOf,
  });
  const badgeGlyph = badgeDisplay(badge);

  const inboxRows: InboxRow[] = [];
  for (const event of inboxData.events) {
    if (!inScope(event.workspaceId)) continue;
    if (event.withdrawnAt !== null) continue;
    const rowState = inboxData.states.find(
      (entry) => entry.eventId === event.id && entry.recipientUserId === recipientId,
    );
    if (!rowState) continue;
    const projection = inboxData.display.find(
      (entry) => entry.sourceObjectId === event.sourceObjectId,
    );
    const visibility = projection?.visibility ?? "undetermined";
    const disposition = effectiveDisposition(rowState, inboxData.now);
    const attempt = HOME_INBOX_ATTEMPTS.find(
      (entry) => entry.eventId === event.id && entry.recipientUserId === recipientId,
    );
    const revisionMoved =
      visibility === "available" &&
      Boolean(projection?.liveRevision) &&
      projection?.liveRevision !== event.sourceRevisionAtEmit;

    const canApprove =
      visibility === "available" &&
      world.actor.seat !== "guest" &&
      (event.kind === "approval-requested" || event.kind === "review-requested");

    inboxRows.push(
      Object.freeze({
        eventId: event.id,
        kind: event.kind,
        kindLabel: INBOX_KIND_LABELS[event.kind] ?? event.kind,
        title: visibility === "available" ? (projection?.title ?? null) : null,
        titleState: visibility,
        titleFallback:
          visibility === "unavailable"
            ? "You can no longer see what this was about."
            : "The source did not answer, so this cannot be named yet.",
        actorName: visibility === "available" ? (projection?.actorName ?? null) : null,
        provenance: provenanceFor(
          event.sourceProduct === "tasks"
            ? "Tasks"
            : event.sourceProduct === "notes"
              ? "Notes"
              : "Timeline",
          event.workspaceId,
          unreadable,
        ),
        occurredLine: occurredLine(event.occurredAt, today),
        visibility: rowState.visibility,
        visibilityLabel: rowState.visibility === "new" ? "Not read yet" : "Read",
        disposition,
        dispositionLabel:
          disposition === "open"
            ? "Still open"
            : disposition === "snoozed"
              ? "Snoozed"
              : disposition === "acknowledged"
                ? "Handled at the source"
                : "Cleared",
        snoozeLine:
          disposition === "snoozed" && rowState.snoozedUntil !== null
            ? `Comes back at ${wallTime(new Date(rowState.snoozedUntil).toISOString())} on ${absoluteDate(new Date(rowState.snoozedUntil).toISOString())}.`
            : null,
        attempt: attempt
          ? Object.freeze({
              outcome: attempt.outcome,
              line:
                attempt.outcome === "committed"
                  ? "The source accepted this. It is done there."
                  : attempt.outcome === "refused"
                    ? "The source refused this. Nothing changed there, and this is still open."
                    : "The source did not say whether this landed. It has not been marked either way.",
              recoveryLabel:
                attempt.outcome === "refused" ? HOME_LAB_COPY.actions.retry : null,
            })
          : null,
        revisionMoved,
        revisionLine: revisionMoved
          ? "The source has changed since this arrived. Open it before acting."
          : null,
        href: href({ mode: "inbox", event: event.id }),
        sourcePath: `/app/task/${event.sourceObjectId}`,
        actions: Object.freeze([
          action("open", HOME_LAB_COPY.actions.openEvent, true, null, href({ mode: "inbox", event: event.id })),
          action(
            "mark-read",
            HOME_LAB_COPY.actions.markRead,
            rowState.visibility === "new",
            rowState.visibility === "new" ? null : "You have already read this.",
          ),
          action(
            "snooze",
            HOME_LAB_COPY.actions.snooze,
            disposition === "open",
            disposition === "open" ? null : "Only an open item can be snoozed.",
          ),
          action(
            "approve",
            HOME_LAB_COPY.actions.approve,
            canApprove,
            canApprove
              ? null
              : world.actor.seat === "guest"
                ? "Your seat cannot approve work in this project."
                : visibility === "available"
                  ? "This one is not an approval."
                  : "The source did not answer, so nothing can be sent to it.",
            null,
            true,
          ),
          action(
            "clear",
            HOME_LAB_COPY.actions.clear,
            disposition !== "cleared",
            disposition === "cleared" ? "This is already cleared." : null,
          ),
        ]),
      }),
    );
  }

  const groupsByThread = new Map<string, InboxRow[]>();
  for (const row of inboxRows) {
    const event = inboxData.events.find((entry) => entry.id === row.eventId);
    const key = event?.threadKey ?? row.eventId;
    const held = groupsByThread.get(key);
    if (held) held.push(row);
    else groupsByThread.set(key, [row]);
  }

  const inboxGroups: readonly InboxGroup[] = Object.freeze(
    [...groupsByThread.entries()].map(([key, rows]) =>
      Object.freeze({
        key,
        heading: rows[0]?.title ?? rows[0]?.titleFallback ?? "One thread",
        subheading:
          rows.length > 1 ? `${plural(rows.length, "ask", "asks")} in this thread.` : null,
        rows: Object.freeze(rows),
      }),
    ),
  );

  const inboxSelection =
    state.event === null
      ? null
      : (inboxRows.find((row) => row.eventId === state.event) ?? null);

  const inbox: InboxView = Object.freeze({
    // `first-run` outranks both. A queue with no Project behind it is not an
    // empty queue and not a failed read: there is no queue yet.
    state: firstRun
      ? "first-run"
      : badge.coverage === "unavailable"
        ? "unavailable"
        : inboxRows.length === 0
          ? "empty"
          : state0,
    headline: MODE_HEADLINES.inbox,
    badge: Object.freeze({
      count: badge.count,
      glyph: badgeGlyph.glyph,
      accessibleName: badgeGlyph.accessibleName,
      coverage: badge.coverage,
      rendered: fixture.badgeRendered,
    }),
    groups: inboxGroups,
    rowsShown: inboxRows.length,
    selection: inboxSelection,
    selectionMissingLine:
      state.event !== null && inboxSelection === null
        ? "That item is not in this list. It may have been withdrawn, or you may not be able to see it."
        : null,
    emptyLine:
      inboxRows.length === 0 && badge.coverage === "complete" && scope.projectIds.length > 0
        ? HOME_LAB_COPY.empty.inbox
        : null,
    disclosures: Object.freeze([
      ...shared,
      ...(badge.undeterminedCount > 0
        ? [
            {
              id: "inbox-undetermined",
              tone: "coverage" as const,
              state: "partial" as HomeStateName,
              text: `${plural(badge.undeterminedCount, "item", "items")} could not be checked against the source, so ${badge.undeterminedCount === 1 ? "it is" : "they are"} counted but not named.`,
            },
          ]
        : []),
      ...(fixture.badgeRendered
        ? []
        : [
            {
              id: "inbox-no-projects",
              tone: "setup" as const,
              state: "first-run" as HomeStateName,
              text: "There is no project yet, so there is nothing for a count to be a count of.",
            },
          ]),
    ]),
    snoozeOptions: Object.freeze(
      HOME_INBOX_SNOOZE_CASES.map((entry) =>
        Object.freeze({
          id: entry.id,
          label:
            entry.target === "later-today"
              ? "Later today"
              : entry.target === "tomorrow-morning"
                ? "Tomorrow morning"
                : entry.target === "next-week"
                  ? "Next week"
                  : "Pick a time",
          resurfaceIso: entry.expectedResurfaceIso,
          resurfaceLine: `Comes back at ${wallTime(entry.expectedResurfaceIso)} on ${absoluteDate(entry.expectedResurfaceIso)}.`,
        }),
      ),
    ),
  });

  // — My work ——————————————————————————————————————————————————————
  const projection = fixture.myWork;
  const groupedRows: readonly GroupedRow[] =
    projection.kind === "ready"
      ? (["waiting", "now", "next", "later"] as MyWorkGroup[]).flatMap((group) =>
          projection.groups[group].filter((entry) => inScope(entry.row.workspaceId)),
        )
      : [];

  const myWorkGroups: readonly MyWorkGroupView[] = Object.freeze(
    (["waiting", "now", "next", "later"] as MyWorkGroup[]).map((group) =>
      Object.freeze({
        id: group,
        heading: MY_WORK_GROUP_HEADINGS[group],
        note: MY_WORK_GROUP_NOTES[group],
        rows: Object.freeze(
          groupedRows
            .filter((entry) => entry.group === group)
            .map((entry) => myWorkRow(entry, today, unreadable, href)),
        ),
      }),
    ),
  );

  const myWorkRowsShown = myWorkGroups.reduce((total, group) => total + group.rows.length, 0);
  const myWorkSelection =
    state.item === null
      ? null
      : (myWorkGroups
          .flatMap((group) => group.rows)
          .find((row) => row.key.endsWith(state.item ?? "")) ?? null);

  const myWork: MyWorkView = Object.freeze({
    // `no-projects` was resolving to `empty`, which said the reader had been
    // read and was carrying nothing. They have not been read. `kind` keeps the
    // fixture's own word for the same fact, so the two stay in step.
    state:
      projection.kind === "no-projects"
        ? "first-run"
        : projection.kind === "unavailable"
          ? "unavailable"
          : state0,
    headline: MODE_HEADLINES["my-work"],
    kind:
      projection.kind === "ready"
        ? "ready"
        : projection.kind === "no-projects"
          ? "no-projects"
          : projection.kind === "identity-unresolved"
            ? "identity-unresolved"
            : "unavailable",
    groups: myWorkGroups,
    rowsShown: myWorkRowsShown,
    coverageLine:
      projection.kind === "ready" && projection.coverage.status !== "ready"
        ? `Read ${projection.coverage.projectsRead} of ${projection.coverage.projectsAuthorized} projects. ${projection.coverage.projectsUnresolved} did not answer, and nothing here counts them as empty.`
        : null,
    timeZoneLine:
      projection.kind === "ready" && world.id === "new_user"
        ? MY_WORK_UTC_FALLBACK_DISCLOSURE
        : null,
    doneExcludedLine:
      projection.kind === "ready" && !scope.narrowed && projection.doneExcluded > 0
        ? `${plural(projection.doneExcluded, "finished item is", "finished items are")} filtered out. They are still there.`
        : scope.narrowed
          ? "The finished-item count is held back at this scope, because it was not read at this scope."
          : null,
    // A cursor means the list genuinely continues — but LabViewState carries
    // no cursor, so href({}) was a self-link: a published dead control
    // (found by the Meridian lane, 2026-08-17). The lab does not paginate,
    // so it does not render a control pretending to; the continuation is
    // declared as a disclosure below instead.
    moreHref: null,
    moreLabel: null,
    emptyLine: myWorkRowsShown === 0 && projection.kind === "ready" ? HOME_LAB_COPY.empty.myWork : null,
    disclosures: Object.freeze([
      ...shared,
      ...(projection.kind === "ready" && projection.cursor
        ? [
            {
              id: "my-work-continues",
              tone: "coverage" as const,
              state: "partial" as HomeStateName,
              text: "The list continues past this page. Nothing past it is lost; it is just not shown here.",
            },
          ]
        : []),
      ...(projection.kind === "ready" && projection.coverage.unprojectableExcluded > 0
        ? [
            {
              id: "my-work-unprojected",
              tone: "coverage" as const,
              state: "partial" as HomeStateName,
              text: `${plural(projection.coverage.unprojectableExcluded, "item belongs", "items belong")} to no project, so ${projection.coverage.unprojectableExcluded === 1 ? "it is" : "they are"} left out of every project count here.`,
            },
          ]
        : []),
      ...(projection.kind === "ready" && projection.coverage.projectsWithoutWaitingSignal > 0
        ? [
            {
              id: "my-work-no-waiting",
              tone: "coverage" as const,
              state: "partial" as HomeStateName,
              text: `${plural(projection.coverage.projectsWithoutWaitingSignal, "project has", "projects have")} no waiting column, so nothing from ${projection.coverage.projectsWithoutWaitingSignal === 1 ? "it" : "them"} can appear as waiting.`,
            },
          ]
        : []),
    ]),
    selection: myWorkSelection,
    selectionMissingLine:
      state.item !== null && myWorkSelection === null
        ? "That item is not in your list. It may have moved, or you may not be able to see it."
        : null,
  });

  // — Analytics ————————————————————————————————————————————————————
  const claimContext: ClaimContext = Object.freeze({
    readScope:
      scope.kind === "project"
        ? "current-project"
        : scope.kind === "planning-period"
          ? "planning-period"
          : "all-projects",
    projects: liveProjects,
    asOfIso: world.asOfIso,
    rows: fixture.analyticsRows,
    unresolved: scope.unresolvedIds.length,
    coverageStatus:
      state0 === "partial"
        ? "partial"
        : state0 === "stale"
          ? "stale"
          : state0 === "unavailable"
            ? "unavailable"
            : "ready",
    coverageIssues: Object.freeze([
      ...new Set(world.projectStates.flatMap((entry) => entry.issues)),
    ]),
    timezoneSource: world.id === "new_user" ? "utc_fallback" : "user_setting",
    comparableSnapshots: world.comparableSnapshots,
  });

  const claims = scope.narrowed ? deriveClaims(claimContext) : fixture.claims;
  const exceptions = scope.narrowed ? deriveExceptions(claimContext) : fixture.exceptions;
  const ledger = scope.narrowed
    ? deriveLedger({
        projects: scope.projectIds,
        unresolved: scope.unresolvedIds,
        rows: fixture.analyticsRows,
        asOfIso: world.asOfIso,
      })
    : fixture.ledger;
  const trend = fixture.trend;

  const analytics: AnalyticsView = Object.freeze({
    state: state0,
    headline: MODE_HEADLINES.analytics,
    leadLine: ANALYTICS_LEAD,
    claims: Object.freeze(claims.map((claim) => claimView(claim, href))),
    exceptions: Object.freeze(
      exceptions.map((entry) =>
        Object.freeze({
          id: entry.id,
          headline: entry.headline,
          suggestion: entry.suggestion,
          provenance: provenanceFor("Tasks", entry.workspaceId, unreadable),
          evidenceHref: href({ mode: "my-work", item: entry.sourceTaskId }),
          evidenceLabel: HOME_LAB_COPY.actions.openEvidence,
          source: entry,
        }),
      ),
    ) as readonly AnalyticsExceptionView[],
    exceptionsHeading: "Worth a look",
    ledger: Object.freeze(
      ledger.map((row): AnalyticsLedgerRowView => {
        /**
         * THE ONE PLACE THE SHELL OVERRULES THE FIXTURE, and it overrules it
         * downward, never upward.
         *
         * `deriveLedger` reads `routeState` alone, so a Project whose route
         * resolved but whose SOURCE did not answer comes back `ready` with a
         * number on it. `provider_failure` is exactly that: Nora & Cian,
         * `routeState: "ready"`, `sourceStatus: "unavailable"`. Passing that
         * count on would be the charter's flagship lie, a failed read rendered
         * as a fact. So the state becomes `unavailable` and both counts are
         * withheld.
         *
         * The NAME stays. This is not a permission failure and there is no
         * existence to leak: the reader is a member, the Project is in their
         * scope control, and an anonymous "could not be read" row would tell
         * them less than the truth. Only an unresolved Project loses its name,
         * and `deriveLedger` has already dropped it.
         */
        const answered = !sourceFailed.has(row.workspaceId);
        const state_ = answered ? row.state : ("unavailable" as const);
        const openWork = answered ? row.openWork : null;
        const overdue = answered ? row.overdue : null;
        return Object.freeze({
          projectId: row.workspaceId,
          projectName: row.projectName,
          state: state_,
          stateLabel:
            state_ === "ready"
              ? "Read"
              : state_ === "empty"
                ? "Nothing in it"
                : state_ === "archived"
                  ? "Archived"
                  : state_ === "unresolved"
                    ? "Did not answer"
                    : "Could not be read",
          openWorkLabel:
            openWork === null
              ? HOME_LAB_COPY.unreadableCount
              : plural(openWork, "item open", "items open"),
          overdueLabel:
            overdue === null
              ? HOME_LAB_COPY.unreadableCount
              : plural(overdue, "item late", "items late"),
          href:
            state_ === "unavailable" || state_ === "unresolved"
              ? null
              : href({ mode: "analytics", lensProjectId: row.workspaceId }),
        });
      }),
    ),
    ledgerHeading: "Every project you can read",
    ledgerCoverageLine: ledgerCoverageLine(
      scope.unresolvedIds.length,
      scope.sourceFailedIds.length,
    ),
    trend: Object.freeze({
      renderChart: trend.renderChart,
      line:
        trend.kind === "insufficient-history"
          ? trend.copy
          : "Open work, one reading a day, over the last two weeks.",
      heading: "Open work over time",
      source: trend,
    }),
    windowLine: `Reading the last four weeks, in ${HOME_FIXTURE_TIME_ZONE.replace("/", ", ")}.`,
    windowMismatchLine:
      state.period === "four_weeks"
        ? null
        : `You asked for ${state.period.replace(/_/g, " ")}. The records behind these numbers were read over four weeks, and that is the window shown.`,
    disclosures: shared,
    lens: Object.freeze({
      open: fixture.lens.opens,
      projectId: state.lensProjectId,
      projectName: fixture.lens.opens ? readableName(state.lensProjectId) : null,
      line: fixture.lens.opens
        ? "You are looking at one project. What Home reads and where your work goes are both unchanged."
        : state.lensProjectId !== null
          ? "That project could not be opened. The page underneath is unchanged."
          : null,
      closeHref: state.lensProjectId !== null ? href({ lensProjectId: null }) : null,
      closeLabel: HOME_LAB_COPY.actions.closeLens,
    }),
  });

  // — Full briefing ————————————————————————————————————————————————
  const briefing: BriefingView = Object.freeze({
    state: state0,
    headline: MODE_HEADLINES.briefing,
    sections: todaySections(briefingResult, today, unreadable, href, true),
    accountingLine: accountingLineOf(briefingResult),
    accountingWithheldLine: briefingResult.accounting
      ? null
      : firstRun
        ? FIRST_RUN_ACCOUNTING_LINE
        : "The read cannot be accounted for exactly, because at least one source did not answer in full.",
    disclosures: shared,
    returnHref: href({ mode: "today", item: null }),
    returnLabel: HOME_LAB_COPY.actions.backToToday,
  });

  // — Chrome ————————————————————————————————————————————————————————
  const modes: readonly HomeModeLink[] = Object.freeze(
    (["today", "inbox", "my-work", "analytics"] as HomeMode[]).map((mode) =>
      Object.freeze({
        mode,
        label: MODE_NAMES[mode],
        href: href({ mode, item: null, event: null }),
        ariaCurrent:
          mode === state.mode
            ? ("page" as const)
            : mode === "today" && state.mode === "briefing"
              ? ("true" as const)
              : null,
        badge:
          mode === "inbox" && inbox.badge.rendered && inbox.badge.glyph !== null
            ? Object.freeze({ glyph: inbox.badge.glyph, announce: true })
            : null,
      }),
    ),
  );

  const scopeOptions: readonly ScopeOption[] = Object.freeze([
    ...(["project", "planning-period", "all"] as LabScope[]).map((kind) =>
      Object.freeze({
        id: `scope-${kind}`,
        label: scopeLabel(
          kind,
          projectsForScope(kind, world, state.workspaceId),
          unreadable,
        ),
        group: "read-scope" as const,
        href: href({
          homeScope: kind,
          // The Planning Period id is the operand of the scope, so a link that
          // asks for the season has to carry the season it means.
          planningPeriodId:
            kind === "planning-period"
              ? (state.planningPeriodId ?? scenarioScopeOf(world.id).planningPeriodId)
              : null,
        }),
        current: kind === scope.kind,
      }),
    ),
    ...world.projects.map((projectId) =>
      Object.freeze({
        id: `project-${projectId}`,
        // A Project that did not resolve is still offered, because the reader
        // asking for it is how they find out. It is offered without its name.
        label: readableName(projectId) ?? "A project that could not be read",
        group: "project" as const,
        href: href({ homeScope: "project", workspaceId: projectId, planningPeriodId: null }),
        current: scope.kind === "project" && scope.projectIds[0] === projectId,
      }),
    ),
  ]);

  const chrome: HomeChrome = Object.freeze({
    documentTitle: DOCUMENT_TITLES[state.mode],
    modeEyebrow: MODE_NAMES[state.mode],
    h1Line: MODE_HEADLINES[state.mode],
    modes,
    navLabel: "Home",
    skipLinkLabel: "Skip to main content",
    statusRegionLabel: "Home updates",
    scope: Object.freeze({
      label: scope.label,
      kind: scope.kind,
      helpLine: scope.helpLine,
      options: scopeOptions,
      resetHref:
        scope.kind === "project"
          ? null
          : href({ homeScope: "project", planningPeriodId: null }),
      resetLabel: HOME_LAB_COPY.actions.resetScope,
      coverageLine:
        scope.unresolvedIds.length > 0
          ? `Read ${scope.projectIds.length - scope.unresolvedIds.length} of ${scope.projectIds.length} projects.`
          : null,
    }),
    actor: Object.freeze({
      name: world.actor.name,
      roleLabel:
        world.actor.seat === "owner"
          ? "You own these projects"
          : world.actor.seat === "collaborator"
            ? "You work in this project"
            : "You have a limited seat here",
    }),
    activeProject: Object.freeze({
      // The id is what the reader is already holding in their URL, so it is not
      // a disclosure. The NAME is metadata and a Project that did not resolve
      // has none to give, whatever the fixture's project table still knows.
      id: state.workspaceId,
      name: readableName(state.workspaceId),
      line: !state.workspaceId
        ? "There is no project for new work to go to yet."
        : readableName(state.workspaceId)
          ? `Work you start from here goes to ${readableName(state.workspaceId) as string}.`
          : "The project new work would go to could not be read.",
    }),
    asOf: Object.freeze({
      iso: world.asOfIso,
      line: `Read at ${wallTime(world.asOfIso)} on ${absoluteDate(world.asOfIso)}.`,
    }),
  });

  return Object.freeze({
    // Rebuilt field by field rather than passed through. A caller handing in a
    // full `LabUrlState` is structurally allowed to, and passing it on would
    // put `v` back into the props at runtime while the type still said it was
    // not there.
    state: labViewState(state),
    world: Object.freeze({ id: world.id, label: world.label, proves: world.proves }),
    firstRun: firstRunView,
    chrome,
    today: today_,
    inbox,
    myWork,
    analytics,
    briefing,
    copy: HOME_LAB_COPY,
    motion: MOTION,
    hrefFor: href,
  });
}

// ── Small builders ──────────────────────────────────────────────────────────

function action(
  id: string,
  label: string,
  available: boolean,
  unavailableReason: string | null,
  href: string | null = null,
  needsSourceConfirmation = false,
): RowAction {
  return Object.freeze({ id, label, available, unavailableReason, href, needsSourceConfirmation });
}

const GROUP_REASON_LINES: Readonly<Record<string, string>> = Object.freeze({
  "blocked-by-dependency": "Waiting on something else to finish.",
  "in-waiting-column": "Parked in this project's waiting column.",
  overdue: "Past its date.",
  "due-today": "Due today.",
  "within-seven-days": "Due in the next seven days.",
  "beyond-window": "Further out than seven days.",
  "no-date": "No date on it.",
});

function myWorkRow(
  entry: GroupedRow,
  today: CalendarDate,
  unreadable: ReadonlySet<string>,
  href: (patch: Partial<LabViewState>) => string,
): MyWorkRowView {
  const row = entry.row;
  return Object.freeze({
    key: row.key,
    title: row.title,
    provenance: provenanceFor("Tasks", row.workspaceId, unreadable),
    group: entry.group,
    groupReasonLine: GROUP_REASON_LINES[entry.reason] ?? "In this group.",
    due: whenLabel(row.dueAtIso, today),
    dueUnparsedLine: row.dueUnparsed && row.dueLabel ? row.dueLabel : null,
    columnLabel: row.columnLabel,
    waitingLine:
      row.waiting === "unknown"
        ? "This project has no waiting column, so nothing can be marked as waiting here."
        : row.waiting === "blocked-by-dependency"
          ? `Waiting on ${plural(row.blockedByIds.length, "other item", "other items")}.`
          : row.waiting === "in-waiting-column"
            ? "Parked in the waiting column."
            : null,
    coAssigneeLine:
      row.coAssigneeCount > 0
        ? `${plural(row.coAssigneeCount, "other person is", "other people are")} on this too.`
        : null,
    isMilestone: row.isMilestone,
    href: href({ mode: "my-work", item: row.taskId }),
    sourcePath: row.href,
    actions: Object.freeze([
      action(
        "complete",
        "Mark as done",
        row.capabilities.complete === "allowed",
        row.capabilities.complete === "denied"
          ? "Your seat cannot finish work in this project."
          : row.capabilities.complete === "unverified"
            ? "Whether you can finish this could not be checked."
            : null,
        null,
        true,
      ),
      action(
        "reassign",
        "Change who owns it",
        row.capabilities.reassign === "allowed",
        row.capabilities.reassign === "denied"
          ? "Your seat cannot change who owns work in this project."
          : row.capabilities.reassign === "unverified"
            ? "Whether you can change this could not be checked."
            : null,
        null,
        true,
      ),
    ]),
  });
}

const EXCLUSION_WORDS: Readonly<Record<string, string>> = Object.freeze({
  archived_project: "in an archived project",
  unprojectable_row: "belonging to no project",
  subtask: "part of another item",
  unauthorized_project: "in a project you cannot read",
  unresolved_project: "in a project that did not answer",
  outside_window: "outside the window",
  missing_required_timestamp: "missing a time this needs",
  source_record_limit_reached: "past the number of records that could be read",
  owner_unmatched: "owned by somebody the reading could not match",
});

function claimView(
  claim: AnalyticsClaim,
  href: (patch: Partial<LabViewState>) => string,
): AnalyticsClaimView {
  const denominator = claim.population.denominator;
  const populationLine =
    "kind" in denominator
      ? `${claim.population.numerator.count} ${claim.population.numerator.label}. ${denominator.why}`
      : `${claim.population.numerator.count} ${claim.population.numerator.label} of ${denominator.count} ${denominator.label}.`;

  return Object.freeze({
    id: claim.id,
    question: claim.definition,
    metricLabel: claim.metric.replace(/_/g, " "),
    valueLabel: claim.value === null ? null : String(claim.value),
    status: claim.status,
    statusLine:
      claim.status === "available"
        ? null
        : claim.status === "insufficient_history"
          ? `Not enough history to say. ${claim.history.comparableSnapshots} of ${claim.history.required} readings so far.`
          : claim.status === "partial"
            ? claim.value === null
              ? "Part of this could not be read, so no total is shown."
              : "Part of this could not be read, so this can only under-count."
            : "Nothing produces this yet, so there is nothing to show.",
    definitionLine: claim.definition,
    populationLine,
    limitationLine: claim.limitation.text,
    windowLine:
      claim.window.kind === "as_of"
        ? `As read on ${absoluteDate(claim.window.asOf ?? claim.times.renderedAt)}.`
        : `Over ${claim.window.preset.replace(/_/g, " ")}, in ${claim.window.timezone}.`,
    coverageLine:
      claim.coverage.status === "ready"
        ? null
        : `This reading is ${claim.coverage.status === "partial" ? "partly complete" : claim.coverage.status}. ${claim.coverage.issues.length > 0 ? `${plural(claim.coverage.issues.length, "issue was", "issues were")} recorded.` : ""}`.trim(),
    permissionLine:
      claim.permission.kind === "complete"
        ? null
        : `Read ${claim.permission.readProjects} of ${claim.permission.membershipProjects} projects you belong to.`,
    baselineLine: HOME_LAB_COPY.noBaseline,
    truthClassLabel:
      claim.truthClass === "reported"
        ? "What the records say"
        : claim.truthClass === "observed"
          ? "What was measured"
          : "What was worked out from the records",
    evidenceHref: href({ mode: "analytics" }),
    evidenceLabel: HOME_LAB_COPY.actions.openEvidence,
    correctionLine: claim.correction.instruction,
    receipt: Object.freeze({
      includedCount: claim.population.included,
      excludedCount: claim.population.excluded.reduce((total, entry) => total + entry.count, 0),
      exclusionLines: Object.freeze(
        claim.population.excluded.map(
          (entry) =>
            `${plural(entry.count, "record", "records")} left out ${EXCLUSION_WORDS[entry.reason] ?? entry.reason}.`,
        ),
      ),
      ingestionLine: `The source was read at ${wallTime(claim.times.ingestionAt)} on ${absoluteDate(claim.times.ingestionAt)}.`,
      versionLine: `Counted by ${claim.provenance.metricVersion}.`,
    }),
    source: claim,
  });
}

export { STATE_NAMES };

import "server-only";

/**
 * Home's read (20 October 2026): the plain facts behind the launch
 * countdown, done this week, a year of activity and the four start cards.
 *
 * ── Authorization ──────────────────────────────────────────────────────────
 *
 * Membership is not decided here. The Projects are exactly the active rows of
 * `loadProjectPortfolio` (itself `loadProjectCatalogAction` for the
 * re-authenticated caller: flag gate, Review boundary and membership query
 * included), and every select below is filtered to those ids. It takes no
 * ids from a request and is not a Server Function. Chat figures come from the
 * same directed-attention read and gate as the sidebar's Chat badge.
 *
 * ── Cost and failure ───────────────────────────────────────────────────────
 *
 * The portfolio's own batched reads, plus four bounded selects here (column
 * settings, finish moments, this week's due dates, files added). Each guarded
 * on its own: a failed read leaves its figure out (null), it is never
 * guessed. Read-only: nothing here inserts, updates or deletes.
 */

import { and, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/server/db";
import { attachments, meta, resources, tasks, users } from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { isDoneColumnKey } from "@/lib/board-columns";
import { parseColumnConfig, type ColumnConfig } from "@/lib/board-config";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { projectColumnsMetaKey } from "@/lib/projects/project-hub";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { isProjectId } from "@/lib/projects/project-ref";
import { dayOrdinalIn, ordinalToIsoDate } from "@/lib/projects/project-console";
import type { PortfolioRow } from "@/lib/projects/project-portfolio";
import { firstNameOf } from "@/lib/home/home-words";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import {
  ACTIVITY_WEEKS,
  buildHomeBento,
  weekdayOfOrdinal,
  type HomeBento,
  type HomeLaunchFact,
  type HomeMessagesFact,
} from "@/lib/home/home-bento";
import { getCurrentUser } from "@/server/auth";
import { getUserPreferences } from "@/server/db/preferences";
import { loadProjectPortfolio } from "@/server/projects/project-portfolio";
import { reviewPortfolioRows } from "@/server/projects/project-portfolio-review";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { getProjectOverviewData } from "@/server/actions/project-overview";
import { validTimeZone } from "@/server/projects/project-console-facts";
import { loadInboxAttention } from "@/server/conversations/attention-loader";
import { authenticateConversationActor, getMessageAttentionService } from "@/server/conversations/runtime";
import { canShowMessagesForTools } from "@/app/app/tools/messages-gate";
import { unreadTotal } from "@/components/app/messages/demo-messages-model";
import { demoMessagesSnapshot } from "@/server/demo/messages-demo";

type Database = typeof db;

const DAY_MS = 86_400_000;
/** Finish moments read for the whole page; past it the latest win. */
export const HOME_COMPLETION_LIMIT = 50_000;
const FILE_READ_LIMIT = 5_000;
const FILE_WINDOW_DAYS = 30;

/** A stored timestamp column as epoch milliseconds. */
const msOf = (value: Date | number | null): number | null =>
  value === null ? null : value instanceof Date ? value.getTime() : value * 1000;

export type HomeFactsRead = Readonly<{
  /** projectId → finish moments (ms) of its done top-level tasks. */
  completions: ReadonlyMap<string, readonly number[]>;
  /** projectId → open top-level tasks due between `weekStart` and `weekEnd`. */
  dueThisWeek: ReadonlyMap<string, number>;
  truncated: boolean;
}>;

/**
 * The finish moments and this week's due dates. `projectIds` are already
 * authorized by the caller; nothing here decides membership.
 */
export async function readHomeFactsWith(
  database: Database,
  input: Readonly<{ projectIds: readonly string[]; since: number; weekStart: number; weekEnd: number }>,
): Promise<HomeFactsRead> {
  const ids = [...input.projectIds];
  if (ids.length === 0) return { completions: new Map(), dueThisWeek: new Map(), truncated: false };
  const [columnRows, finished, due] = await Promise.all([
    database.select({ key: meta.key, value: meta.value }).from(meta).where(inArray(meta.key, ids.map(projectColumnsMetaKey))),
    database
      .select({ workspaceId: tasks.workspaceId, lane: tasks.lane, boardColumnKey: tasks.boardColumnKey, completedAt: tasks.completedAt })
      .from(tasks)
      .where(and(inArray(tasks.workspaceId, ids), isNull(tasks.parentTaskId), isNotNull(tasks.completedAt), gte(tasks.completedAt, new Date(input.since))))
      .limit(HOME_COMPLETION_LIMIT + 1),
    database
      .select({ workspaceId: tasks.workspaceId, lane: tasks.lane, boardColumnKey: tasks.boardColumnKey })
      .from(tasks)
      .where(
        and(
          inArray(tasks.workspaceId, ids),
          isNull(tasks.parentTaskId),
          isNull(tasks.archivedAt),
          gte(tasks.dueAt, new Date(input.weekStart)),
          lt(tasks.dueAt, new Date(input.weekEnd)),
        ),
      ),
  ]);
  const configs = new Map<string, ColumnConfig | null>();
  const raw = new Map(columnRows.map((row) => [row.key, row.value]));
  const configOf = (id: string) => {
    if (!configs.has(id)) {
      const value = raw.get(projectColumnsMetaKey(id));
      configs.set(id, value ? parseColumnConfig(value) : null);
    }
    return configs.get(id) ?? null;
  };
  const allowed = new Set(ids);
  const done = (row: { workspaceId: string | null; lane: string; boardColumnKey: string | null }) =>
    isDoneColumnKey(row.boardColumnKey || row.lane, configOf(row.workspaceId!));

  const completions = new Map<string, number[]>();
  for (const row of finished.slice(0, HOME_COMPLETION_LIMIT)) {
    // A finish moment on a task that is open again is stale; the column decides.
    if (!row.workspaceId || !allowed.has(row.workspaceId) || !done(row)) continue;
    const ms = msOf(row.completedAt);
    if (ms === null) continue;
    const list = completions.get(row.workspaceId) ?? [];
    list.push(ms);
    completions.set(row.workspaceId, list);
  }
  const dueThisWeek = new Map<string, number>();
  for (const row of due) {
    if (!row.workspaceId || !allowed.has(row.workspaceId) || done(row)) continue;
    dueThisWeek.set(row.workspaceId, (dueThisWeek.get(row.workspaceId) ?? 0) + 1);
  }
  return { completions, dueThisWeek, truncated: finished.length > HOME_COMPLETION_LIMIT };
}

/** Files added to live tasks in these Projects since `since`, counted once each. */
export async function readFilesAddedWith(
  database: Database,
  input: Readonly<{ projectIds: readonly string[]; since: number }>,
): Promise<number> {
  const ids = [...input.projectIds];
  if (ids.length === 0) return 0;
  const [resourceRows, attachmentRows] = await Promise.all([
    database
      .select({ id: resources.id })
      .from(resources)
      .innerJoin(tasks, eq(tasks.id, resources.taskId))
      .where(and(inArray(resources.workspaceId, ids), inArray(tasks.workspaceId, ids), isNull(tasks.archivedAt), gte(resources.addedAt, Math.floor(input.since / 1000))))
      .limit(FILE_READ_LIMIT),
    database
      .select({ id: attachments.id })
      .from(attachments)
      .innerJoin(tasks, eq(tasks.id, attachments.taskId))
      .where(and(inArray(tasks.workspaceId, ids), isNull(tasks.archivedAt), gte(attachments.createdAt, new Date(input.since))))
      .limit(FILE_READ_LIMIT),
  ]);
  // An attachment mirrored as resource `res-<id>` is one file, not two.
  const mirrored = new Set(resourceRows.map((row) => row.id));
  return resourceRows.length + attachmentRows.filter((row) => !mirrored.has(`res-${row.id}`)).length;
}

/** Chat: the same gate and directed-attention read as the sidebar badge. Null on failure. */
async function readMessages(): Promise<HomeMessagesFact | null> {
  if (!(await canShowMessagesForTools())) return { available: false, unread: 0, conversations: 0 };
  const { attention, available } = await loadInboxAttention({ authenticate: authenticateConversationActor, service: getMessageAttentionService });
  if (!available) return null;
  const waiting = (attention ?? []).filter((item) => item.kind === "conversation" && item.seenAt === null);
  return { available: true, unread: waiting.length, conversations: new Set(waiting.map((item) => item.scopeId)).size };
}

/** The slice of a portfolio row Home reads. */
type HomeRow = Pick<
  PortfolioRow,
  "id" | "name" | "start" | "target" | "total" | "complete" | "status" | "statsKnown" | "milestones" | "href" | "sample" | "archived"
>;

/**
 * With the Project list switched off there is no list to read, so Home falls
 * back to the one Project the route's own resolver proves for this caller,
 * read through its overview (open milestones only). Null when neither can be
 * read; empty when the reader has no Project yet.
 */
async function routeProjectRows(dayOf: (ms: number) => number): Promise<HomeRow[] | null> {
  const decision = await resolveProjectForRoute();
  if (decision.kind === "empty") return [];
  if (decision.kind !== "ready") return null;
  const overview = await getProjectOverviewData(decision.project.id);
  const iso = (value: string | null) => (value && !Number.isNaN(Date.parse(value)) ? ordinalToIsoDate(dayOf(Date.parse(value))) : null);
  return [
    {
      id: overview.workspaceId,
      name: overview.displayName,
      start: iso(overview.createdAt),
      target: overview.targetDate ? overview.targetDate.slice(0, 10) : null,
      total: overview.taskStats.total,
      complete: overview.taskStats.complete,
      status: overview.declaredStatus,
      statsKnown: true,
      milestones: overview.milestones.flatMap((m) => {
        const date = iso(m.dueAt);
        return date ? [{ id: m.id, title: m.title, date, done: false }] : [];
      }),
      href: null,
      sample: false,
      archived: false,
    },
  ];
}

function launchFact(row: HomeRow, completions: readonly number[], dueThisWeek: number): HomeLaunchFact | null {
  if (!row.target || !row.start || !row.statsKnown || row.status === "complete" || (row.sample && !isDemoMode())) return null;
  if (!isProjectId(row.id)) return null;
  return {
    id: row.id,
    name: row.name,
    href: row.href ?? buildProjectUrl({ surface: "timeline" }, row.id, row.name),
    tasksHref: buildProjectUrl({ surface: "tasks" }, row.id, row.name),
    start: row.start,
    target: row.target,
    total: row.total,
    complete: row.complete,
    completions,
    milestones: row.milestones.map((m) => ({ title: m.title, date: m.date, done: m.done })),
    dueThisWeek,
  };
}

async function readerZoneAndName(): Promise<{ timeZone: string; firstName: string | null }> {
  try {
    const userId = await getCurrentUser();
    const [preferences, [viewer]] = await Promise.all([
      getUserPreferences(userId).catch(() => null),
      db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    ]);
    return { timeZone: validTimeZone(preferences?.timeZone ?? null), firstName: firstNameOf(viewer?.name) };
  } catch (error) {
    unstable_rethrow(error);
    return { timeZone: "UTC", firstName: null };
  }
}

/**
 * Review and demo mode have no database. The review Project and the labelled
 * sample rows come from the portfolio's own review read; their finish
 * history is spread evenly across each Project's days so far, on the pinned
 * review clock, and the year's activity is a fixed, seeded pattern.
 */
async function demoHomeBento(): Promise<HomeBento | null> {
  const portfolio = await loadProjectPortfolio();
  const now = Date.parse(`${PINNED_REVIEW_CALENDAR_FRAME.today}T09:00:00.000Z`);
  const rows: readonly HomeRow[] = portfolio?.kind === "ready" ? portfolio.rows : reviewPortfolioRows();
  const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
  const spread = (row: HomeRow) => {
    if (!row.start) return [];
    const from = dayMs(row.start);
    const step = Math.max(DAY_MS, (now - from) / Math.max(1, row.complete));
    return Array.from({ length: row.complete }, (_, i) => Math.min(now, from + step * (i + 0.5)));
  };
  let seed = 11;
  const rnd = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const year: number[] = [];
  for (let d = ACTIVITY_WEEKS * 7 + 7; d >= 0; d--) {
    const day = now - d * DAY_MS;
    const recent = d < 120 ? 1 : d < 220 ? 0.6 : 0.25;
    const weekend = weekdayOfOrdinal(Math.floor(day / DAY_MS)) >= 5 ? 0.3 : 1;
    const n = rnd() < 0.25 + recent * 0.5 ? Math.round(rnd() * 7 * recent * weekend) : 0;
    for (let i = 0; i < n; i++) year.push(day - Math.floor(rnd() * 8) * 3_600_000);
  }
  // This week so far is fixed, so review always shows a week under way: 3, 2, 4, 1 from Monday.
  const today = Math.floor(now / DAY_MS);
  const monday = today - weekdayOfOrdinal(today);
  const thisWeek = [3, 2, 4, 1, 2, 0, 0];
  const history = year.filter((ms) => Math.floor(ms / DAY_MS) < monday);
  for (let d = monday; d <= today; d++) {
    for (let i = 0; i < thisWeek[d - monday]!; i++) history.push(d * DAY_MS + (8 + i * 2) * 3_600_000);
  }
  const launches = rows.map((row) => launchFact(row, spread(row), Math.min(3, row.total - row.complete))).filter((l): l is HomeLaunchFact => l !== null);
  const snapshot = demoMessagesSnapshot();
  const unread = unreadTotal(snapshot.conversations);
  return buildHomeBento({
    now,
    timeZone: "UTC",
    greetingHour: 9,
    firstName: firstNameOf(REVIEW_SUITE_FIXTURE.user.name),
    hasProjects: rows.length > 0,
    launches,
    completions: history,
    dueThisWeek: launches.reduce((a, l) => a + l.dueThisWeek, 0),
    openTasks: rows.reduce((a, row) => a + Math.max(0, row.total - row.complete), 0),
    activeProjects: rows.filter((row) => row.status !== "complete").length,
    finishedProjects: rows.filter((row) => row.status === "complete").length,
    filesThisMonth: 8,
    messages: { available: true, unread, conversations: snapshot.conversations.filter((c) => unreadTotal([c]) > 0).length },
  });
}

/**
 * Null when the Project list could not be read at all; the page then says so
 * and still offers the way into Tasks. Never throws for a partial failure.
 */
export async function loadHomeBento(): Promise<HomeBento | null> {
  if (isDemoMode()) {
    try {
      return await demoHomeBento();
    } catch (error) {
      unstable_rethrow(error);
      return null;
    }
  }

  const [portfolio, reader] = await Promise.all([loadProjectPortfolio(), readerZoneAndName()]);
  const dayOf = dayOrdinalIn(reader.timeZone);
  if (portfolio?.kind === "unavailable") return null;
  const listed = portfolio ? portfolio.rows : await routeProjectRows(dayOf).catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!listed) return null;
  const rows = listed.filter((row) => !row.archived);
  const ids = rows.map((row) => row.id);
  const statsUnavailable = portfolio ? portfolio.statsUnavailable : false;

  const now = Date.now();
  const today = dayOf(now);
  // Week edges as instants: the reader's Monday and next Monday, found by
  // stepping hours so a daylight-saving change cannot shift them.
  const edge = (ordinal: number) => {
    let t = ordinal * DAY_MS - 14 * 3_600_000;
    while (dayOf(t) < ordinal) t += 3_600_000;
    return t;
  };
  const monday = today - weekdayOfOrdinal(today);
  const yearStart = (monday - (ACTIVITY_WEEKS - 1) * 7 - 1) * DAY_MS;
  const launchStarts = rows.flatMap((row) => (row.target && row.start ? [Date.parse(`${row.start}T00:00:00Z`) - DAY_MS] : []));
  const since = Math.min(yearStart, ...launchStarts);

  const [facts, files, messages] = await Promise.all([
    readHomeFactsWith(db, { projectIds: ids, since, weekStart: edge(monday), weekEnd: edge(monday + 7) }).then((v) => v, () => null),
    readFilesAddedWith(db, { projectIds: ids, since: now - FILE_WINDOW_DAYS * DAY_MS }).then((v) => v, () => null),
    readMessages().then((v) => v, () => null),
  ]);

  const known = rows.filter((row) => row.statsKnown);
  return buildHomeBento({
    now,
    timeZone: reader.timeZone,
    firstName: reader.firstName,
    hasProjects: rows.length > 0,
    // Without the task read the countdown still stands on the Project's own counts.
    launches: rows
      .map((row) => launchFact(row, facts?.completions.get(row.id) ?? [], facts?.dueThisWeek.get(row.id) ?? 0))
      .filter((l): l is HomeLaunchFact => l !== null),
    completions: facts ? [...facts.completions.values()].flat().filter((ms) => ms >= yearStart) : null,
    dueThisWeek: facts ? [...facts.dueThisWeek.values()].reduce((a, n) => a + n, 0) : null,
    openTasks: statsUnavailable ? null : known.reduce((a, row) => a + Math.max(0, row.total - row.complete), 0),
    activeProjects: rows.filter((row) => row.status !== "complete").length,
    finishedProjects: rows.filter((row) => row.status === "complete").length,
    filesThisMonth: files,
    messages,
  });
}

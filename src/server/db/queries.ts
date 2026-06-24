import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  like,
  sql,
} from "drizzle-orm";
import { db } from "./index";
import {
  tasks,
  comments,
  activities,
  attachments,
  notifications,
  shareLinks,
  shareLinkVisits,
  workspaces,
  workspaceMembers,
  users,
} from "./schema";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { LANE_ORDER } from "@/lib/data";
import type { Notification, NotificationPayload } from "@/lib/data";
import type {
  Activity,
  ActivityKind,
  ActivityPayload,
  Attachment,
  Comment,
  Task,
  UserId,
} from "@/lib/data";

import { rowToTask } from "./row-mappers";
import { byWorkspace } from "./tenant";
import { withReadRetry } from "./retry";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_DOMAIN, demoTasks } from "@/server/demo/tasks-demo";

const taskColumnsWithCount = {
  ...getTableColumns(tasks),
  commentCount:
    sql<number>`(SELECT COUNT(*) FROM ${comments} WHERE ${comments.taskId} = ${tasks.id})`.as(
      "comment_count",
    ),
};

// Lane ordering matches the client's LANE_ORDER. Encoded as a CASE
// expression so SQL can sort the (string) lane column the same way
// the UI does. Unknown lanes sort last.
const laneOrderSql = sql`CASE ${tasks.lane} ${sql.join(
  LANE_ORDER.map((lane, i) => sql`WHEN ${lane} THEN ${i}`),
  sql` `,
)} ELSE ${LANE_ORDER.length} END`;

// Stable in-lane order: explicit float `position` first, falling back
// to created-at (as unix seconds) so seed/legacy rows land in
// insertion order without renumbering.
const positionOrderSql = sql`COALESCE(${tasks.position}, CAST(${tasks.createdAt} AS REAL))`;

export async function getTasks(workspaceId: string): Promise<Task[]> {
  // Demo/Review: serve the in-memory venue board; never reach the real DB.
  if (isDemoMode()) return demoTasks();
  // Top-level only — subtasks (rows with a non-null parent_task_id)
  // live exclusively in the detail panel for cycle 25. They'd
  // otherwise multiply into the board / list / timeline / calendar
  // alongside their parents.
  return withReadRetry(async () => {
  const rows = await db
    .select(taskColumnsWithCount)
    .from(tasks)
    .where(byWorkspace(tasks.workspaceId, workspaceId, isNull(tasks.parentTaskId)))
    .orderBy(laneOrderSql, positionOrderSql)
    // Hard safety cap. The board/list/timeline never need more than
    // this, and the public `/p/{slug}` share path resolves through
    // here too — without a bound a runaway workspace would scan the
    // whole table on every public page hit. 2000 is well past any
    // real workspace; if a workspace legitimately exceeds it, the
    // overflow is the long tail of oldest in-lane rows.
    .limit(2000);
    return rows.map(rowToTask);
  });
}

/**
 * Children of a parent task — the subtask checklist rendered in the
 * detail panel. Ordered by createdAt ascending so the panel reads in
 * the order the user added items. Lives outside `getTasks` so the
 * top-level views never accidentally surface subtasks alongside their
 * parents.
 */
export async function getSubtasks(parentTaskId: string): Promise<Task[]> {
  const rows = await db
    .select(taskColumnsWithCount)
    .from(tasks)
    .where(eq(tasks.parentTaskId, parentTaskId))
    .orderBy(asc(tasks.createdAt))
    // Bound the detail-panel subtask list. One level of nesting only; a
    // task with hundreds of subtasks is already pathological — cap so a
    // runaway parent can't balloon the panel payload.
    .limit(500);
  return rows.map(rowToTask);
}

/** Resolve a published workspace by its public slug for `/p/{slug}`.
 *  Returns null when the slug is unknown OR the workspace exists but
 *  hasn't been published. The public route uses the null return as
 *  its 404 signal. Tasks come back ordered the same way as the
 *  authenticated app for consistency. */
export async function getPublishedWorkspaceBySlug(slug: string): Promise<
  | {
      id: string;
      slug: string;
      name: string;
      activeDomain: DomainId | null;
      publishedAt: Date;
      tasks: Task[];
    }
  | null
> {
  const [ws] = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      activeDomain: workspaces.activeDomain,
      publishedAt: workspaces.publishedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  if (!ws || !ws.publishedAt) return null;
  const taskList = await getTasks(ws.id);
  return {
    id: ws.id,
    slug: ws.slug,
    name: ws.name,
    activeDomain: (ws.activeDomain as DomainId | null) ?? null,
    publishedAt: ws.publishedAt,
    tasks: taskList,
  };
}

/** Lightweight read of a workspace's publish state — used by the
 *  Settings UI to render the publish toggle without dragging the
 *  full workspace row in. */
export async function getWorkspacePublishState(
  workspaceId: string,
): Promise<{ slug: string; publishedAt: Date | null }> {
  const [row] = await db
    .select({
      slug: workspaces.slug,
      publishedAt: workspaces.publishedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!row)
    throw new Error(`Workspace ${workspaceId} not found.`);
  return { slug: row.slug, publishedAt: row.publishedAt };
}

export async function getTaskById(id: string): Promise<Task | null> {
  return withReadRetry(async () => {
    const [row] = await db
      .select(taskColumnsWithCount)
      .from(tasks)
      .where(eq(tasks.id, id));
    return row ? rowToTask(row) : null;
  });
}

/**
 * Escape SQL LIKE wildcards in a string so a literal `%` or `_`
 * matches itself rather than acting as a wildcard. Drizzle doesn't
 * auto-escape — caller responsibility.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Tasks where the given user is in the JSON `assignees` array.
 * Pattern uses surrounding double-quotes (`%"david"%`) so we match
 * exact tokens, not substrings. The userId is escaped via `escapeLike`
 * so a userId containing `%` or `_` can't be used to widen the match.
 */
export async function getTasksForUser(
  userId: UserId,
  workspaceId: string,
): Promise<Task[]> {
  // Mirror `getTasks` — only top-level rows. Subtasks are scoped to
  // their parent's detail panel, not surfaced in per-user lists.
  const escapedId = escapeLike(userId);
  const rows = await db
    .select(taskColumnsWithCount)
    .from(tasks)
    .where(
      byWorkspace(
        tasks.workspaceId,
        workspaceId,
        isNull(tasks.parentTaskId),
        like(tasks.assignees, `%"${escapedId}"%`),
      ),
    )
    .orderBy(laneOrderSql, positionOrderSql)
    // Mirror getTasks' hard cap — a per-user view is a subset of the board
    // and must never scan unbounded.
    .limit(2000);
  return rows.map(rowToTask);
}

type CommentRow = typeof comments.$inferSelect & { authorName: string | null };

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId as UserId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export async function getCommentsForTask(
  taskId: string,
): Promise<Comment[]> {
  return withReadRetry(async () => {
  const rows = await db
    .select({
      ...getTableColumns(comments),
      // M7: COALESCE name → handle → email-prefix so real users never
      // show as "Someone" even when name hasn't been backfilled yet.
      authorName: sql<string | null>`COALESCE(${users.name}, ${users.handle}, CASE WHEN ${users.email} IS NOT NULL THEN SUBSTR(${users.email}, 1, INSTR(${users.email}, '@') - 1) END)`,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt))
    // Bound a single task's thread. A 500-comment task is already past any
    // real workflow; the cap keeps the detail panel payload and the AI
    // summarize context from scaling without limit.
    .limit(500);
    return rows.map(rowToComment);
  });
}

type ActivityRow = typeof activities.$inferSelect & { authorName: string | null };

function rowToActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId as UserId,
    authorName: row.authorName,
    kind: row.kind as ActivityKind,
    payload: row.payload as ActivityPayload,
    createdAt: row.createdAt,
  };
}

export async function getActivitiesForTask(
  taskId: string,
): Promise<Activity[]> {
  return withReadRetry(async () => {
  const rows = await db
    .select({
      ...getTableColumns(activities),
      // M7: same COALESCE as comments — name → handle → email-prefix.
      authorName: sql<string | null>`COALESCE(${users.name}, ${users.handle}, CASE WHEN ${users.email} IS NOT NULL THEN SUBSTR(${users.email}, 1, INSTR(${users.email}, '@') - 1) END)`,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.taskId, taskId))
    .orderBy(desc(activities.createdAt))
    .limit(50);
    return rows.map(rowToActivity);
  });
}

type AttachmentRow = typeof attachments.$inferSelect;

function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    taskId: row.taskId,
    uploaderUserId: row.uploaderUserId as UserId,
    filename: row.filename,
    storedPath: row.storedPath,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

/** Attachments bound to a task — oldest first so the panel reads top-
 *  down in upload order. Workspace-scoped reads happen at the action
 *  layer (the action resolves the active workspace and ensures the
 *  parent task belongs to it). */
export async function getAttachmentsForTask(
  taskId: string,
): Promise<Attachment[]> {
  const rows = await db
    .select()
    .from(attachments)
    .where(eq(attachments.taskId, taskId))
    .orderBy(asc(attachments.createdAt))
    // Bound the per-task attachment list — defensive cap well past any real
    // file count on a single task.
    .limit(200);
  return rows.map(rowToAttachment);
}

/** Single attachment lookup — used by the authenticated download
 *  route so it can re-check workspace membership before streaming
 *  the bytes. Returns null when the id is unknown. */
export async function getAttachmentById(
  id: string,
): Promise<Attachment | null> {
  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id));
  return row ? rowToAttachment(row) : null;
}

/** Read-through accessor for the active domain on a workspace.
 *  Defaults to "marketing" when unset. */
export async function getActiveDomain(
  workspaceId: string,
): Promise<DomainId> {
  if (isDemoMode()) return DEMO_DOMAIN;
  const [row] = await db
    .select({ activeDomain: workspaces.activeDomain })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const v = row?.activeDomain as DomainId | null | undefined;
  if (v && v in DOMAINS) return v;
  return "marketing";
}

/** True when the workspace has never completed onboarding. Reuses the
 *  `workspaces.activeDomain` column as the signal — a null domain
 *  means the welcome flow hasn't run yet for this workspace. */
export async function isFirstRun(workspaceId: string): Promise<boolean> {
  // Demo/Review: the seeded workspace is always "onboarded" so the app shell
  // renders the board instead of redirecting to /welcome.
  if (isDemoMode()) return false;
  const [row] = await db
    .select({ activeDomain: workspaces.activeDomain })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return !row || row.activeDomain == null;
}

/** Discriminated union — one row of the merged Conversation feed
 *  (comments + activity). Renderers branch on `.kind`. */
export type ConversationItem =
  | { kind: "comment"; comment: Comment }
  | { kind: "activity"; activity: Activity };

/**
 * Merged chronological conversation: every comment + every activity
 * for a task, oldest first. The detail panel renders this as a single
 * stream so users see one unified history.
 */
export async function getTaskConversation(
  taskId: string,
): Promise<ConversationItem[]> {
  const [c, a] = await Promise.all([
    getCommentsForTask(taskId),
    getActivitiesForTask(taskId),
  ]);
  const items: ConversationItem[] = [
    ...c.map((comment) => ({ kind: "comment" as const, comment })),
    // getActivitiesForTask returns desc; flip to asc for the feed.
    ...a.map((activity) => ({ kind: "activity" as const, activity })),
  ];
  items.sort(
    (x, y) => keyOf(x).getTime() - keyOf(y).getTime(),
  );
  return items;
}

function keyOf(i: ConversationItem): Date {
  return i.kind === "comment" ? i.comment.createdAt : i.activity.createdAt;
}

export type ShareView = "board" | "list" | "timeline" | "calendar";

export type ShareData = {
  token: string;
  view: ShareView;
  tasks: Task[];
  workspaceTitle: string;
  workspaceCrumb: string;
  domainId: DomainId;
};

type NotificationRow = typeof notifications.$inferSelect;

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId as UserId,
    kind: row.kind,
    taskId: row.taskId ?? null,
    payload: row.payload as NotificationPayload,
    createdAt: row.createdAt,
    readAt: row.readAt ?? null,
  };
}

/** Notifications for a user in a specific workspace, newest first. */
export async function getNotificationsForUser(
  userId: UserId,
  workspaceId: string,
): Promise<Notification[]> {
  return withReadRetry(async () => {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      byWorkspace(
        notifications.workspaceId,
        workspaceId,
        eq(notifications.userId, userId),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);
    return rows.map(rowToNotification);
  });
}

/**
 * Record a single visit against a share link. Inserts a row into
 * `share_link_visits` so the manage popover can render a 7-day
 * sparkline and a "last visited" timestamp. The fast `visits`
 * counter on `share_links` is bumped by the action layer alongside
 * this insert.
 *
 * `userAgent` is truncated to 60 chars defensively — long enough to
 * tell phone-vs-desktop later, short enough to avoid hoarding raw UA
 * strings.
 */
export async function recordShareLinkVisit(
  token: string,
  userAgent?: string | null,
): Promise<void> {
  const id =
    globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16) ??
    Math.random().toString(36).slice(2, 18);
  const hint = userAgent ? userAgent.slice(0, 60) : null;
  await db.insert(shareLinkVisits).values({
    id,
    token,
    userAgentHint: hint,
  });
}

/** Per-link aggregated visit shape powering the manage popover. */
export type ShareLinkAnalytics = {
  token: string;
  total: number;
  /** 7-day visit counts, oldest → newest. Length always 7. */
  last7: number[];
  /** ISO timestamp of the most recent visit, or `null` if none. */
  lastVisitedAt: string | null;
};

/**
 * Aggregate visit data across every share link in the workspace.
 * Returns one entry per link (even links with zero visits — those
 * are filled in by the action layer joining against `share_links`).
 */
export async function getShareLinkVisitAnalytics(
  tokens: string[],
): Promise<Map<string, ShareLinkAnalytics>> {
  const out = new Map<string, ShareLinkAnalytics>();
  if (tokens.length === 0) return out;
  // 7 day window, in days, midnight-aligned to "today" in server tz.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStartMs = today.getTime() - 6 * 24 * 60 * 60 * 1000;
  const windowStartSec = Math.floor(windowStartMs / 1000);

  for (const token of tokens) {
    out.set(token, {
      token,
      total: 0,
      last7: [0, 0, 0, 0, 0, 0, 0],
      lastVisitedAt: null,
    });
  }

  // Pull every visit row in the window for these tokens, plus a
  // single `MAX(visited_at)` per token. Drizzle's IN-array helper
  // would be cleaner but the raw SQL keeps the query count at two
  // and avoids a dynamic-IN-clause foot-gun on big workspaces.
  const rows = await db
    .select({
      token: shareLinkVisits.token,
      visitedAt: shareLinkVisits.visitedAt,
    })
    .from(shareLinkVisits)
    .where(
      and(
        sql`${shareLinkVisits.token} IN (${sql.join(
          tokens.map((t) => sql`${t}`),
          sql`, `,
        )})`,
        sql`${shareLinkVisits.visitedAt} >= ${windowStartSec}`,
      ),
    );

  // Count per-day buckets for each token.
  for (const r of rows) {
    const entry = out.get(r.token);
    if (!entry) continue;
    const dayOffset = Math.floor(
      (r.visitedAt.getTime() - windowStartMs) / (24 * 60 * 60 * 1000),
    );
    if (dayOffset >= 0 && dayOffset < 7) {
      entry.last7[dayOffset]++;
    }
  }

  // Last-visited timestamp (any time, not just inside the window).
  const lastRows = await db
    .select({
      token: shareLinkVisits.token,
      lastAt: sql<number>`MAX(${shareLinkVisits.visitedAt})`.as("last_at"),
    })
    .from(shareLinkVisits)
    .where(
      sql`${shareLinkVisits.token} IN (${sql.join(
        tokens.map((t) => sql`${t}`),
        sql`, `,
      )})`,
    )
    .groupBy(shareLinkVisits.token);

  for (const r of lastRows) {
    const entry = out.get(r.token);
    if (!entry || r.lastAt == null) continue;
    // sqlite returns a unix-seconds integer here.
    entry.lastVisitedAt = new Date(r.lastAt * 1000).toISOString();
  }

  return out;
}

/** Resolve a share token to its read-only payload. Returns `null`
 *  when the token is unknown, revoked, past its expiry, or scoped
 *  to a workspace that no longer exists. Callers render a 404. */
export async function resolveShareLink(
  token: string,
): Promise<ShareData | null> {
  const [row] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token));
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Share-link rows minted before Phase A may have a null
  // workspaceId; fall back to the legacy workspace so dev links
  // keep resolving.
  const wsId = row.workspaceId ?? "ws-legacy";
  const [taskList, domainId] = await Promise.all([
    getTasks(wsId),
    getActiveDomain(wsId),
  ]);
  const pack = DOMAINS[domainId];
  return {
    token,
    view: row.view,
    tasks: taskList,
    workspaceTitle: pack.workspaceTitle,
    workspaceCrumb: pack.workspaceCrumb,
    domainId,
  };
}

// ── RW-3c Producer shape ─────────────────────────────────────────────────────

/**
 * RW-3b/3c: Read all milestone tasks for a given owner email.
 *
 * This is the PRODUCER side of the Roadmap sync read shape (ARCH_SPEC §1.2).
 * The Roadmap app reads the Tasks DB directly (Analytics precedent, D2) — it
 * imports this query's return type as its data contract. This function lives
 * in Tasks as the canonical source; the Roadmap's tasks-milestone-source.ts
 * calls the same SQL via its own read-only Turso client connection.
 *
 * Shape returned (ARCH_SPEC §1.2):
 *   id, title, lane, dueAt, isMilestone, workspaceId,
 *   workspaceSlug, workspaceName, ownerEmail
 *
 * Constraints:
 *   - Top-level tasks only (parent_task_id IS NULL) — subtask milestones
 *     are not surfaced; the roadmap spine is flat in v1.
 *   - WHERE is_milestone = 1 — additive filter, never a task dump.
 *   - Email-keyed (the only cross-product key between Clerk apps; D2).
 *   - Ordered by workspace then due date for stable pagination.
 *   - Hard LIMIT 200 — same safety cap as getTasks.
 *
 * D6 contract: this read is pure projection. Nothing here auto-publishes.
 */
export type MilestoneTaskRow = {
  id: string;
  title: string;
  lane: string;
  dueAt: Date | null;
  isMilestone: boolean;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  ownerEmail: string | null;
};

export async function getMilestoneTasks(
  ownerEmail: string,
): Promise<MilestoneTaskRow[]> {
  // 1. Resolve the user row by email.
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);
  if (!user) return [];

  // 2. Fetch all milestone top-level tasks where the user is a workspace
  //    member, joined to their workspace for slug + name.
  //    The workspace owner check uses workspace_members (the join table
  //    that covers both owner and member roles) so workspace owners who
  //    haven't explicitly been added as members still resolve correctly
  //    (ownerUserId is in workspace_members as role='owner').
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      lane: tasks.lane,
      dueAt: tasks.dueAt,
      isMilestone: tasks.isMilestone,
      workspaceId: workspaces.id,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
      ownerEmail: users.email,
    })
    .from(tasks)
    .innerJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .innerJoin(users, eq(users.id, user.id))
    .where(
      and(
        eq(tasks.isMilestone, true),
        isNull(tasks.parentTaskId),
      ),
    )
    .orderBy(asc(tasks.workspaceId), asc(tasks.dueAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    lane: r.lane,
    dueAt: r.dueAt ?? null,
    isMilestone: r.isMilestone,
    workspaceId: r.workspaceId,
    workspaceSlug: r.workspaceSlug,
    workspaceName: r.workspaceName,
    ownerEmail: r.ownerEmail ?? null,
  }));
}

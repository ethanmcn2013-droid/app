import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import type {
  Activity,
  ActivityKind,
  ActivityPayload,
  Attachment,
  Comment,
  CompCode,
  Entitlement,
  EntitlementSource,
  EntitlementTier,
  LaneId,
  Notification,
  NotificationKind,
  NotificationPayload,
  Priority,
  Recurrence,
  Task,
  UserId,
} from "@/lib/data";
import type {
  PlanningPeriodContext,
  WorkspaceContext,
} from "@/lib/planning/context";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  /** Per-tenant boundary. Nullable during the cutover; tightened to
   *  NOT NULL after the legacy backfill lands. Cascade on workspace
   *  delete kills the workspace's whole task tree. */
  workspaceId: text("workspace_id"),
  /** Human-readable per-workspace counter (T-14), display + reference
   *  only — `id` stays the stable primary key everywhere. Allocated by
   *  `nextTaskSeq()` (an atomic MAX+1 subquery inside the INSERT; the
   *  unique (workspace_id, seq) index in 0021 is the concurrency
   *  backstop). Nullable: legacy rows were backfilled by 0021, and a
   *  writer that skips allocation degrades to the hex-id display. */
  seq: integer("seq"),
  title: text("title").notNull(),
  description: text("description"),
  lane: text("lane").$type<LaneId>().notNull(),
  priority: text("priority").$type<Priority>().notNull(),
  assignees: text("assignees", { mode: "json" })
    .$type<UserId[]>()
    .notNull()
    .default(sql`'[]'`),
  due: text("due"),
  /** Structured timestamp parsed from `due` (and optionally an
   *  NLP-stripped quick-add). Used by date-aware queries (today's
   *  digest, overdue) without re-parsing the human label every read. */
  dueAt: integer("due_at", { mode: "timestamp" }),
  estimate: integer("estimate"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  // `comments` count is derived in the query layer (LEFT JOIN /
  // subquery on the comments table), never persisted on tasks.
  idleDays: integer("idle_days"),
  blockedBy: text("blocked_by", { mode: "json" }).$type<string[]>(),
  recurrence: text("recurrence", { mode: "json" }).$type<Recurrence>(),
  startDay: integer("start_day"),
  durationDays: integer("duration_days"),
  /** Float gap-numbering for stable in-lane ordering. NULL means
   *  "fall back to creation order", `getTasks` COALESCEs accordingly.
   *  Drops between two siblings compute (prev + next) / 2 so neighbors
   *  never need renumbering. */
  position: real("position"),
  /** Optional parent task. NULL on every top-level task; non-null
   *  rows are subtasks (one level of nesting in v1, subtasks don't
   *  themselves nest further). The detail panel loads children via
   *  `getSubtasks(parentId, workspaceId)`; `getTasks` filters to `parent_task_id
   *  IS NULL` so subtasks stay out of board / list / timeline /
   *  calendar in this cycle and live exclusively under their parent. */
  parentTaskId: text("parent_task_id"),
  /** Optional outside person attached to the task, wedding planner's
   *  vendor, freelance client invoice contact, anyone the work
   *  involves who isn't a workspace member. Both fields nullable;
   *  the panel renders whichever are present. */
  externalContactName: text("external_contact_name"),
  externalContactEmail: text("external_contact_email"),
  /** Optional dollar amount attached to the task, wedding planner's
   *  vendor invoice ($1,200 deposit), freelancer's billable rate,
   *  anywhere a number would otherwise leak into a separate Notion
   *  or Sheet. Stored as integer cents to dodge float drift. Nullable
   *  when no amount is set. Server clamps to [0, 99_999_999]. */
  cents: integer("cents"),
  /** Optional pointer back to the Signal Notes note that spawned this
   *  task via the cross-repo extract write (Cycle 9.4b second half,
   *  2026-05-12). Format: `{ownerUserId}:{noteId}`, keeps the
   *  idempotency check user-scoped without needing a separate join.
   *  Null on every task created in Tasks directly. The Notes raw body
   *  never lands here, only the creator-authored extract_body becomes
   *  the task title. */
  sourceNoteId: text("source_note_id"),
  /** Exact creator-approved wording accepted from Signal Notes.
   *
   * This is deliberately separate from `title`: Tasks may parse dates and
   * tags out of the approved wording, while retries still need to prove they
   * refer to the byte-for-byte same approval. Null marks legacy rows that
   * predate exact replay verification and must never be guessed compatible. */
  sourceNoteExtractBody: text("source_note_extract_body"),
  /** Lowercase SHA-256 of the UTF-8 bytes in sourceNoteExtractBody.
   * Stored alongside the exact value so the cross-product response can bind
   * its receipt without returning the approved wording again. */
  sourceNoteExtractSha256: text("source_note_extract_sha256"),
  /** T·69 step 5, custom board column key. NULL = "use `lane` as the
   *  canonical board column." Non-null = task belongs to a custom column
   *  whose key is stored in meta `board:{wsId}:columns`. Effective board
   *  column = COALESCE(boardColumnKey, lane).
   *
   *  MIGRATION REQUIRED before this column is readable from prod:
   *  see drizzle/0007_add_board_column_key.sql. The runtime code in
   *  board-app.tsx + moveTaskAction is written to handle the column
   *  being absent (libSQL returns null for unknown columns in
   *  SELECT *; the row-mapper ignores undefined fields gracefully).
   *
   *  Steps 1-4 of T·69 are independently shippable without this column. */
  boardColumnKey: text("board_column_key"),
  /** T·122: when the task last became done (any config done column), in
   *  epoch seconds like every timestamp here. NULL means not done, or
   *  done before this column existed and not reconstructable from the
   *  activity log (migration 0025 backfills what the log can prove).
   *  Maintained by every done-transition write path; Signal reads this
   *  before falling back to activity-log reconstruction. */
  completedAt: integer("completed_at", { mode: "timestamp" }),
  /** RW-3b: milestone promotion flag. True when the owner explicitly
   *  "promotes to milestone" in the task panel. The flag is additive
   *  and reversible, a milestone is still a normal board task; the
   *  column is the strategy gate that drives the Roadmap sync
   *  (ARCH_SPEC §1.1). NOT NULL DEFAULT 0 keeps legacy rows clean.
   *  Index-friendly: Roadmap queries `WHERE is_milestone=1`. */
  isMilestone: integer("is_milestone", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Archive timestamp. Non-null hides the task from every active view
   *  (getTasks filters `archived_at IS NULL`) without deleting it; restore
   *  clears it back to null. Nullable, absent on legacy rows.
   *
   *  MIGRATION REQUIRED before this column is readable from prod:
   *  see drizzle/0016_tasks_archived_at.sql. */
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  // These mirror drizzle/0003_hot_indexes.sql exactly (same names +
  // columns) so `drizzle-kit push` treats them as already-present and
  // never drops the prod indexes as schema↔DB drift. Tenant boundary:
  // every read filters by workspace_id.
  index("idx_tasks_workspace_id").on(t.workspaceId),
  index("idx_tasks_parent_task_id").on(t.parentTaskId),
  index("idx_tasks_ws_lane").on(t.workspaceId, t.lane),
  index("idx_tasks_due_at").on(t.dueAt),
  // NEW (0009): roadmap sync reads WHERE is_milestone=1 per workspace.
  // The only hot path 0003 missed.
  index("idx_tasks_ws_milestone").on(t.workspaceId, t.isMilestone),
  uniqueIndex("idx_tasks_source_note_id")
    .on(t.sourceNoteId)
    .where(sql`${t.sourceNoteId} IS NOT NULL`),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Clerk user id (`user_2abc…`). Null for legacy seeded users until
   *  they're claimed via webhook. UNIQUE so a Clerk re-signup with the
   *  same external id is idempotent. */
  clerkId: text("clerk_id").unique(),
  /** Login email, hydrated by the Clerk `user.created` webhook. */
  email: text("email"),
  /** Mention slug, what `@<handle>` matches in the comment composer.
   *  Derived from email-local-part on signup; user-editable later. */
  handle: text("handle").unique(),
  /** Display name. Nullable until first webhook sync; legacy seeds
   *  populate it directly. */
  name: text("name"),
  color: text("color").notNull(),
  initials: text("initials").notNull(),
});

/** Durable cross-product propagation queue. Tasks owns execution events; the
 * scheduled worker delivers them idempotently to Timeline/Signal consumers. */
export const suiteOutbox = sqliteTable("suite_outbox", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  version: integer("version").notNull().default(1),
  type: text("type").notNull(),
  actorUserId: text("actor_user_id"),
  workspaceId: text("workspace_id"),
  objectRef: text("object_ref"),
  payload: text("payload").notNull(),
  traceId: text("trace_id").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  deliveredAt: integer("delivered_at"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
}, (t) => [
  index("idx_suite_outbox_pending").on(t.deliveredAt, t.occurredAt),
  index("idx_suite_outbox_workspace").on(t.workspaceId, t.occurredAt),
]);

/**
 * Tasks is the suite's runtime authority for finite operating horizons.
 * Calendar dates remain YYYY-MM-DD strings; timezone gives those dates their
 * user meaning without coercing them through a UTC timestamp.
 */
export const planningPeriods = sqliteTable("planning_periods", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contextType: text("context_type")
    .$type<PlanningPeriodContext>()
    .notNull()
    .default("general"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  timezone: text("timezone").notNull().default("UTC"),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  position: real("position").notNull().default(1000),
  revision: integer("revision").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("idx_planning_periods_owner_position").on(
    t.ownerUserId,
    t.archivedAt,
    t.position,
  ),
  check(
    "planning_periods_context_type_check",
    sql`${t.contextType} IN ('school_year', 'semester', 'wedding_season', 'general')`,
  ),
  check(
    "planning_periods_start_date_check",
    sql`${t.startDate} IS NULL OR ${t.startDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
  ),
  check(
    "planning_periods_end_date_check",
    sql`${t.endDate} IS NULL OR ${t.endDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
  ),
  check(
    "planning_periods_date_order_check",
    sql`${t.startDate} IS NULL OR ${t.endDate} IS NULL OR ${t.startDate} <= ${t.endDate}`,
  ),
]);

/**
 * Workspaces are the per-tenant boundary. Pricing, members, and
 * domain-flavored chrome all key off this. One user → many workspaces;
 * each workspace has exactly one owner and many members via
 * `workspace_members`.
 *
 * `activeDomain` was previously a `meta` key/value row, now lives
 * here so it's naturally per-workspace.
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  /** URL-safe slug. UNIQUE. Used both as the workspace-switcher
   *  identifier and as the public `/p/{slug}` URL when published. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** The project's supporting line, shown under the title in the brief
   *  (T·114). Nullable: null renders the brief's placeholder rather than
   *  a sentence nobody wrote. Before 0022 this text lived in localStorage
   *  keyed by *display name*, so two projects sharing a display name
   *  shared one description and a rename orphaned it — the value was
   *  invisible to every collaborator and to share, print and embed.
   *
   *  MIGRATION REQUIRED before this column is readable from prod:
   *  see drizzle/0022_workspaces_description.sql. */
  description: text("description"),
  /** Nullable so the schema push doesn't fail on the legacy backfill;
   *  tightened to NOT NULL after the user webhook lands real owners. */
  ownerUserId: text("owner_user_id").references(() => users.id),
  /** Nullable during the reversible legacy grouping migration. */
  planningPeriodId: text("planning_period_id").references(
    () => planningPeriods.id,
    { onDelete: "set null" },
  ),
  contextType: text("context_type")
    .$type<WorkspaceContext>()
    .notNull()
    .default("project"),
  /** Calendar date, never an instant. */
  primaryDate: text("primary_date"),
  primaryDateLabel: text("primary_date_label"),
  position: real("position").notNull().default(1000),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  revision: integer("revision").notNull().default(1),
  /** Replaces meta.activeDomain. Marketing / Student / Freelance / Wedding. */
  activeDomain: text("active_domain"),
  /** Segmented onboarding, primary coordination use case
   *  (venue | wedding | student | small-business | …). */
  primaryUseCase: text("primary_use_case"),
  /** Optional second-step context (e.g. wedding-venue, society). */
  secondaryContext: text("secondary_context"),
  /** Unix timestamp when onboarding flow completed. */
  onboardingCompletedAt: integer("onboarding_completed_at", {
    mode: "timestamp",
  }),
  /** Canonical workspace template id this workspace was remixed from
   *  (e.g. "wedding-planning-workspace"). Null = workspace was created
   *  blank or before T-1. Notes/Roadmap/Analytics use this to lazily
   *  seed their per-layer slices on first visit. Strategy:
   *  studio/docs/TEMPLATES_STRATEGY.md. */
  templateId: text("template_id"),
  /** Phase 3 publishable workspaces. Null = private. Non-null = public
   *  read-only render available at `/p/{slug}` since the timestamp.
   *  The owner toggles via `publishWorkspaceAction`. */
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Nullable in the physical legacy table until the additive backfill runs. */
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
}, (t) => [
  index("idx_workspaces_period_position").on(
    t.planningPeriodId,
    t.archivedAt,
    t.position,
  ),
]);

export type ConsentedActivationMetadata = Readonly<{
  activationLabel?: string;
  primaryDate?: string;
}>;

/**
 * Commercial sponsorship is deliberately orthogonal to content access.
 * Nothing in this row grants membership, and private content must never be
 * copied into `consentedMetadata`.
 */
export const workspaceSponsorships = sqliteTable("workspace_sponsorships", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sponsorId: text("sponsor_id").notNull(),
  sponsorRef: text("sponsor_ref"),
  entitlementRef: text("entitlement_ref"),
  status: text("status")
    .$type<"active" | "revoked" | "expired">()
    .notNull()
    .default("active"),
  consentedMetadata: text("consented_metadata", { mode: "json" })
    .$type<ConsentedActivationMetadata>()
    .notNull()
    .default(sql`'{}'`),
  metadataVersion: integer("metadata_version").notNull().default(1),
  consentReceiptId: text("consent_receipt_id").notNull(),
  consentedAt: integer("consented_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("idx_workspace_sponsorships_workspace").on(t.workspaceId, t.status),
  index("idx_workspace_sponsorships_sponsor").on(t.sponsorId, t.status),
  check(
    "workspace_sponsorships_status_check",
    sql`${t.status} IN ('active', 'revoked', 'expired')`,
  ),
  check(
    "workspace_sponsorships_metadata_json_check",
    sql`json_valid(${t.consentedMetadata})`,
  ),
]);

export type PlanningOnboardingState = Readonly<{
  step: "context" | "period" | "workspaces" | "review";
  periodName?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  workspaceNames?: readonly string[];
  primaryDate?: string;
  primaryDateLabel?: string;
}>;

/** Resumable drafts are private to their creator and expire naturally. */
export const planningOnboardingSessions = sqliteTable(
  "planning_onboarding_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contextType: text("context_type")
      .$type<PlanningPeriodContext>()
      .notNull(),
    state: text("state", { mode: "json" })
      .$type<PlanningOnboardingState>()
      .notNull(),
    status: text("status")
      .$type<"in_progress" | "completed" | "abandoned">()
      .notNull()
      .default("in_progress"),
    revision: integer("revision").notNull().default(1),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_planning_onboarding_user_status").on(t.userId, t.status),
    check(
      "planning_onboarding_context_type_check",
      sql`${t.contextType} IN ('school_year', 'semester', 'wedding_season', 'general')`,
    ),
    check(
      "planning_onboarding_state_json_check",
      sql`json_valid(${t.state})`,
    ),
    check(
      "planning_onboarding_status_check",
      sql`${t.status} IN ('in_progress', 'completed', 'abandoned')`,
    ),
  ],
);

/**
 * Workspace membership join table. Composite PK so a user can't be
 * added twice to the same workspace. Cascade on workspace OR user
 * delete keeps the join table tidy.
 */
export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    // Mirror drizzle/0003_hot_indexes.sql, "my workspaces" lookups by user.
    index("idx_workspace_members_user_id").on(t.userId),
  ],
);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql.
  index("idx_comments_task_id").on(t.taskId),
  index("idx_comments_user_id").on(t.userId),
]);

// Compile-time contract, flags drift between schema and the
// hand-written client `Task` type in src/lib/data.ts. `comments`,
// `subtaskCount`, and `subtaskDone` are excluded because they are derived
// counts populated by the query layer, not persisted columns.
type _SchemaCoversTask = keyof Omit<
  Task,
  "comments" | "subtaskCount" | "subtaskDone"
> extends keyof typeof tasks.$inferSelect
  ? true
  : never;
const _checkTask: _SchemaCoversTask = true;
void _checkTask;

// authorName is resolved via LEFT JOIN users at query time, not a column.
type _SchemaCoversComment = keyof Omit<Comment, "authorName"> extends keyof typeof comments.$inferSelect
  ? true
  : never;
const _checkComment: _SchemaCoversComment = true;
void _checkComment;

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").$type<ActivityKind>().notNull(),
  payload: text("payload", { mode: "json" })
    .$type<ActivityPayload>()
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql. 0003 wrote created_at DESC;
  // drizzle 0.45 can't express index-column direction, so these are
  // plain, SQLite reverse-scans an ASC index for ORDER BY ... DESC
  // just as cheaply. push recreates the prod index without the DESC
  // qualifier once (harmless; see 0009 note).
  index("idx_activities_task_created").on(t.taskId, t.createdAt),
  index("idx_activities_ws_created").on(t.workspaceId, t.createdAt),
]);

// authorName is resolved via LEFT JOIN users at query time, not a column.
type _SchemaCoversActivity =
  keyof Omit<Activity, "authorName"> extends keyof typeof activities.$inferSelect ? true : never;
const _checkActivity: _SchemaCoversActivity = true;
void _checkActivity;

/**
 * Tiny key/value workspace metadata. Currently stores `activeDomain`
 * (set by `seedDomainAction`) so the app header can render the
 * domain-flavored workspace title alongside the seeded tasks.
 */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Anti-notification: only @mentions and direct blocks land here as
 * INSTANT items (rendered in the Inbox). Everything else (creates,
 * lane moves, simple updates) is intentionally NOT inserted, the
 * daily digest is the only "broadcast" channel for that activity.
 */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  userId: text("user_id").notNull(),
  kind: text("kind").$type<NotificationKind>().notNull(),
  /** Optional FK to the originating task. Cascades when the task is
   *  deleted so we don't leak orphan notifications. */
  taskId: text("task_id").references(() => tasks.id, {
    onDelete: "cascade",
  }),
  payload: text("payload", { mode: "json" })
    .$type<NotificationPayload>()
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Null = unread. */
  readAt: integer("read_at", { mode: "timestamp" }),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql. Inbox loads a user's
  // notifications newest-first; task delete cascades by task_id.
  index("idx_notifications_user_created").on(t.userId, t.createdAt),
  index("idx_notifications_task_id").on(t.taskId),
]);

type _SchemaCoversNotification =
  keyof Notification extends keyof typeof notifications.$inferSelect
    ? true
    : never;
const _checkNotification: _SchemaCoversNotification = true;
void _checkNotification;

/**
 * Bulk comp codes, one row per minted gift. Admin mints; users
 * redeem via /redeem/[code]. Each redemption decrements `quantity`
 * and inserts an `entitlements` row for the redeeming user.
 */
export const compCodes = sqliteTable("comp_codes", {
  code: text("code").primaryKey(),
  tier: text("tier").$type<EntitlementTier>().notNull(),
  durationDays: integer("duration_days").notNull(),
  quantity: integer("quantity").notNull(),
  redeemed: integer("redeemed").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

type _SchemaCoversCompCode =
  keyof CompCode extends keyof typeof compCodes.$inferSelect ? true : never;
const _checkCompCode: _SchemaCoversCompCode = true;
void _checkCompCode;

/**
 * Per-user entitlements log. One user can have multiple rows over
 * time (free baseline, then a Pro purchase, then an .edu re-up).
 * Resolution = pick the highest-tier non-expired row.
 */
export const entitlements = sqliteTable("entitlements", {
  id: text("id").primaryKey(),
  /** Workspace-scoped entitlement. Pricing is per-workspace, so the
   *  same Clerk user can hold a Pro entitlement on workspace A and
   *  free baseline on workspace B. Nullable during cutover. */
  workspaceId: text("workspace_id"),
  userId: text("user_id").notNull(),
  tier: text("tier").$type<EntitlementTier>().notNull(),
  source: text("source").$type<EntitlementSource>().notNull(),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  notes: text("notes"),
  reachedBoardAt: integer("reached_board_at", { mode: "timestamp" }),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql. Entitlement resolution +
  // Analytics cross-repo read key off (user_id, workspace_id).
  // NB: 0003 also created idx_entitlements_notes on the free-text
  // `notes` column, deliberately NOT mirrored; it's never queried, so
  // letting push drop it is a cleanup (recorded in 0009).
  index("idx_entitlements_user_workspace").on(t.userId, t.workspaceId),
]);

type _SchemaCoversEntitlement =
  keyof Entitlement extends keyof typeof entitlements.$inferSelect
    ? true
    : never;
const _checkEntitlement: _SchemaCoversEntitlement = true;
void _checkEntitlement;

/**
 * Per-user notification preferences. One row per user; settings page
 * upserts. Stored as discrete columns rather than a JSON blob so the
 * digest cron can filter on `dailyDigest` directly without parsing.
 *
 * Defaults match the user-facing copy in the settings UI:
 *   - daily digest at 9am: ON
 *   - mention pings:        ON
 *   - non-mention comments: OFF (the anti-spam stance)
 */
export const notificationPrefs = sqliteTable("notification_prefs", {
  userId: text("user_id").primaryKey(),
  /** "Daily digest at 9am" toggle. */
  dailyDigest: integer("daily_digest", { mode: "boolean" })
    .notNull()
    .default(true),
  /** "Mention notifications" toggle, direct @-mentions and blocks. */
  mentions: integer("mentions", { mode: "boolean" }).notNull().default(true),
  /** "Comment notifications without @-mention", off by default; opt-in
   *  noise if the user is the kind who wants every reply. */
  commentReplies: integer("comment_replies", { mode: "boolean" })
    .notNull()
    .default(false),
  /** "Human nudge notifications" — allow in-app + email nudges from
   *  teammates. On by default. When 0, the sender's nudge action still
   *  records the activity row (audit trail) but skips writing a
   *  notifications row and skips the email.
   *
   *  MIGRATION REQUIRED: drizzle/0018_notification_prefs_nudges.sql */
  nudges: integer("nudges", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * User-level preferences for cross-product email cadence. Owned by
 * the new /settings/notifications surface, separate from
 * `notification_prefs` (which is in-app workspace-internal noise
 * policy). One row per user; settings page upserts. Plan-change /
 * expiry notices are always-on and not stored here.
 */
export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  /** Signal daily briefing email cadence. */
  dailySignalCadence: text("daily_signal_cadence")
    .$type<"off" | "weekdays" | "daily">()
    .notNull()
    .default("off"),
  /** Weekly summary email. */
  weeklySummary: text("weekly_summary")
    .$type<"off" | "mondays">()
    .notNull()
    .default("off"),
  /** IANA tz string. Optional, falls back to UTC when null. */
  timeZone: text("time_zone"),
  /** UI colour-scheme preference. Null resolves to "system".
   *  D-013: only "system" and "light" are selectable; "dark" is
   *  designed-not-shipped (operator gate). The server action enforces
   *  this allow-list so a crafted payload cannot enable dark mode. */
  themeMode: text("theme_mode"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Read-only "magic link" share tokens. A guest with the URL
 * `/share/<token>` can view the workspace at the chosen view
 * (board/list/timeline/calendar) without signing in. Any edit or
 * comment attempt raises the progressive auth modal.
 *
 * Now extended with: time-limited expiry, mode (what guests can do),
 * a friendly label for the manage-links UI, and a redemption counter.
 */
export const shareLinks = sqliteTable("share_links", {
  /** URL-safe random token, also the primary key. */
  token: text("token").primaryKey(),
  /** Per-tenant boundary. Resolves which workspace the guest sees. */
  workspaceId: text("workspace_id"),
  /** Default view shown when the guest opens the link. */
  view: text("view").$type<"board" | "list" | "timeline" | "calendar">().notNull(),
  /** What guests can do at the link. `view` shows tasks; `comment`
   *  lets guests post comments; `edit` lets them mutate fields too.
   *
   *  D-020: 'comment' and 'edit' have no enforced write path — the share
   *  surface is always read-only regardless of this value. createShareLinkAction
   *  clamps new links to 'view' until a dedicated write-capability guard exists.
   *  The column is preserved so the type contract survives future implementation. */
  mode: text("mode")
    .$type<"view" | "comment" | "edit">()
    .notNull()
    .default("view"),
  /** Optional human label for the manage-links UI ("Mom's preview",
   *  "Wedding photographer"). */
  label: text("label"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Optional revocation timestamp. Null = active. */
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  /** Optional time-based expiry. Null = no expiry. */
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  /** Counter incremented each time the link is opened. */
  visits: integer("visits").notNull().default(0),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql, manage-links UI lists a
  // workspace's share links.
  index("idx_share_links_workspace_id").on(t.workspaceId),
]);

/**
 * Per-visit log for share links. The fast `share_links.visits`
 * counter answers "how many?"; this table answers "when?", feeds
 * the 7-day sparkline and "last visited" timestamp in the manage
 * popover. Cascades on link delete so we don't keep orphan visits.
 *
 * `userAgentHint` stores only the first 60 chars of the UA, enough
 * to coarsely tell phone-vs-desktop later without holding a full
 * fingerprint.
 */
export const shareLinkVisits = sqliteTable("share_link_visits", {
  id: text("id").primaryKey(),
  token: text("token")
    .notNull()
    .references(() => shareLinks.token, { onDelete: "cascade" }),
  visitedAt: integer("visited_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  userAgentHint: text("user_agent_hint"),
}, (t) => [
  // Mirror drizzle/0003_hot_indexes.sql, 7-day sparkline scans a
  // token's visits newest-first.
  index("idx_share_link_visits_token_at").on(t.token, t.visitedAt),
]);

/**
 * Stripe webhook idempotency. Stripe re-delivers events on transient
 * failures (every 30s for up to 3 days), and our handler is non-
 * idempotent, a re-delivered `checkout.session.completed` would
 * grant a second entitlement row. Before doing any work, the route
 * INSERTs the event id here; if the id already exists, the route
 * bails as a no-op and returns 200 (Stripe stops retrying on 200).
 *
 * The `event_id` is Stripe's stable id; the table doubles as an
 * audit log of what we've seen.
 */
export const processedWebhooks = sqliteTable("processed_webhooks", {
  /** Stripe's `evt_…` id. Primary key by stable identifier. */
  eventId: text("event_id").primaryKey(),
  /** Stripe event type for the audit log (e.g. "checkout.session.completed"). */
  eventType: text("event_type").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Pending workspace invites. The cycle 17 stub `inviteMemberByEmailAction`
 * enforced the member cap but didn't actually mint tokens or send
 * email; this table closes that loop. Cycle 25 wires the real flow:
 * mint a token → INSERT a row → send via Resend → user clicks
 * `/invite/{token}` → action accepts the invite, creates a
 * `workspace_members` row, deletes the pending row.
 *
 * Tokens are URL-safe random strings; expiry is 7 days from mint.
 */
/**
 * File attachments, one row per uploaded file bound to a task. The
 * actual bytes live on disk under `<repo>/.data/uploads/...` (outside
 * `public/` so the Next static handler never streams them); this row
 * stores the metadata needed to re-locate, authorize, and render the
 * file in the detail panel. Cascade on task delete drops the row;
 * the disk file is unlinked best-effort by the delete action and on
 * a periodic sweep TODO. Workspace id is denormalized for the same
 * reasons it is on `comments` / `activities`: it lets the auth check
 * in the download route filter without joining tasks.
 */
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  /** Per-tenant boundary. Nullable during the cutover for parity with
   *  other tables that haven't been backfilled yet. */
  workspaceId: text("workspace_id"),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  uploaderUserId: text("uploader_user_id")
    .notNull()
    .references(() => users.id),
  /** User-visible filename. Sanitized on upload but preserved for
   *  display + Content-Disposition on download. */
  filename: text("filename").notNull(),
  /** Server-relative path under `<repo>/.data/uploads/...`. Never
   *  exposed to the client, the download route streams the bytes
   *  through `/api/attachments/[id]` after re-checking auth. */
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  /** Hard-cap 25 MB enforced server-side in the upload action. */
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

type _SchemaCoversAttachment =
  keyof Attachment extends keyof typeof attachments.$inferSelect ? true : never;
const _checkAttachment: _SchemaCoversAttachment = true;
void _checkAttachment;

/**
 * Unified resource model. Absorbs file attachments (kind='upload') and
 * external links (kind='link') into one read layer.
 *
 * Uploads keep writing `attachments` (unchanged upload path); this table
 * is backfilled from attachments at migration time and unified at the
 * read layer until Phase 9 retires attachments. New external links write
 * only here.
 *
 * No runtime FK cascade — libSQL over Turso stateless HTTP does not fire
 * them reliably. Cascade deletes are hand-wired in removeTaskAction,
 * account-erasure.ts, and removeResourceAction.
 */
export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskId: text("task_id").notNull(),
  /** 'upload' = file attachment; 'link' = external URL. */
  kind: text("kind").$type<"upload" | "link">().notNull(),
  /** Provider slug: 'file' | 'google_doc' | 'google_sheet' | 'google_slides'
   *  | 'drive' | 'figma' | 'github' | 'url'. */
  provider: text("provider").notNull(),
  /** Optional provider-native identifier (e.g. Figma file key). */
  externalId: text("external_id"),
  title: text("title").notNull(),
  url: text("url"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  thumbnail: text("thumbnail"),
  addedByUserId: text("added_by_user_id"),
  /** Unix epoch seconds. Stored as integer to match the attachments
   *  created_at column type exactly (avoids mode mismatch in the union). */
  addedAt: integer("added_at").notNull(),
  refreshedAt: integer("refreshed_at"),
  /** 'ok' | 'legacy' | 'pending' | 'unavailable'. 'legacy' = backfilled
   *  upload whose cloud URL is not yet known; bytes may still exist on
   *  local disk. */
  accessState: text("access_state").notNull().default("ok"),
  /** 1 when the resource bytes count against the workspace storage quota. */
  countsAgainstStorage: integer("counts_against_storage").notNull().default(0),
}, (t) => [
  index("idx_resources_task_id").on(t.taskId),
  index("idx_resources_workspace_id").on(t.workspaceId),
  check(
    "resources_kind_check",
    sql`${t.kind} IN ('upload','link')`,
  ),
]);

export const pendingInvites = sqliteTable("pending_invites", {
  /** URL-safe random token, also the primary key. */
  token: text("token").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  /** Email the invite was sent to (lowercased). Used to validate
   *  the accepter's email matches at /invite/[token] redemption. */
  email: text("email").notNull(),
  /** User who minted the invite. */
  invitedByUserId: text("invited_by_user_id").notNull(),
  /** Role to grant the invitee on accept. Validated server-side and
   *  clamped to 'member' | 'owner'. Added in migration 0019 (D-018). */
  role: text("role").$type<"member" | "owner">().notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** 7 days from createdAt. */
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  /** Unix epoch seconds of the last invite email send. Used to enforce
   *  the 1-per-hour resend cooldown. Added in migration 0019 (D-019). */
  lastSentAt: integer("last_sent_at"),
  /** Set when redeemed, keeps the row as an audit trail rather than
   *  deleting. Null = pending. */
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  acceptedByUserId: text("accepted_by_user_id"),
});

/**
 * Workspace-scoped audit event log. Stores invite sent/accepted events and
 * future workspace-level actions. Added in migration 0019 (D-019).
 *
 * Rationale: activities.taskId is NOT NULL (a hot-path table invariant); it
 * cannot hold workspace-scoped events without a schema change that would
 * require a full table rebuild on the production hot path. This additive table
 * avoids that. See agent report phase2-opus-invite-security-review.md.
 */
export const workspaceEvents = sqliteTable("workspace_events", {
  /** CSPRNG UUID or nanoid, generated by the writer. */
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  /** Optional: the user who triggered the event. */
  userId: text("user_id"),
  /** Event type: 'inviteSent' | 'inviteAccepted' | future kinds. */
  kind: text("kind").notNull(),
  /** JSON payload. No PII in the payload (email addresses excluded).
   *  Payload shape per kind: inviteSent = {role}, inviteAccepted = {userId, role}. */
  payload: text("payload").notNull().default("{}"),
  /** Unix epoch seconds. Integer to stay consistent with the schema
   *  convention for audit timestamps on this database. */
  createdAt: integer("created_at").notNull(),
}, (t) => [
  index("idx_workspace_events_workspace_created").on(t.workspaceId, t.createdAt),
]);

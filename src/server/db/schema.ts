import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
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

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  /** Per-tenant boundary. Nullable during the cutover; tightened to
   *  NOT NULL after the legacy backfill lands. Cascade on workspace
   *  delete kills the workspace's whole task tree. */
  workspaceId: text("workspace_id"),
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
  // subquery on the comments table) — never persisted on tasks.
  idleDays: integer("idle_days"),
  blockedBy: text("blocked_by", { mode: "json" }).$type<string[]>(),
  recurrence: text("recurrence", { mode: "json" }).$type<Recurrence>(),
  startDay: integer("start_day"),
  durationDays: integer("duration_days"),
  /** Float gap-numbering for stable in-lane ordering. NULL means
   *  "fall back to creation order" — `getTasks` COALESCEs accordingly.
   *  Drops between two siblings compute (prev + next) / 2 so neighbors
   *  never need renumbering. */
  position: real("position"),
  /** Optional parent task. NULL on every top-level task; non-null
   *  rows are subtasks (one level of nesting in v1 — subtasks don't
   *  themselves nest further). The detail panel loads children via
   *  `getSubtasks(parentId)`; `getTasks` filters to `parent_task_id
   *  IS NULL` so subtasks stay out of board / list / timeline /
   *  calendar in this cycle and live exclusively under their parent. */
  parentTaskId: text("parent_task_id"),
  /** Optional outside person attached to the task — wedding planner's
   *  vendor, freelance client invoice contact, anyone the work
   *  involves who isn't a workspace member. Both fields nullable;
   *  the panel renders whichever are present. */
  externalContactName: text("external_contact_name"),
  externalContactEmail: text("external_contact_email"),
  /** Optional dollar amount attached to the task — wedding planner's
   *  vendor invoice ($1,200 deposit), freelancer's billable rate,
   *  anywhere a number would otherwise leak into a separate Notion
   *  or Sheet. Stored as integer cents to dodge float drift. Nullable
   *  when no amount is set. Server clamps to [0, 99_999_999]. */
  cents: integer("cents"),
  /** Optional pointer back to the Signal Notes note that spawned this
   *  task via the cross-repo extract write (Cycle 9.4b second half,
   *  2026-05-12). Format: `{ownerUserId}:{noteId}` — keeps the
   *  idempotency check user-scoped without needing a separate join.
   *  Null on every task created in Tasks directly. The Notes raw body
   *  never lands here — only the creator-authored extract_body becomes
   *  the task title. */
  sourceNoteId: text("source_note_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Clerk user id (`user_2abc…`). Null for legacy seeded users until
   *  they're claimed via webhook. UNIQUE so a Clerk re-signup with the
   *  same external id is idempotent. */
  clerkId: text("clerk_id").unique(),
  /** Login email, hydrated by the Clerk `user.created` webhook. */
  email: text("email"),
  /** Mention slug — what `@<handle>` matches in the comment composer.
   *  Derived from email-local-part on signup; user-editable later. */
  handle: text("handle").unique(),
  /** Display name. Nullable until first webhook sync; legacy seeds
   *  populate it directly. */
  name: text("name"),
  color: text("color").notNull(),
  initials: text("initials").notNull(),
});

/**
 * Workspaces are the per-tenant boundary. Pricing, members, and
 * domain-flavored chrome all key off this. One user → many workspaces;
 * each workspace has exactly one owner and many members via
 * `workspace_members`.
 *
 * `activeDomain` was previously a `meta` key/value row — now lives
 * here so it's naturally per-workspace.
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  /** URL-safe slug. UNIQUE. Used both as the workspace-switcher
   *  identifier and as the public `/p/{slug}` URL when published. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Nullable so the schema push doesn't fail on the legacy backfill;
   *  tightened to NOT NULL after the user webhook lands real owners. */
  ownerUserId: text("owner_user_id").references(() => users.id),
  /** Replaces meta.activeDomain. Marketing / Student / Freelance / Wedding. */
  activeDomain: text("active_domain"),
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
});

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
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
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
});

// Compile-time contract — flags drift between schema and the
// hand-written client `Task` type in src/lib/data.ts. `comments`
// is excluded because it's a derived count populated by the query
// layer, not a persisted column.
type _SchemaCoversTask = keyof Omit<Task, "comments"> extends keyof typeof tasks.$inferSelect
  ? true
  : never;
const _checkTask: _SchemaCoversTask = true;
void _checkTask;

type _SchemaCoversComment = keyof Comment extends keyof typeof comments.$inferSelect
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
});

type _SchemaCoversActivity =
  keyof Activity extends keyof typeof activities.$inferSelect ? true : never;
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
 * lane moves, simple updates) is intentionally NOT inserted — the
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
});

type _SchemaCoversNotification =
  keyof Notification extends keyof typeof notifications.$inferSelect
    ? true
    : never;
const _checkNotification: _SchemaCoversNotification = true;
void _checkNotification;

/**
 * Bulk comp codes — one row per minted gift. Admin mints; users
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
});

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
  /** "Mention notifications" toggle — direct @-mentions and blocks. */
  mentions: integer("mentions", { mode: "boolean" }).notNull().default(true),
  /** "Comment notifications without @-mention" — off by default; opt-in
   *  noise if the user is the kind who wants every reply. */
  commentReplies: integer("comment_replies", { mode: "boolean" })
    .notNull()
    .default(false),
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
   *  lets guests post comments; `edit` lets them mutate fields too. */
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
});

/**
 * Per-visit log for share links. The fast `share_links.visits`
 * counter answers "how many?"; this table answers "when?" — feeds
 * the 7-day sparkline and "last visited" timestamp in the manage
 * popover. Cascades on link delete so we don't keep orphan visits.
 *
 * `userAgentHint` stores only the first 60 chars of the UA — enough
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
});

/**
 * Stripe webhook idempotency. Stripe re-delivers events on transient
 * failures (every 30s for up to 3 days), and our handler is non-
 * idempotent — a re-delivered `checkout.session.completed` would
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
 * Interactive GTM roadmap item — one row per actionable line in
 * `~/Projects/tasks/docs/gtm-plan.md`. The parser at
 * `src/server/roadmap/parser.ts` walks the §3 asset checklist, §7
 * 8-week content calendar, §9 14-day press Gantt, plus the launch
 * milestones, and synthesizes deterministic IDs of the shape
 * `${kind}-w${week}-${date}-${slug}` so re-parsing is idempotent and
 * status survives across re-syncs. The UI at `/roadmap` toggles
 * `status` per row; new items in the markdown auto-appear on next
 * load.
 */
export const roadmapItems = sqliteTable("roadmap_items", {
  /** Deterministic key — see parser. */
  id: text("id").primaryKey(),
  /** 1..8 for content-calendar weeks; 0 for press/asset/milestone rows
   *  that don't have a week column. */
  week: integer("week").notNull(),
  weekTheme: text("week_theme"),
  weekRange: text("week_range"),
  /** ISO date 2026-MM-DD. Null for asset checklist rows that key off
   *  a target date but live outside the weekly cadence. */
  date: text("date"),
  day: text("day"),
  /** post · asset · press · paid · launch · kpi · milestone */
  kind: text("kind").notNull(),
  channel: text("channel"),
  format: text("format"),
  source: text("source"),
  cta: text("cta"),
  postingTime: text("posting_time"),
  /** Free-text body — for asset rows it's the asset name; for press
   *  rows it's the action verb; for posts it's the format text. */
  body: text("body"),
  status: text("status")
    .$type<"pending" | "in_progress" | "completed">()
    .notNull()
    .default("pending"),
  /** True when the markdown surrounded the row in **bold** — flags
   *  Show HN, PH, IH launch beats and the paid-ad rows. */
  isLaunch: integer("is_launch", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Free-form note the user can attach via the UI ("got 47 likes",
   *  "slipped to Wednesday"). UI clamps to 140 chars. */
  note: text("note"),
  /** Optional FK to `blockers.id` — the user-action that has to land
   *  before this item can move. NULL = independent / scheduled-only. */
  blockerId: text("blocker_id"),
  /** Position within its week+date for stable rendering. */
  ord: integer("ord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

/**
 * File attachments — one row per uploaded file bound to a task. The
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
   *  exposed to the client — the download route streams the bytes
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
 * GTM blockers — the small set of user-only actions that gate large
 * groups of roadmap items. Domain purchase, ElevenLabs subscription,
 * X/Bluesky/PH handle claims, ScreenStudio recording session, Sentry
 * alert config, paid spend authorization, the live launch beats. Each
 * `roadmap_items.blocker_id` points here; `/roadmap` filters by
 * blocker so the user can see "everything domain unblocks" in one
 * pass. Resolved blockers stay in the table with `resolved_at` set so
 * the audit trail survives.
 */
export const blockers = sqliteTable("blockers", {
  /** Stable string id like `B-domain`, `B-elevenlabs`, `B-handles-x`. */
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  /** purchase · account · recording · auth · ad-spend · launch-beat · kpi · config */
  kind: text("kind").notNull(),
  /** ISO target date (YYYY-MM-DD). */
  targetDate: text("target_date"),
  /** ≤180 char one-liner about what this blocker unblocks. */
  description: text("description").notNull(),
  /** Free-form note the user can attach via the UI. UI clamps to 140 chars. */
  note: text("note"),
  /** Null = unresolved. Non-null = the user marked it done. */
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  ord: integer("ord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Action items — the launch-readiness QA checklist. Independent of
 * `gtm-plan.md` and the marketing roadmap; this is the *engineering*
 * and *product* checklist (test SSO with a friend, mobile overlap
 * audit, security headers, BigQuery decision, etc.). Seeded once via
 * `seedActionItemsIfEmpty()`; new items can be added directly from
 * the seed file (re-running picks up adds without losing user state
 * because the deterministic id keys the upsert).
 */
export const actionItems = sqliteTable("action_items", {
  /** Stable id like `AI-domain-purchase`, `AI-test-sso-google`. */
  id: text("id").primaryKey(),
  /** Display category — see seed for the canonical set. */
  category: text("category").notNull(),
  title: text("title").notNull(),
  /** ≤200 char description shown in the row's expanded subline. */
  description: text("description"),
  status: text("status")
    .$type<"pending" | "in_progress" | "completed">()
    .notNull()
    .default("pending"),
  /** Optional FK to `blockers.id` — links a test/QA item to whatever
   *  user-action has to land before the test can run (e.g. "test SSO
   *  with a friend" depends on `B-domain` so deliverability works). */
  blockerId: text("blocker_id"),
  /** Free-form note. UI clamps to 140 chars. */
  note: text("note"),
  /** "P0" / "P1" / "P2" — P0 must close before launch (06-16). */
  priority: text("priority").$type<"P0" | "P1" | "P2">().notNull().default("P1"),
  ord: integer("ord").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** 7 days from createdAt. */
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  /** Set when redeemed — keeps the row as an audit trail rather than
   *  deleting. Null = pending. */
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  acceptedByUserId: text("accepted_by_user_id"),
});

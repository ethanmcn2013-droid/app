import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Read-only mirror of the Signal Tasks Turso schema, only the
 * columns Analytics actually reads.
 *
 * IMPORTANT: this is a DERIVED mirror. Tasks owns the canonical
 * schema at ~/Projects/personal/tasks/src/server/db/schema.ts.
 * Analytics never writes to this DB (the Vercel env uses a
 * Turso token scoped read-only). If Tasks adds or renames
 * columns Analytics depends on, this mirror is what changes.
 */

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  title: text("title").notNull(),
  description: text("description"),
  /** Tasks's lane field, Analytics maps to Status. */
  lane: text("lane").notNull(),
  priority: text("priority").notNull(),
  /** JSON-encoded array of user ids. First entry treated as the
   *  primary assignee in Analytics's TaskRead. */
  assignees: text("assignees", { mode: "json" }).$type<string[]>(),
  /** JSON-encoded array of tag strings. Each unique tag becomes
   *  an Analytics "project" (PRODUCT.md §6 mapping note). */
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  /** Free-text due label ("Friday", "next week", etc). */
  due: text("due"),
  /** Structured timestamp parsed from `due`. Preferred for date math. */
  dueAt: integer("due_at", { mode: "timestamp" }),
  /** JSON-encoded array of task ids that block this one. */
  blockedBy: text("blocked_by", { mode: "json" }).$type<string[]>(),
  idleDays: integer("idle_days"),
  sourceNoteId: text("source_note_id"),
  isMilestone: integer("is_milestone", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id"),
  activeDomain: text("active_domain"),
  primaryUseCase: text("primary_use_case"),
  planningPeriodId: text("planning_period_id"),
  contextType: text("context_type"),
  primaryDate: text("primary_date"),
  primaryDateLabel: text("primary_date_label"),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
});

export const planningPeriods = sqliteTable("planning_periods", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  contextType: text("context_type").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  timezone: text("timezone").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Clerk user id (`user_2abc…`). Nullable for legacy seeds. */
  clerkId: text("clerk_id"),
  /** Login email, hydrated by the Clerk `user.created` webhook.
   *  This is the canonical identity key used by Analytics to locate
   *  a Tasks user when clerkId hasn't been written yet (webhook-race). */
  email: text("email"),
  name: text("name"),
  initials: text("initials").notNull(),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
});

/** Bounded event history used for deterministic completion and change metrics. */
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  taskId: text("task_id").notNull(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

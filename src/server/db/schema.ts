import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type {
  Activity,
  ActivityKind,
  ActivityPayload,
  Comment,
  LaneId,
  Priority,
  Task,
  UserId,
} from "@/lib/data";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  lane: text("lane").$type<LaneId>().notNull(),
  priority: text("priority").$type<Priority>().notNull(),
  assignees: text("assignees", { mode: "json" })
    .$type<UserId[]>()
    .notNull()
    .default(sql`'[]'`),
  due: text("due"),
  estimate: integer("estimate"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  comments: integer("comments"),
  idleDays: integer("idle_days"),
  blockedBy: text("blocked_by", { mode: "json" }).$type<string[]>(),
  startDay: integer("start_day"),
  durationDays: integer("duration_days"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const users = sqliteTable("users", {
  id: text("id").$type<UserId>().primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  initials: text("initials").notNull(),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
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
// hand-written client `Task` type in src/lib/data.ts.
type _SchemaCoversTask = keyof Task extends keyof typeof tasks.$inferSelect
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
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .$type<UserId>()
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

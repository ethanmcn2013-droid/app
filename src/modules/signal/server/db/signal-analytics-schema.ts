import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Signal analytics DB schema — ported from signal/src/server/db/schema.ts.
 *
 * S2 env rename: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN →
 * SIGNAL_ANALYTICS_DATABASE_URL / SIGNAL_ANALYTICS_AUTH_TOKEN.
 *
 * Tables managed by the signal.git migration stream (drizzle-signal/).
 * DO NOT run migrations against prod from this repo; tables already exist.
 * Use push preview only (Phase 8 runbook).
 */

export const analyticsUsers = sqliteTable("analytics_users", {
  clerkId: text("clerk_id").primaryKey(),
  linkedWorkspaceId: text("linked_workspace_id"),
  scopeKind: text("scope_kind").$type<"workspace" | "planningPeriod">(),
  planningPeriodId: text("planning_period_id"),
  timezone: text("timezone"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type AnalyticsUser = typeof analyticsUsers.$inferSelect;

export const planningEvents = sqliteTable("planning_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name")
    .$type<"signal_scope_changed" | "period_signal_viewed">()
    .notNull(),
  scopeKind: text("scope_kind")
    .$type<"workspace" | "planningPeriod">()
    .notNull(),
  workspaceCount: integer("workspace_count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const phrasingRotations = sqliteTable(
  "phrasing_rotations",
  {
    clerkId: text("clerk_id").notNull(),
    triggerId: text("trigger_id").notNull(),
    lastIndex: integer("last_index").notNull().default(0),
    lastFiredAt: integer("last_fired_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.clerkId, t.triggerId] })],
);

export type PhrasingRotation = typeof phrasingRotations.$inferSelect;

export const briefingFeedback = sqliteTable(
  "briefing_feedback",
  {
    clerkId: text("clerk_id").notNull(),
    itemKey: text("item_key").notNull(),
    verdict: text("verdict").notNull(),
    triggerId: text("trigger_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.clerkId, t.itemKey] })],
);

export type BriefingFeedback = typeof briefingFeedback.$inferSelect;

export const surfacedItems = sqliteTable(
  "surfaced_items",
  {
    clerkId: text("clerk_id").notNull(),
    itemKey: text("item_key").notNull(),
    triggerId: text("trigger_id").notNull(),
    firstDay: integer("first_day").notNull(),
    lastDay: integer("last_day").notNull(),
    runDays: integer("run_days").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.clerkId, t.itemKey, t.triggerId] })],
);

export type SurfacedItem = typeof surfacedItems.$inferSelect;

export const analyticsViewPreferences = sqliteTable(
  "analytics_view_preferences",
  {
    clerkId: text("clerk_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    hiddenCardIds: text("hidden_card_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    pinnedCardIds: text("pinned_card_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    cardOrder: text("card_order", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    primaryKey({ columns: [table.clerkId, table.workspaceId] }),
    index("analytics_view_preferences_workspace_idx").on(table.workspaceId),
  ],
);

export type AnalyticsViewPreference = typeof analyticsViewPreferences.$inferSelect;

export const analyticsMetricSnapshots = sqliteTable(
  "analytics_metric_snapshots",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    projectId: text("project_id"),
    metricKey: text("metric_key").notNull(),
    snapshotAt: integer("snapshot_at", { mode: "timestamp" }).notNull(),
    numericValue: real("numeric_value"),
    aggregateValue: text("aggregate_value", { mode: "json" })
      .$type<Record<string, number | null>>()
      .notNull()
      .default(sql`'{}'`),
    coverage: text("coverage", { mode: "json" })
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'`),
    metricVersion: text("metric_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("analytics_metric_snapshots_workspace_time_idx").on(
      table.workspaceId,
      table.snapshotAt,
    ),
    index("analytics_metric_snapshots_metric_time_idx").on(
      table.workspaceId,
      table.metricKey,
      table.snapshotAt,
    ),
    index("analytics_metric_snapshots_project_time_idx").on(
      table.workspaceId,
      table.projectId,
      table.snapshotAt,
    ),
  ],
);

export const analyticsSnapshotRuns = sqliteTable(
  "analytics_snapshot_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    sourceWatermark: text("source_watermark"),
    coverage: text("coverage", { mode: "json" })
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'`),
    schemaVersion: integer("schema_version").notNull().default(1),
    errorCode: text("error_code"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("analytics_snapshot_runs_workspace_started_idx").on(
      table.workspaceId,
      table.startedAt,
    ),
  ],
);

export const analyticsSchemaVersions = sqliteTable(
  "analytics_schema_versions",
  {
    stream: text("stream").primaryKey(),
    version: integer("version").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
);

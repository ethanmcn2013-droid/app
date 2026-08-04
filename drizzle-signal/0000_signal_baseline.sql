CREATE TABLE `analytics_metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`metric_key` text NOT NULL,
	`snapshot_at` integer NOT NULL,
	`numeric_value` real,
	`aggregate_value` text DEFAULT '{}' NOT NULL,
	`coverage` text DEFAULT '{}' NOT NULL,
	`metric_version` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_metric_snapshots_workspace_time_idx` ON `analytics_metric_snapshots` (`workspace_id`,`snapshot_at`);--> statement-breakpoint
CREATE INDEX `analytics_metric_snapshots_metric_time_idx` ON `analytics_metric_snapshots` (`workspace_id`,`metric_key`,`snapshot_at`);--> statement-breakpoint
CREATE INDEX `analytics_metric_snapshots_project_time_idx` ON `analytics_metric_snapshots` (`workspace_id`,`project_id`,`snapshot_at`);--> statement-breakpoint
CREATE TABLE `analytics_schema_versions` (
	`stream` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analytics_snapshot_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`source_watermark` text,
	`coverage` text DEFAULT '{}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_snapshot_runs_workspace_started_idx` ON `analytics_snapshot_runs` (`workspace_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `analytics_users` (
	`clerk_id` text PRIMARY KEY NOT NULL,
	`linked_workspace_id` text,
	`scope_kind` text,
	`planning_period_id` text,
	`timezone` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analytics_view_preferences` (
	`clerk_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`hidden_card_ids` text DEFAULT '[]' NOT NULL,
	`pinned_card_ids` text DEFAULT '[]' NOT NULL,
	`card_order` text DEFAULT '[]' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`clerk_id`, `workspace_id`)
);
--> statement-breakpoint
CREATE INDEX `analytics_view_preferences_workspace_idx` ON `analytics_view_preferences` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `briefing_feedback` (
	`clerk_id` text NOT NULL,
	`item_key` text NOT NULL,
	`verdict` text NOT NULL,
	`trigger_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`clerk_id`, `item_key`)
);
--> statement-breakpoint
CREATE TABLE `phrasing_rotations` (
	`clerk_id` text NOT NULL,
	`trigger_id` text NOT NULL,
	`last_index` integer DEFAULT 0 NOT NULL,
	`last_fired_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`clerk_id`, `trigger_id`)
);
--> statement-breakpoint
CREATE TABLE `planning_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`scope_kind` text NOT NULL,
	`workspace_count` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `surfaced_items` (
	`clerk_id` text NOT NULL,
	`item_key` text NOT NULL,
	`trigger_id` text NOT NULL,
	`first_day` integer NOT NULL,
	`last_day` integer NOT NULL,
	`run_days` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`clerk_id`, `item_key`, `trigger_id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`cadence` text DEFAULT 'weekly' NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`last_sent_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_unsubscribe_token_unique` ON `user_preferences` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `user_preferences_cadence_last_sent_idx` ON `user_preferences` (`cadence`,`last_sent_at`);
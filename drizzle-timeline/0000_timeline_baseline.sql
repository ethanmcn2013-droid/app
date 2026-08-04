CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_slug` text NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_entity` ON `activity` (`entity_kind`,`entity_id`);--> statement-breakpoint
CREATE TABLE `audience_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`rotated_at` integer,
	`revoked_at` integer,
	`last_access_at` integer,
	`visit_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `timeline_publications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_audience_shares_token_hash` ON `audience_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_audience_shares_publication` ON `audience_shares` (`publication_id`,`state`);--> statement-breakpoint
CREATE INDEX `idx_audience_shares_expiry` ON `audience_shares` (`expires_at`);--> statement-breakpoint
CREATE TABLE `audience_view_receipts` (
	`publication_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`publication_id`, `session_hash`),
	FOREIGN KEY (`publication_id`) REFERENCES `timeline_publications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audience_view_receipts_expiry` ON `audience_view_receipts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`workspace_slug` text NOT NULL,
	`body` text NOT NULL,
	`author` text DEFAULT 'Ethan' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_task` ON `comments` (`task_id`);--> statement-breakpoint
CREATE TABLE `node_overlays` (
	`workspace_slug` text NOT NULL,
	`node_id` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`label_override` text,
	`lane_override` text,
	`date_override` text,
	`sort_override` integer,
	`source` text DEFAULT 'synced' NOT NULL,
	`manual_title` text,
	`manual_status` text,
	`manual_target_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_slug`, `node_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_node_overlays_workspace` ON `node_overlays` (`workspace_slug`);--> statement-breakpoint
CREATE TABLE `project_sources` (
	`project_slug` text NOT NULL,
	`workspace_slug` text NOT NULL,
	`raw_markdown` text NOT NULL,
	`last_parsed_at` integer,
	`parse_error` text,
	PRIMARY KEY(`project_slug`, `workspace_slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_sources_workspace` ON `project_sources` (`workspace_slug`);--> statement-breakpoint
CREATE TABLE `projects` (
	`workspace_slug` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`one_liner` text NOT NULL,
	`accent` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`source_tasks_workspace_id` text,
	PRIMARY KEY(`workspace_slug`, `slug`)
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`workspace_slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'next' NOT NULL,
	`assignee` text DEFAULT 'claude-code' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_subtasks_task` ON `subtasks` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_slug` text NOT NULL,
	`workspace_slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'next' NOT NULL,
	`phase` text,
	`tier` text,
	`assignee` text DEFAULT 'claude-code' NOT NULL,
	`cycle_label` text,
	`target_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'cycle' NOT NULL,
	`category` text,
	`priority` text,
	`blocker_id` text,
	`unblocks` integer,
	`week_heading` text,
	`channel` text,
	`is_launch` integer DEFAULT false NOT NULL,
	`day` text,
	`posting_time` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_project_status` ON `tasks` (`project_slug`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assignee` ON `tasks` (`assignee`);--> statement-breakpoint
CREATE INDEX `idx_tasks_phase` ON `tasks` (`phase`);--> statement-breakpoint
CREATE INDEX `idx_tasks_kind` ON `tasks` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_tasks_blocker` ON `tasks` (`blocker_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_workspace_project` ON `tasks` (`workspace_slug`,`project_slug`);--> statement-breakpoint
CREATE TABLE `timeline_publication_items` (
	`public_id` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`title` text NOT NULL,
	`calendar_date` text,
	`state` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`source_relation` text NOT NULL,
	`source_digest` text NOT NULL,
	`copied_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	`unpublished_at` integer,
	`diverged_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `timeline_publications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_timeline_publication_items_publication` ON `timeline_publication_items` (`publication_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_timeline_publication_items_source` ON `timeline_publication_items` (`source_relation`);--> statement-breakpoint
CREATE TABLE `timeline_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_slug` text NOT NULL,
	`source_workspace_id` text NOT NULL,
	`source_object_id` text,
	`source_revision` integer DEFAULT 1 NOT NULL,
	`source_digest` text NOT NULL,
	`label` text NOT NULL,
	`primary_date_label` text,
	`primary_date` text,
	`audience_kind` text NOT NULL,
	`timezone` text NOT NULL,
	`owner_display_label` text,
	`state` text DEFAULT 'draft' NOT NULL,
	`last_updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	`unpublished_at` integer,
	`qualified_view_count` integer DEFAULT 0 NOT NULL,
	`last_qualified_view_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_timeline_publications_workspace` ON `timeline_publications` (`workspace_slug`);--> statement-breakpoint
CREATE INDEX `idx_timeline_publications_source_workspace` ON `timeline_publications` (`source_workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_timeline_publications_state` ON `timeline_publications` (`state`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` text NOT NULL,
	`suite_workspace_id` text,
	`owner_name` text,
	`owner_email` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`template_id` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner` ON `workspaces` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_suite_workspace_id` ON `workspaces` (`suite_workspace_id`);
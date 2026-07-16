CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`blocker_id` text,
	`note` text,
	`priority` text DEFAULT 'P1' NOT NULL,
	`ord` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activities_task_created` ON `activities` (`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activities_ws_created` ON `activities` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`task_id` text NOT NULL,
	`uploader_user_id` text NOT NULL,
	`filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `blockers` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`target_date` text,
	`description` text NOT NULL,
	`note` text,
	`resolved_at` integer,
	`ord` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_task_id` ON `comments` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_user_id` ON `comments` (`user_id`);--> statement-breakpoint
CREATE TABLE `comp_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`tier` text NOT NULL,
	`duration_days` integer NOT NULL,
	`quantity` integer NOT NULL,
	`redeemed` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`source` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	`notes` text,
	`reached_board_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_entitlements_user_workspace` ON `entitlements` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_digest` integer DEFAULT true NOT NULL,
	`mentions` integer DEFAULT true NOT NULL,
	`comment_replies` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`task_id` text,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_task_id` ON `notifications` (`task_id`);--> statement-breakpoint
CREATE TABLE `pending_invites` (
	`token` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`accepted_by_user_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `planning_onboarding_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`context_type` text NOT NULL,
	`state` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planning_onboarding_context_type_check" CHECK("planning_onboarding_sessions"."context_type" IN ('school_year', 'semester', 'wedding_season', 'general')),
	CONSTRAINT "planning_onboarding_state_json_check" CHECK(json_valid("planning_onboarding_sessions"."state")),
	CONSTRAINT "planning_onboarding_status_check" CHECK("planning_onboarding_sessions"."status" IN ('in_progress', 'completed', 'abandoned'))
);
--> statement-breakpoint
CREATE INDEX `idx_planning_onboarding_user_status` ON `planning_onboarding_sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `planning_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`context_type` text DEFAULT 'general' NOT NULL,
	`start_date` text,
	`end_date` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`archived_at` integer,
	`position` real DEFAULT 1000 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planning_periods_context_type_check" CHECK("planning_periods"."context_type" IN ('school_year', 'semester', 'wedding_season', 'general')),
	CONSTRAINT "planning_periods_start_date_check" CHECK("planning_periods"."start_date" IS NULL OR "planning_periods"."start_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "planning_periods_end_date_check" CHECK("planning_periods"."end_date" IS NULL OR "planning_periods"."end_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "planning_periods_date_order_check" CHECK("planning_periods"."start_date" IS NULL OR "planning_periods"."end_date" IS NULL OR "planning_periods"."start_date" <= "planning_periods"."end_date")
);
--> statement-breakpoint
CREATE INDEX `idx_planning_periods_owner_position` ON `planning_periods` (`owner_user_id`,`archived_at`,`position`);--> statement-breakpoint
CREATE TABLE `processed_webhooks` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_items` (
	`id` text PRIMARY KEY NOT NULL,
	`week` integer NOT NULL,
	`week_theme` text,
	`week_range` text,
	`date` text,
	`day` text,
	`kind` text NOT NULL,
	`channel` text,
	`format` text,
	`source` text,
	`cta` text,
	`posting_time` text,
	`body` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_launch` integer DEFAULT false NOT NULL,
	`note` text,
	`blocker_id` text,
	`ord` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `share_link_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`visited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_agent_hint` text,
	FOREIGN KEY (`token`) REFERENCES `share_links`(`token`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_share_link_visits_token_at` ON `share_link_visits` (`token`,`visited_at`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`view` text NOT NULL,
	`mode` text DEFAULT 'view' NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`revoked_at` integer,
	`expires_at` integer,
	`visits` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_share_links_workspace_id` ON `share_links` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `suite_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` text,
	`workspace_id` text,
	`object_ref` text,
	`payload` text NOT NULL,
	`trace_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`delivered_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suite_outbox_event_id_unique` ON `suite_outbox` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_suite_outbox_pending` ON `suite_outbox` (`delivered_at`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_suite_outbox_workspace` ON `suite_outbox` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`title` text NOT NULL,
	`description` text,
	`lane` text NOT NULL,
	`priority` text NOT NULL,
	`assignees` text DEFAULT '[]' NOT NULL,
	`due` text,
	`due_at` integer,
	`estimate` integer,
	`tags` text,
	`idle_days` integer,
	`blocked_by` text,
	`recurrence` text,
	`start_day` integer,
	`duration_days` integer,
	`position` real,
	`parent_task_id` text,
	`external_contact_name` text,
	`external_contact_email` text,
	`cents` integer,
	`source_note_id` text,
	`board_column_key` text,
	`is_milestone` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_workspace_id` ON `tasks` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent_task_id` ON `tasks` (`parent_task_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_ws_lane` ON `tasks` (`workspace_id`,`lane`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due_at` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_ws_milestone` ON `tasks` (`workspace_id`,`is_milestone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_source_note_id` ON `tasks` (`source_note_id`) WHERE "tasks"."source_note_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_signal_cadence` text DEFAULT 'off' NOT NULL,
	`weekly_summary` text DEFAULT 'off' NOT NULL,
	`time_zone` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_id` text,
	`email` text,
	`handle` text,
	`name` text,
	`color` text NOT NULL,
	`initials` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user_id` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspace_sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`sponsor_id` text NOT NULL,
	`sponsor_ref` text,
	`entitlement_ref` text,
	`status` text DEFAULT 'active' NOT NULL,
	`consented_metadata` text DEFAULT '{}' NOT NULL,
	`metadata_version` integer DEFAULT 1 NOT NULL,
	`consent_receipt_id` text NOT NULL,
	`consented_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_sponsorships_status_check" CHECK("workspace_sponsorships"."status" IN ('active', 'revoked', 'expired')),
	CONSTRAINT "workspace_sponsorships_metadata_json_check" CHECK(json_valid("workspace_sponsorships"."consented_metadata"))
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_sponsorships_workspace` ON `workspace_sponsorships` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_workspace_sponsorships_sponsor` ON `workspace_sponsorships` (`sponsor_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text,
	`planning_period_id` text,
	`context_type` text DEFAULT 'project' NOT NULL,
	`primary_date` text,
	`primary_date_label` text,
	`position` real DEFAULT 1000 NOT NULL,
	`archived_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`active_domain` text,
	`primary_use_case` text,
	`secondary_context` text,
	`onboarding_completed_at` integer,
	`template_id` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`planning_period_id`) REFERENCES `planning_periods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_period_position` ON `workspaces` (`planning_period_id`,`archived_at`,`position`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS tasks_parent_workspace_guard_insert
BEFORE INSERT ON tasks
WHEN NEW.parent_task_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks parent
    WHERE parent.id = NEW.parent_task_id
      AND parent.workspace_id = NEW.workspace_id
      AND parent.parent_task_id IS NULL
  ) THEN RAISE(ABORT, 'parent task must be a top-level task in the same workspace') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS tasks_parent_workspace_guard_update
BEFORE UPDATE OF parent_task_id, workspace_id ON tasks
WHEN NEW.parent_task_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks parent
    WHERE parent.id = NEW.parent_task_id
      AND parent.workspace_id = NEW.workspace_id
      AND parent.parent_task_id IS NULL
  ) THEN RAISE(ABORT, 'parent task must be a top-level task in the same workspace') END;
END;


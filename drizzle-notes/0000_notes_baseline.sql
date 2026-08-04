CREATE TABLE `calendar_connections` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`calendar_id` text NOT NULL,
	`refresh_token` text NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_connections_user_idx` ON `calendar_connections` (`user_id`,`provider`,`calendar_id`);--> statement-breakpoint
CREATE TABLE `note_task_send_outbox` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_selection` text NOT NULL,
	`approved_body` text NOT NULL,
	`approved_body_sha256` text NOT NULL,
	`workspace_id` text NOT NULL,
	`base_updated_at` integer NOT NULL,
	`reserved_updated_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`task_id` text,
	`lease_token` text,
	`lease_expires_at` integer,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "note_task_send_outbox_approved_hash_ck" CHECK(length("note_task_send_outbox"."approved_body_sha256") = 64 AND "note_task_send_outbox"."approved_body_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "note_task_send_outbox_version_ck" CHECK("note_task_send_outbox"."reserved_updated_at" > "note_task_send_outbox"."base_updated_at"),
	CONSTRAINT "note_task_send_outbox_lifecycle_ck" CHECK((
          "note_task_send_outbox"."status" = 'pending'
          AND "note_task_send_outbox"."task_id" IS NULL
          AND "note_task_send_outbox"."completed_at" IS NULL
          AND (
            ("note_task_send_outbox"."lease_token" IS NULL AND "note_task_send_outbox"."lease_expires_at" IS NULL)
            OR
            ("note_task_send_outbox"."lease_token" IS NOT NULL AND "note_task_send_outbox"."lease_expires_at" IS NOT NULL)
          )
        ) OR (
          "note_task_send_outbox"."status" = 'completed'
          AND "note_task_send_outbox"."task_id" IS NOT NULL
          AND "note_task_send_outbox"."completed_at" IS NOT NULL
          AND "note_task_send_outbox"."lease_token" IS NULL
          AND "note_task_send_outbox"."lease_expires_at" IS NULL
        )),
	CONSTRAINT "note_task_send_outbox_attempt_count_ck" CHECK("note_task_send_outbox"."attempt_count" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_task_send_outbox_user_note_uq` ON `note_task_send_outbox` (`user_id`,`note_id`);--> statement-breakpoint
CREATE INDEX `note_task_send_outbox_user_status_idx` ON `note_task_send_outbox` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `note_task_send_outbox_note_idx` ON `note_task_send_outbox` (`note_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`extract_body` text,
	`promoted_task_id` text,
	`archived_at` integer,
	`workspace_id` text,
	`source` text
);
--> statement-breakpoint
CREATE INDEX `notes_user_created_idx` ON `notes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notes_user_workspace_created_idx` ON `notes` (`user_id`,`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `spawned_calendar_events` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`calendar_event_id` text NOT NULL,
	`occurrence_start` integer NOT NULL,
	`note_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spawned_calendar_events_user_event_occurrence_idx` ON `spawned_calendar_events` (`user_id`,`provider`,`calendar_event_id`,`occurrence_start`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`capture_slug` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_capture_slug_unique` ON `user_preferences` (`capture_slug`);--> statement-breakpoint
CREATE INDEX `user_preferences_capture_slug_idx` ON `user_preferences` (`capture_slug`);
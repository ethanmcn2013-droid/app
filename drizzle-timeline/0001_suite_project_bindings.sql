CREATE TABLE `suite_project_bindings` (
	`tasks_workspace_id` text PRIMARY KEY NOT NULL,
	`timeline_workspace_slug` text NOT NULL,
	`primary_timeline_slug` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`provenance` text NOT NULL,
	`mapping_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`timeline_workspace_slug`) REFERENCES `workspaces`(`slug`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`timeline_workspace_slug`,`primary_timeline_slug`) REFERENCES `projects`(`workspace_slug`,`slug`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_suite_binding_state" CHECK("suite_project_bindings"."state" IN ('active', 'orphaned', 'retired')),
	CONSTRAINT "ck_suite_binding_provenance" CHECK("suite_project_bindings"."provenance" IN ('provisioned', 'legacy_exact', 'operator_confirmed')),
	CONSTRAINT "ck_suite_binding_mapping_version" CHECK("suite_project_bindings"."mapping_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_suite_binding_timeline_workspace` ON `suite_project_bindings` (`timeline_workspace_slug`);--> statement-breakpoint
CREATE TABLE `timeline_source_sync_state` (
	`tasks_workspace_id` text PRIMARY KEY NOT NULL,
	`timeline_workspace_slug` text NOT NULL,
	`timeline_slug` text NOT NULL,
	`status` text DEFAULT 'never' NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_expires_at` integer,
	`source_count` integer,
	`imported_count` integer,
	`snapshot_digest` text,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`error_code` text,
	FOREIGN KEY (`tasks_workspace_id`) REFERENCES `suite_project_bindings`(`tasks_workspace_id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`timeline_workspace_slug`,`timeline_slug`) REFERENCES `projects`(`workspace_slug`,`slug`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "ck_sync_state_status" CHECK("timeline_source_sync_state"."status" IN ('never', 'syncing', 'complete', 'empty', 'partial', 'error', 'unauthorized')),
	CONSTRAINT "ck_sync_state_generation" CHECK("timeline_source_sync_state"."generation" >= 0),
	CONSTRAINT "ck_sync_state_lease_pair" CHECK(("timeline_source_sync_state"."lease_token" IS NULL) = ("timeline_source_sync_state"."lease_expires_at" IS NULL)),
	CONSTRAINT "ck_sync_state_counts" CHECK(("timeline_source_sync_state"."source_count" IS NULL OR "timeline_source_sync_state"."source_count" >= 0) AND ("timeline_source_sync_state"."imported_count" IS NULL OR "timeline_source_sync_state"."imported_count" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_timeline_sync_state_timeline` ON `timeline_source_sync_state` (`timeline_workspace_slug`,`timeline_slug`);--> statement-breakpoint
CREATE INDEX `idx_projects_source_tasks_workspace` ON `projects` (`source_tasks_workspace_id`);
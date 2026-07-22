CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`url` text,
	`mime_type` text,
	`size_bytes` integer,
	`thumbnail` text,
	`added_by_user_id` text,
	`added_at` integer NOT NULL,
	`refreshed_at` integer,
	`access_state` text DEFAULT 'ok' NOT NULL,
	`counts_against_storage` integer DEFAULT 0 NOT NULL,
	CHECK(`kind` IN ('upload','link'))
);--> statement-breakpoint
CREATE INDEX `idx_resources_task_id` ON `resources` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_resources_workspace_id` ON `resources` (`workspace_id`);--> statement-breakpoint
-- Idempotent backfill: migrate existing attachment rows into resources.
-- Derived id = 'res-' || attachments.id for deterministic idempotency.
-- access_state = 'legacy' because the local-disk bytes may not exist in
-- a future cloud-storage world; the UI renders these rows normally since
-- the bytes still exist locally for local-disk deployments.
-- attachments.created_at is already integer unix-epoch seconds.
-- COALESCE workspace_id to '' for any pre-cutover rows that have NULL.
INSERT INTO `resources` (
	`id`, `workspace_id`, `task_id`, `kind`, `provider`,
	`title`, `mime_type`, `size_bytes`,
	`added_by_user_id`, `added_at`,
	`access_state`, `counts_against_storage`
)
SELECT
	'res-' || a.id,
	COALESCE(a.workspace_id, ''),
	a.task_id,
	'upload',
	'file',
	a.filename,
	a.mime_type,
	a.size_bytes,
	a.uploader_user_id,
	a.created_at,
	'legacy',
	1
FROM `attachments` a
WHERE NOT EXISTS (
	SELECT 1 FROM `resources` r WHERE r.id = 'res-' || a.id
);

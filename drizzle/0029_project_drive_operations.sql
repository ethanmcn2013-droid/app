-- 0029 · Durable Project Drive operation journal
--
-- Google can commit a folder or permission before Signal Studio commits the
-- matching custody row. This journal is the durable seam across that split:
-- an operation is inserted before the provider call, then keeps only stable
-- provider receipts and normalized failure codes. OAuth tokens, raw provider
-- responses, resumable-upload URLs and other credentials do not belong here.
--
-- target_storage_generation_id intentionally has no foreign key. It reserves
-- an immutable generation before its Drive folder exists, when a
-- workspace_storage row cannot yet satisfy that table's required folder ids.
-- Failed permission deletion is deliberately not a second operation kind:
-- drive_folder_grants.revoke_pending and its exact permission_id remain the
-- sole revoke-repair queue. A project_delete row is operational intent, not a
-- tombstone; after every grant/provider repair succeeds, lifecycle code removes
-- it in the same final transaction that removes the workspace.

CREATE TABLE `project_drive_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`operation_kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`dedupe_key` text NOT NULL,
	`connection_id` text,
	`storage_generation_id` text,
	`target_storage_generation_id` text,
	`subject_user_id` text,
	`grantee_email` text,
	`grant_role` text,
	`workspace_revision` integer,
	`provider_folder_id` text,
	`provider_folder_web_view_link` text,
	`provider_permission_id` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`next_attempt_at` integer,
	`lease_expires_at` integer,
	`last_error_code` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	CONSTRAINT `project_drive_operations_workspace_fk`
		FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `project_drive_operations_connection_fk`
		FOREIGN KEY (`connection_id`) REFERENCES `provider_connections`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `project_drive_operations_storage_fk`
		FOREIGN KEY (`storage_generation_id`,`workspace_id`)
		REFERENCES `workspace_storage`(`id`,`workspace_id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `project_drive_operations_subject_user_fk`
		FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `project_drive_operations_kind_check`
		CHECK (`operation_kind` IN (
			'folder_provision','grant_create','folder_rename',
			'project_delete','storage_handover'
		)),
	CONSTRAINT `project_drive_operations_status_check`
		CHECK (`status` IN (
			'pending','running','retry_wait','manual_attention',
			'succeeded','cancelled'
		)),
	CONSTRAINT `project_drive_operations_dedupe_key_check`
		CHECK (
			length(`dedupe_key`) = 64
			AND `dedupe_key` = lower(`dedupe_key`)
			AND `dedupe_key` NOT GLOB '*[^0-9a-f]*'
		),
	CONSTRAINT `project_drive_operations_error_code_check`
		CHECK (`last_error_code` IS NULL OR `last_error_code` IN (
			'ambiguous_provider_result','cannot_invite_non_google_user',
			'connection_not_current','folder_missing','grant_not_found',
			'network_error','permission_denied','provider_conflict',
			'provider_unavailable','quota_full','rate_limited',
			'reauth_required','repair_incomplete','workspace_changed'
		)),
	CONSTRAINT `project_drive_operations_attempt_check`
		CHECK (
			typeof(`attempt_count`) = 'integer'
			AND `attempt_count` >= 0
			AND ((`attempt_count` = 0 AND `last_attempt_at` IS NULL)
				OR (`attempt_count` > 0 AND `last_attempt_at` IS NOT NULL))
			AND (`last_attempt_at` IS NULL OR `last_attempt_at` >= `created_at`)
			AND (`next_attempt_at` IS NULL OR `next_attempt_at` >= `last_attempt_at`)
			AND (`lease_expires_at` IS NULL OR `lease_expires_at` >= `last_attempt_at`)
		),
	CONSTRAINT `project_drive_operations_integer_type_check`
		CHECK (
			typeof(`created_at`) = 'integer' AND `created_at` >= 0
			AND typeof(`updated_at`) = 'integer' AND `updated_at` >= 0
			AND (`last_attempt_at` IS NULL OR
				(typeof(`last_attempt_at`) = 'integer' AND `last_attempt_at` >= 0))
			AND (`next_attempt_at` IS NULL OR
				(typeof(`next_attempt_at`) = 'integer' AND `next_attempt_at` >= 0))
			AND (`lease_expires_at` IS NULL OR
				(typeof(`lease_expires_at`) = 'integer' AND `lease_expires_at` >= 0))
			AND (`completed_at` IS NULL OR
				(typeof(`completed_at`) = 'integer' AND `completed_at` >= 0))
		),
	CONSTRAINT `project_drive_operations_status_time_check`
		CHECK (
			(`status` = 'pending'
				AND `lease_expires_at` IS NULL
				AND `next_attempt_at` IS NULL
				AND `completed_at` IS NULL)
			OR (`status` = 'running'
				AND `attempt_count` > 0
				AND `lease_expires_at` IS NOT NULL
				AND `next_attempt_at` IS NULL
				AND `completed_at` IS NULL)
			OR (`status` = 'retry_wait'
				AND `attempt_count` > 0
				AND `lease_expires_at` IS NULL
				AND `next_attempt_at` IS NOT NULL
				AND `last_error_code` IS NOT NULL
				AND `completed_at` IS NULL)
			OR (`status` = 'manual_attention'
				AND `attempt_count` > 0
				AND `lease_expires_at` IS NULL
				AND `next_attempt_at` IS NULL
				AND `last_error_code` IS NOT NULL
				AND `completed_at` IS NULL)
			OR (`status` IN ('succeeded','cancelled')
				AND (`status` = 'cancelled' OR `attempt_count` > 0)
				AND `lease_expires_at` IS NULL
				AND `next_attempt_at` IS NULL
				AND `completed_at` IS NOT NULL)
		),
	CONSTRAINT `project_drive_operations_timestamp_check`
		CHECK (
			`updated_at` >= `created_at`
			AND (`completed_at` IS NULL OR `completed_at` >= `created_at`)
		),
	CONSTRAINT `project_drive_operations_folder_receipt_check`
		CHECK (
			(`provider_folder_id` IS NULL
				AND `provider_folder_web_view_link` IS NULL)
			OR (`provider_folder_id` IS NOT NULL
				AND length(trim(`provider_folder_id`)) > 0
				AND `provider_folder_web_view_link` IS NOT NULL
				AND length(trim(`provider_folder_web_view_link`)) > 0)
		),
	CONSTRAINT `project_drive_operations_email_check`
		CHECK (`grantee_email` IS NULL OR (
			length(`grantee_email`) BETWEEN 3 AND 320
			AND `grantee_email` = lower(trim(`grantee_email`))
			AND instr(`grantee_email`, '@') > 1
			AND substr(`grantee_email`, -1) <> '@'
		)),
	CONSTRAINT `project_drive_operations_grant_role_check`
		CHECK (`grant_role` IS NULL OR `grant_role` IN ('writer','reader')),
	CONSTRAINT `project_drive_operations_revision_check`
		CHECK (`workspace_revision` IS NULL OR (
			typeof(`workspace_revision`) = 'integer'
			AND `workspace_revision` >= 1
		)),
	CONSTRAINT `project_drive_operations_kind_shape_check`
		CHECK (
			(`operation_kind` = 'folder_provision'
				AND `connection_id` IS NOT NULL
				AND `storage_generation_id` IS NULL
				AND `target_storage_generation_id` IS NOT NULL
				AND `subject_user_id` IS NULL
				AND `grantee_email` IS NULL
				AND `grant_role` IS NULL
				AND `workspace_revision` IS NULL
				AND `provider_permission_id` IS NULL)
			OR (`operation_kind` = 'grant_create'
				AND `connection_id` IS NULL
				AND `storage_generation_id` IS NOT NULL
				AND `target_storage_generation_id` IS NULL
				AND `subject_user_id` IS NOT NULL
				AND `grantee_email` IS NOT NULL
				AND `grant_role` IS NOT NULL
				AND `workspace_revision` IS NULL
				AND `provider_folder_id` IS NULL
				AND `provider_folder_web_view_link` IS NULL)
			OR (`operation_kind` = 'folder_rename'
				AND `connection_id` IS NULL
				AND `storage_generation_id` IS NOT NULL
				AND `target_storage_generation_id` IS NULL
				AND `subject_user_id` IS NULL
				AND `grantee_email` IS NULL
				AND `grant_role` IS NULL
				AND `workspace_revision` IS NOT NULL
				AND `provider_folder_id` IS NULL
				AND `provider_folder_web_view_link` IS NULL
				AND `provider_permission_id` IS NULL)
			OR (`operation_kind` = 'project_delete'
				AND `connection_id` IS NULL
				AND `storage_generation_id` IS NULL
				AND `target_storage_generation_id` IS NULL
				AND `subject_user_id` IS NULL
				AND `grantee_email` IS NULL
				AND `grant_role` IS NULL
				AND `workspace_revision` IS NULL
				AND `provider_folder_id` IS NULL
				AND `provider_folder_web_view_link` IS NULL
				AND `provider_permission_id` IS NULL)
			OR (`operation_kind` = 'storage_handover'
				AND `connection_id` IS NOT NULL
				AND `storage_generation_id` IS NOT NULL
				AND `target_storage_generation_id` IS NOT NULL
				AND `target_storage_generation_id` <> `storage_generation_id`
				AND `subject_user_id` IS NULL
				AND `grantee_email` IS NULL
				AND `grant_role` IS NULL
				AND `workspace_revision` IS NULL
				AND `provider_permission_id` IS NULL)
		),
	CONSTRAINT `project_drive_operations_terminal_receipt_check`
		CHECK (
			`status` <> 'succeeded'
			OR (`operation_kind` IN ('folder_provision','storage_handover')
				AND `provider_folder_id` IS NOT NULL)
			OR (`operation_kind` = 'grant_create'
				AND `provider_permission_id` IS NOT NULL
				AND length(trim(`provider_permission_id`)) > 0)
			OR `operation_kind` IN ('folder_rename','project_delete')
		),
	CONSTRAINT `project_drive_operations_cancelled_receipt_check`
		CHECK (`status` <> 'cancelled' OR (
			`provider_folder_id` IS NULL
			AND `provider_folder_web_view_link` IS NULL
			AND `provider_permission_id` IS NULL
		))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_drive_operations_dedupe`
	ON `project_drive_operations` (`dedupe_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_drive_operations_target_generation`
	ON `project_drive_operations` (`target_storage_generation_id`)
	WHERE `target_storage_generation_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_project_drive_operations_workspace_status`
	ON `project_drive_operations` (`workspace_id`,`status`,`operation_kind`);
--> statement-breakpoint
CREATE INDEX `idx_project_drive_operations_ready`
	ON `project_drive_operations` (`status`,`next_attempt_at`,`lease_expires_at`,`created_at`)
	WHERE `status` IN ('pending','running','retry_wait');
--> statement-breakpoint
CREATE INDEX `idx_project_drive_operations_connection`
	ON `project_drive_operations` (`connection_id`)
	WHERE `connection_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_project_drive_operations_storage`
	ON `project_drive_operations` (`storage_generation_id`,`workspace_id`)
	WHERE `storage_generation_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_project_drive_operations_subject_user`
	ON `project_drive_operations` (`subject_user_id`)
	WHERE `subject_user_id` IS NOT NULL;

-- 0028 · Project Drive storage generations
--
-- Additive only. Existing resource rows stay Signal-native. A Drive-backed
-- workspace keeps immutable credential and folder generations, with partial
-- unique indexes enforcing at most one current row. A dedicated storage id is
-- required for owner A → B → A and for a replacement folder under the same
-- credential. Grants keep that generation id so handover cannot overwrite the
-- permission receipt for the old folder.

CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`provider_account_email` text,
	`root_folder_id` text NOT NULL,
	`refresh_token_cipher` text NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`scopes` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL,
	`connected_at` integer NOT NULL,
	`last_used_at` integer,
	`last_error_at` integer,
	CONSTRAINT `provider_connections_user_fk`
		FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `provider_connections_key_version_check`
		CHECK (`key_version` >= 1),
	CONSTRAINT `provider_connections_scopes_json_check`
		CHECK (json_valid(`scopes`)),
	CONSTRAINT `provider_connections_status_check`
		CHECK (`status` IN ('active','needs_reauth','revoked')),
	CONSTRAINT `provider_connections_is_current_check`
		CHECK (`is_current` IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `idx_provider_connections_user_provider`
	ON `provider_connections` (`user_id`,`provider`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_provider_connections_current`
	ON `provider_connections` (`user_id`,`provider`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TABLE `workspace_storage` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`folder_id` text NOT NULL,
	`folder_web_view_link` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL,
	CONSTRAINT `workspace_storage_workspace_fk`
		FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `workspace_storage_connection_fk`
		FOREIGN KEY (`connection_id`) REFERENCES `provider_connections`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `workspace_storage_state_check`
		CHECK (`state` IN ('active','needs_reauth','folder_missing','quota_full')),
	CONSTRAINT `workspace_storage_is_current_check`
		CHECK (`is_current` IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_storage_current`
	ON `workspace_storage` (`workspace_id`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workspace_storage_generation_workspace`
	ON `workspace_storage` (`id`,`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_storage_workspace_id`
	ON `workspace_storage` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_storage_connection_id`
	ON `workspace_storage` (`connection_id`);
--> statement-breakpoint
CREATE TABLE `drive_folder_grants` (
	`storage_generation_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`granted_email` text NOT NULL,
	`role` text NOT NULL,
	`granted_at` integer NOT NULL,
	`revoke_pending` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`storage_generation_id`,`user_id`),
	CONSTRAINT `drive_folder_grants_storage_fk`
		FOREIGN KEY (`storage_generation_id`,`workspace_id`)
		REFERENCES `workspace_storage`(`id`,`workspace_id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `drive_folder_grants_user_fk`
		FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
		ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `drive_folder_grants_role_check`
		CHECK (`role` IN ('writer','reader')),
	CONSTRAINT `drive_folder_grants_revoke_pending_check`
		CHECK (`revoke_pending` IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `idx_drive_folder_grants_workspace_generation`
	ON `drive_folder_grants` (`workspace_id`,`storage_generation_id`);
--> statement-breakpoint
ALTER TABLE `resources` ADD COLUMN `storage` text NOT NULL DEFAULT 'signal'
	CONSTRAINT `resources_storage_check` CHECK (`storage` IN ('signal','drive'));
--> statement-breakpoint
ALTER TABLE `resources` ADD COLUMN `storage_generation_id` text
	REFERENCES `workspace_storage`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
	CONSTRAINT `resources_storage_generation_check`
		CHECK ((`storage` = 'signal' AND `storage_generation_id` IS NULL)
			OR (`storage` = 'drive' AND `storage_generation_id` IS NOT NULL));
--> statement-breakpoint
ALTER TABLE `resources` ADD COLUMN `stored_path` text;
--> statement-breakpoint
CREATE INDEX `idx_resources_workspace_storage_generation`
	ON `resources` (`workspace_id`,`storage_generation_id`)
	WHERE `storage_generation_id` IS NOT NULL;

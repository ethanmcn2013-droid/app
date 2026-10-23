CREATE TABLE `project_drive_subfolders` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `storage_generation_id` text NOT NULL,
  `connection_id` text NOT NULL,
  `provider_account_id` text NOT NULL,
  `parent_id` text NOT NULL,
  `folder_name` text NOT NULL,
  `status` text NOT NULL,
  `attempt_id` text,
  `lease_until` integer,
  `create_started` integer DEFAULT 0 NOT NULL,
  `folder_id` text,
  `folder_url` text,
  `created_at` integer NOT NULL,
  `provider_diagnostics` text DEFAULT '[]' NOT NULL,
  `provider_call_count` integer DEFAULT 0 NOT NULL,
  `provider_duration_ms` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE restrict,
  FOREIGN KEY (`storage_generation_id`,`workspace_id`) REFERENCES `workspace_storage`(`id`,`workspace_id`) ON DELETE restrict,
  FOREIGN KEY (`connection_id`) REFERENCES `provider_connections`(`id`) ON DELETE restrict,
  CONSTRAINT `project_drive_subfolder_status` CHECK (`status` IN ('pending','running','unknown','complete','attention')),
  CONSTRAINT `project_drive_subfolder_name` CHECK (length(`folder_name`) BETWEEN 1 AND 100 AND `folder_name` = trim(`folder_name`)),
  CONSTRAINT `project_drive_subfolder_diagnostics` CHECK (json_valid(`provider_diagnostics`) AND json_type(`provider_diagnostics`) = 'array'),
  CONSTRAINT `project_drive_subfolder_started` CHECK (`create_started` IN (0,1)),
  CONSTRAINT `project_drive_subfolder_receipt` CHECK ((`status` != 'complete' OR (`folder_id` IS NOT NULL AND `folder_url` IS NOT NULL)) AND ((`folder_id` IS NULL) = (`folder_url` IS NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_project_drive_subfolder_name` ON `project_drive_subfolders` (`storage_generation_id`,`folder_name`);
--> statement-breakpoint
CREATE INDEX `idx_project_drive_subfolder_workspace` ON `project_drive_subfolders` (`workspace_id`);

ALTER TABLE `notes` ADD `reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `notes_user_reviewed_idx` ON `notes` (`user_id`,`reviewed_at`,`created_at`);
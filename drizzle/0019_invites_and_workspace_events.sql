-- Migration 0019: invite hardening + workspace events
-- D-018: role column on pending_invites (grant-on-accept)
-- D-019: workspace_events table for workspace-scoped audit trail
-- Authorised: Signal Tasks Premium Programme Phase 2, 2026-07-21
ALTER TABLE `pending_invites` ADD `role` text NOT NULL DEFAULT 'member';
--> statement-breakpoint
ALTER TABLE `pending_invites` ADD `last_sent_at` integer;
--> statement-breakpoint
CREATE TABLE `workspace_events` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `user_id` text,
  `kind` text NOT NULL,
  `payload` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_events_workspace_created` ON `workspace_events` (`workspace_id`, `created_at`);

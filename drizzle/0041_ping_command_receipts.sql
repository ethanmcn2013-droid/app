-- Durable compact execution facts; no transcript, command body or title.
CREATE TABLE `ping_command_receipts` (
  `actor_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `command_id` text NOT NULL,
  `project_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  `plan_hash` text NOT NULL,
  `receipt_json` text NOT NULL CHECK(json_valid(`receipt_json`)),
  `committed_at` integer NOT NULL,
  PRIMARY KEY (`actor_id`, `command_id`)
);

-- Owner-private self-chat. It intentionally has no Project or participant relation.
CREATE TABLE `personal_chat_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL REFERENCES `users`(`id`),
  `body` text NOT NULL,
  `client_request_id` text NOT NULL,
  `request_hash` text NOT NULL,
  `created_at` integer NOT NULL,
  `edited_at` integer,
  CONSTRAINT `personal_chat_request_hash` CHECK(length(`request_hash`) = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_personal_chat_owner_request` ON `personal_chat_messages` (`owner_id`, `client_request_id`);
--> statement-breakpoint
CREATE INDEX `idx_personal_chat_owner_created` ON `personal_chat_messages` (`owner_id`, `created_at`, `id`);

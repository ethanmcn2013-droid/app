-- Wedding tools: households (one invitation) and guests (each person).
-- Additive only. Both cascade with their Project.
CREATE TABLE `wedding_households` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `email` text,
  `phone` text,
  `address` text,
  `group_label` text,
  `invited_to` text DEFAULT 'day' NOT NULL,
  `invitation` text DEFAULT 'not_sent' NOT NULL,
  `notes` text,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT "wedding_household_invited_to" CHECK("invited_to" IN ('day', 'evening')),
  CONSTRAINT "wedding_household_invitation" CHECK("invitation" IN ('not_sent', 'sent')),
  CONSTRAINT "wedding_household_name" CHECK(length("name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE INDEX `idx_wedding_households_workspace` ON `wedding_households` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `wedding_guests` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL REFERENCES `workspaces`(`id`) ON DELETE CASCADE,
  `household_id` text NOT NULL REFERENCES `wedding_households`(`id`) ON DELETE CASCADE,
  `first_name` text,
  `last_name` text,
  `rsvp` text DEFAULT 'awaiting' NOT NULL,
  `meal` text DEFAULT 'not_provided' NOT NULL,
  `dietary` text,
  `is_child` integer DEFAULT false NOT NULL,
  `plus_one_of` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT "wedding_guest_rsvp" CHECK("rsvp" IN ('awaiting', 'attending', 'not_attending')),
  CONSTRAINT "wedding_guest_meal" CHECK("meal" IN ('not_provided', 'no_preference', 'vegetarian', 'vegan', 'pescatarian', 'child')),
  CONSTRAINT "wedding_guest_named" CHECK("first_name" IS NOT NULL OR "plus_one_of" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_wedding_guests_workspace` ON `wedding_guests` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_wedding_guests_household` ON `wedding_guests` (`household_id`);

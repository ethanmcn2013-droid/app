-- 0038 · Durable personal Google Drive token revocation facts.
-- 0037 is reserved for the separately received J13 migration. This file must
-- not be applied remotely until the exact 0037→0038 chain is integrated.
-- Historical retired generations stay unknown; a local 'revoked' status alone
-- never proves that Google accepted a token revocation.

ALTER TABLE `provider_connections` ADD COLUMN `revoke_requested_at` integer;
--> statement-breakpoint
ALTER TABLE `provider_connections` ADD COLUMN `revoke_confirmed_at` integer;
--> statement-breakpoint
ALTER TABLE `provider_connections` ADD COLUMN `revoke_attempt_id` text;
--> statement-breakpoint
ALTER TABLE `provider_connections` ADD COLUMN `revoke_attempted_at` integer;

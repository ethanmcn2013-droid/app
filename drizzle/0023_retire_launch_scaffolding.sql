-- Migration 0023: retire the launch-scaffolding tables
-- 2026-07-31 data-layer reset (operator sign-off, decision D9): the GTM
-- roadmap /roadmap surface was removed. roadmap_items, blockers, and
-- action_items were verified EMPTY in production and in both local dev
-- databases before this migration was authored (db-archive/2026-07-31
-- dumps hold the proof). Founder to-dos live in
-- studio/content/hq/operator-todos/; there is exactly one founder
-- checklist system after this migration.
DROP TABLE `action_items`;
--> statement-breakpoint
DROP TABLE `roadmap_items`;
--> statement-breakpoint
DROP TABLE `blockers`;

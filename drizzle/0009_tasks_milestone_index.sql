-- Architecture Assurance Council, Phase 1 (2026-06-23).
--
-- The schema (src/server/db/schema.ts) now declares the hot indexes
-- that previously lived ONLY in 0003_hot_indexes.sql as raw SQL. That
-- drift was a latent hazard: `tasks` runs `drizzle-kit push --force`,
-- which diffs schema <-> DB and would DROP any index it doesn't see in
-- the schema. Mirroring 0003's index names/columns in the schema makes
-- push a no-op for them instead of a drop.
--
-- This migration adds the ONE hot path 0003 missed: the Roadmap sync
-- reads `WHERE is_milestone = 1` per workspace (ARCH_SPEC §1.1), which
-- was still a scan. IF NOT EXISTS keeps the file safe to re-run.
--
-- Apply on Turso prod via:
--   turso db shell ethanmcnamara-tasks < drizzle/0009_tasks_milestone_index.sql

CREATE INDEX IF NOT EXISTS idx_tasks_ws_milestone ON tasks(workspace_id, is_milestone);

-- Cleanup: 0003 created idx_entitlements_notes on the free-text
-- entitlements.notes column. It is never used in a WHERE/ORDER BY and
-- is not represented in the schema, so `push` will drop it. Dropping it
-- here too keeps prod and the schema in lockstep regardless of apply
-- order. Safe + idempotent.
DROP INDEX IF EXISTS idx_entitlements_notes;

-- RW-3b: add explicit boolean `is_milestone` to the tasks table.
--
-- Design rationale (ARCH_SPEC §1.1):
--   - Explicit boolean, NOT a tag string — index-friendly WHERE is_milestone=1.
--   - Enforces the strategy gate in schema (no accidental tag-based routing).
--   - Additive / reversible (mirrors sourceNoteId 0004 pattern).
--   - NOT NULL DEFAULT 0 keeps the flag false for all legacy rows.
--
-- Apply on Turso prod via:
--   turso db shell ethanmcnamara-tasks "ALTER TABLE tasks ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0;"
--
-- The migration is idempotent on a fresh DB (Drizzle push includes it).
-- On an existing prod DB apply the raw ALTER TABLE above — drizzle push
-- is not run against prod (same pattern as 0004_add_source_note_id.sql).

ALTER TABLE tasks ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0;

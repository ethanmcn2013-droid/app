-- Cycle 9.4b carry-over — the Notes → Tasks extract edge added a
-- `source_note_id` column to the Tasks schema in src/server/db/schema.ts
-- but no migration ever shipped, so prod Turso doesn't have the column.
-- That blew up cycle 8.5's venue-redemption walk on 2026-05-14:
-- every INSERT into `tasks` errors with "table tasks has no column
-- named source_note_id" because drizzle includes every schema column
-- in its INSERT, even the ones set to NULL.
--
-- Idempotent guard pattern matches drizzle/0001_add_reached_board_at.sql.
-- Apply on Turso prod via:
--   turso db shell ethanmcnamara-tasks "ALTER TABLE tasks ADD COLUMN source_note_id TEXT;"

ALTER TABLE tasks ADD COLUMN source_note_id TEXT;

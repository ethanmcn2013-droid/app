-- Code review 2026-05-15 (architect + qa, severity-1 / high).
--
-- `workspace_id` is declared nullable in src/server/db/schema.ts with
-- a standing comment promising it would be "tightened to NOT NULL
-- after the legacy backfill lands". That backfill never landed. The
-- live consequence today is NOT a cross-tenant leak — every read
-- filters `WHERE workspace_id = <ws>` and SQL `= 'ws'` never matches
-- NULL — it's silent data LOSS: any row that slipped through without
-- a workspace_id (pre-cutover rows, or a future codepath that forgets
-- to set it) becomes permanently invisible to its owner. The Analytics
-- cross-repo read also joins on this column.
--
-- This migration does the SAFE half: backfill every NULL workspace_id
-- to the legacy workspace so no row is orphaned. It is idempotent
-- (re-running only touches rows that are still NULL) and
-- non-destructive (no table rebuild, no dropped data).
--
-- Apply on Turso prod via (one statement at a time is fine):
--   turso db shell ethanmcnamara-tasks < drizzle/0005_workspace_id_backfill.sql
--
-- ── Operator follow-up, NOT done here ───────────────────────────────
-- Enforcing NOT NULL + a FOREIGN KEY ... ON DELETE CASCADE on these
-- seven columns requires SQLite's full table-rebuild dance (create
-- shadow table with the constraint, copy rows, drop, rename, recreate
-- every index) per table. That is a destructive, hard-to-reverse
-- operation that must be run by an operator against a fresh prod
-- backup, not auto-applied — so it is deliberately left out of this
-- file. Run the backfill below first and confirm zero NULLs remain
-- (`SELECT COUNT(*) FROM <t> WHERE workspace_id IS NULL;` → 0) before
-- scheduling the constraint rebuild. Sequence the rebuild as its own
-- migration once a backup + maintenance window is arranged.
-- ────────────────────────────────────────────────────────────────────

UPDATE tasks          SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE comments       SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE activities     SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE notifications  SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE entitlements   SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE share_links    SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;
UPDATE attachments    SET workspace_id = 'ws-legacy' WHERE workspace_id IS NULL;

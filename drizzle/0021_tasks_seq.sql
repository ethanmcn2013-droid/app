-- 0021: human-readable per-workspace task numbers.
--
-- Adds a nullable `seq` integer to tasks: the "T-14" the panel shows instead
-- of the raw hex id. Display + reference only — `id` remains the primary key
-- in every link and foreign key.
--
-- Design:
--   - Nullable, no default. New rows are numbered at insert time by an
--     atomic MAX+1 scalar subquery (src/server/db/task-seq.ts); writers
--     that skip allocation degrade to the hex-id display, never break.
--   - Backfill numbers every existing row per workspace in creation order
--     (created_at, id as the tiebreak) — subtasks included, so the counter
--     is a plain per-workspace insert ordinal.
--   - The unique partial index is the concurrency backstop for the MAX+1
--     allocation. Partial (seq IS NOT NULL) so unnumbered legacy writers
--     can never collide; SQLite additionally treats NULL workspace_id rows
--     as distinct.
--
-- Apply on Turso prod via the receipt-backed runner (pnpm db:migrate); the
-- raw statements below are also safe as a manual shell apply, in order.

ALTER TABLE tasks ADD COLUMN seq INTEGER;--> statement-breakpoint

UPDATE tasks SET seq = (
  SELECT COUNT(*) FROM tasks AS earlier
  WHERE COALESCE(earlier.workspace_id, '') = COALESCE(tasks.workspace_id, '')
    AND (
      earlier.created_at < tasks.created_at
      OR (earlier.created_at = tasks.created_at AND earlier.id <= tasks.id)
    )
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS tasks_workspace_seq_unique
  ON tasks(workspace_id, seq)
  WHERE seq IS NOT NULL;

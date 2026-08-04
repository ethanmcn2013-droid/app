-- 0025 · tasks.completedAt (T·122, board truth phase 3)
--
-- Done-ness became a config predicate (doneKeys + isTaskDone) and every
-- write path now stamps the moment a task crosses it. This column is the
-- durable record of that moment: Signal reads it before falling back to
-- reconstructing completion time from the activity log, which is how it
-- currently earns completion_timestamp_missing_for_terminal_tasks.
--
-- Backfill: for tasks that are done right now (canonical done lane, no
-- custom-column claim — no workspace has custom doneKeys before this
-- ships), take the latest activity-log transition into done where one
-- exists. Tasks whose completion predates the activity log stay NULL,
-- which is the honest value — a made-up timestamp would poison every
-- downstream reading.

ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
--> statement-breakpoint
UPDATE tasks
SET completed_at = (
  SELECT MAX(a.created_at)
  FROM activities a
  WHERE a.task_id = tasks.id
    AND (
      (a.kind = 'toggleComplete' AND json_extract(a.payload, '$.to') = 'done')
      OR (a.kind = 'move' AND json_extract(a.payload, '$.to') = 'done')
    )
)
WHERE lane = 'done'
  AND board_column_key IS NULL;

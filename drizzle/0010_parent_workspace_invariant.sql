-- Parent/subtask tenant invariant.
--
-- Apply only after auditing legacy rows and taking a verified backup:
--   SELECT COUNT(*) FROM tasks WHERE parent_task_id IS NOT NULL
--     AND (workspace_id IS NULL OR NOT EXISTS (
--       SELECT 1 FROM tasks parent
--       WHERE parent.id = tasks.parent_task_id
--         AND parent.workspace_id = tasks.workspace_id
--         AND parent.parent_task_id IS NULL
--     ));
--
-- The runtime guards landed first so an unapplied production migration is
-- still protected at the application boundary.

CREATE TRIGGER IF NOT EXISTS tasks_parent_workspace_guard_insert
BEFORE INSERT ON tasks
WHEN NEW.parent_task_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks parent
    WHERE parent.id = NEW.parent_task_id
      AND parent.workspace_id = NEW.workspace_id
      AND parent.parent_task_id IS NULL
  ) THEN RAISE(ABORT, 'parent task must be a top-level task in the same workspace') END;
END;

CREATE TRIGGER IF NOT EXISTS tasks_parent_workspace_guard_update
BEFORE UPDATE OF parent_task_id, workspace_id ON tasks
WHEN NEW.parent_task_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks parent
    WHERE parent.id = NEW.parent_task_id
      AND parent.workspace_id = NEW.workspace_id
      AND parent.parent_task_id IS NULL
  ) THEN RAISE(ABORT, 'parent task must be a top-level task in the same workspace') END;
END;

-- Notes→Tasks idempotency invariant.
-- A note can produce at most one task, while legacy/manual tasks keep NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_source_note_id
  ON tasks(source_note_id)
  WHERE source_note_id IS NOT NULL;

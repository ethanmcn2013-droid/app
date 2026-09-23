CREATE TABLE message_read_coverage (
  user_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('conversation','task_discussion')),
  scope_id TEXT NOT NULL,
  root_key TEXT NOT NULL DEFAULT '',
  range_start INTEGER NOT NULL CHECK (range_start >= 1),
  range_end INTEGER NOT NULL CHECK (range_end >= range_start),
  observed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (user_id,source_kind,scope_id,root_key,range_start,range_end)
);
--> statement-breakpoint
CREATE INDEX message_read_coverage_scope
  ON message_read_coverage(user_id,source_kind,scope_id,root_key,range_start,range_end);
--> statement-breakpoint
CREATE TRIGGER message_read_coverage_guard_insert BEFORE INSERT ON message_read_coverage
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id)
    OR (NEW.source_kind='conversation' AND NOT EXISTS
      (SELECT 1 FROM conversations WHERE id=NEW.scope_id))
    OR (NEW.source_kind='task_discussion' AND NOT EXISTS
      (SELECT 1 FROM task_discussion_state WHERE task_id=NEW.scope_id))
    THEN RAISE(ABORT,'invalid_message_read_coverage') END;
END;
--> statement-breakpoint
CREATE TRIGGER message_read_coverage_user_cleanup BEFORE DELETE ON users
BEGIN
  DELETE FROM message_read_coverage WHERE user_id=OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER message_read_coverage_conversation_cleanup BEFORE DELETE ON conversations
BEGIN
  DELETE FROM message_read_coverage WHERE source_kind='conversation' AND scope_id=OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER message_read_coverage_task_cleanup BEFORE DELETE ON tasks
BEGIN
  DELETE FROM message_read_coverage WHERE source_kind='task_discussion' AND scope_id=OLD.id;
END;

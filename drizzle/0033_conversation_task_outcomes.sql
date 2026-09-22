CREATE TABLE work_links (
  id TEXT PRIMARY KEY NOT NULL,
  source_project_id TEXT NOT NULL,
  source_conversation_id TEXT NOT NULL,
  source_message_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  source_audience_epoch INTEGER NOT NULL CHECK (source_audience_epoch >= 1),
  destination_project_id TEXT NOT NULL,
  task_id TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES conversation_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_project_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
--> statement-breakpoint
CREATE INDEX work_links_source ON work_links(source_conversation_id, source_message_id);
--> statement-breakpoint

CREATE TABLE work_operation_receipts (
  actor_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation = 'conversation_task'),
  payload_hash TEXT NOT NULL,
  source_project_id TEXT NOT NULL,
  destination_project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  work_link_id TEXT NOT NULL,
  committed_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, client_request_id, operation)
);
--> statement-breakpoint

CREATE TRIGGER work_links_guard_insert
BEFORE INSERT ON work_links
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = NEW.source_conversation_id AND c.workspace_id = NEW.source_project_id
      AND c.audience_epoch = NEW.source_audience_epoch
  ) THEN RAISE(ABORT, 'invalid_work_link_conversation') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_messages m
    WHERE m.id = NEW.source_message_id AND m.conversation_id = NEW.source_conversation_id
      AND m.workspace_id = NEW.source_project_id AND m.revision = NEW.source_revision AND m.deleted_at IS NULL
  ) THEN RAISE(ABORT, 'invalid_work_link_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = NEW.task_id AND t.workspace_id = NEW.destination_project_id
  ) THEN RAISE(ABORT, 'invalid_work_link_task') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.created_by)
    THEN RAISE(ABORT, 'invalid_work_link_creator') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members sm
    JOIN workspace_members dm ON dm.user_id = sm.user_id AND dm.workspace_id = NEW.destination_project_id
    WHERE sm.workspace_id = NEW.source_project_id AND sm.user_id = NEW.created_by
  ) THEN RAISE(ABORT, 'invalid_work_link_creator_membership') END;
END;
--> statement-breakpoint
CREATE TRIGGER work_links_identity_immutable
BEFORE UPDATE ON work_links
BEGIN SELECT RAISE(ABORT, 'immutable_work_link'); END;
--> statement-breakpoint

CREATE TRIGGER work_operation_receipts_guard_insert
BEFORE INSERT ON work_operation_receipts
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM work_links l
    WHERE l.id = NEW.work_link_id AND l.task_id = NEW.task_id AND l.created_by = NEW.actor_id
      AND l.source_project_id = NEW.source_project_id
      AND l.destination_project_id = NEW.destination_project_id
  ) THEN RAISE(ABORT, 'invalid_work_operation_receipt') END;
END;
--> statement-breakpoint
CREATE TRIGGER work_operation_receipts_identity_immutable
BEFORE UPDATE ON work_operation_receipts
BEGIN SELECT RAISE(ABORT, 'immutable_work_operation_receipt'); END;

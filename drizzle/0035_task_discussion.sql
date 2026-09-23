-- Canonical Task Discussion augments comments in place. No comment is mirrored
-- into conversation_messages and no legacy comment id is rewritten.
ALTER TABLE comments RENAME TO comments_before_task_discussion;
--> statement-breakpoint
CREATE TABLE comments (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  client_request_id TEXT,
  request_hash TEXT,
  revision INTEGER,
  edited_at INTEGER,
  deleted_at INTEGER,
  root_id TEXT,
  create_seq INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (root_id) REFERENCES comments(id),
  CHECK (
    (revision IS NULL AND workspace_id IS NULL AND client_request_id IS NULL
      AND request_hash IS NULL AND edited_at IS NULL AND deleted_at IS NULL
      AND root_id IS NULL AND create_seq IS NULL AND body IS NOT NULL)
    OR
    (revision >= 1 AND workspace_id IS NOT NULL AND create_seq >= 1
      AND ((client_request_id IS NULL AND request_hash IS NULL)
        OR (client_request_id IS NOT NULL AND request_hash IS NOT NULL))
      AND ((deleted_at IS NULL AND body IS NOT NULL)
        OR (deleted_at IS NOT NULL AND body IS NULL)))
  )
);
--> statement-breakpoint
INSERT INTO comments
  (id,workspace_id,task_id,user_id,body,created_at,client_request_id,request_hash,
   revision,edited_at,deleted_at,root_id,create_seq)
SELECT legacy.id,
  CASE WHEN t.workspace_id IS NOT NULL AND u.id IS NOT NULL
      AND (legacy.workspace_id IS NULL OR legacy.workspace_id=t.workspace_id)
    THEN t.workspace_id ELSE NULL END,
  legacy.task_id, legacy.user_id, legacy.body, legacy.created_at,
  NULL,NULL,
  CASE WHEN t.workspace_id IS NOT NULL AND u.id IS NOT NULL
      AND (legacy.workspace_id IS NULL OR legacy.workspace_id=t.workspace_id)
    THEN 1 ELSE NULL END,
  NULL,NULL,NULL,
  CASE WHEN t.workspace_id IS NOT NULL AND u.id IS NOT NULL
      AND (legacy.workspace_id IS NULL OR legacy.workspace_id=t.workspace_id)
    THEN ROW_NUMBER() OVER (PARTITION BY legacy.task_id ORDER BY legacy.created_at,legacy.id)
    ELSE NULL END
FROM comments_before_task_discussion legacy
LEFT JOIN tasks t ON t.id=legacy.task_id
LEFT JOIN users u ON u.id=legacy.user_id;
--> statement-breakpoint
DROP TABLE comments_before_task_discussion;
--> statement-breakpoint
CREATE INDEX idx_comments_task_id ON comments(task_id);
--> statement-breakpoint
CREATE INDEX idx_comments_user_id ON comments(user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX task_comments_request
  ON comments(task_id,user_id,client_request_id) WHERE client_request_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX task_comments_sequence
  ON comments(task_id,create_seq) WHERE create_seq IS NOT NULL;
--> statement-breakpoint
CREATE INDEX task_comments_root ON comments(task_id,root_id,create_seq);
--> statement-breakpoint

CREATE TABLE task_discussion_state (
  task_id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  audience_epoch INTEGER NOT NULL DEFAULT 1 CHECK (audience_epoch >= 1),
  next_create_seq INTEGER NOT NULL DEFAULT 1 CHECK (next_create_seq >= 1),
  next_change_seq INTEGER NOT NULL DEFAULT 1 CHECK (next_change_seq >= 1),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE task_comment_changes (
  task_id TEXT NOT NULL,
  change_seq INTEGER NOT NULL CHECK (change_seq >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('create','edit','delete','audience')),
  comment_id TEXT,
  revision INTEGER,
  audience_epoch INTEGER NOT NULL CHECK (audience_epoch >= 1),
  happened_at_ms INTEGER NOT NULL,
  PRIMARY KEY (task_id,change_seq),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CHECK ((kind='audience' AND comment_id IS NULL AND revision IS NULL)
    OR (kind<>'audience' AND comment_id IS NOT NULL AND revision IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE task_comment_receipts (
  task_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('send','edit','delete')),
  payload_hash TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  create_seq INTEGER NOT NULL,
  change_seq INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  committed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (task_id,actor_id,client_request_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE task_comment_attention (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  root_id TEXT,
  create_seq INTEGER NOT NULL CHECK (create_seq >= 1),
  reason_bits INTEGER NOT NULL CHECK (reason_bits > 0),
  seen_at_ms INTEGER,
  UNIQUE (task_id,recipient_id,comment_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX task_comment_attention_recipient
  ON task_comment_attention(recipient_id,seen_at_ms,create_seq);
--> statement-breakpoint
CREATE TABLE task_comment_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  audience_epoch INTEGER NOT NULL CHECK (audience_epoch >= 1),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','delivered','dropped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER,
  lease_until INTEGER,
  lease_token TEXT,
  last_error_code TEXT,
  created_at_ms INTEGER NOT NULL,
  UNIQUE (task_id,recipient_id,comment_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX task_comment_outbox_claim ON task_comment_outbox(state,next_attempt_at);
--> statement-breakpoint
CREATE TABLE task_comment_migration_report (
  comment_id TEXT PRIMARY KEY NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition='quarantined'),
  reason TEXT NOT NULL CHECK (reason IN ('missing_task_tenant','missing_author','tenant_mismatch')),
  recorded_at_ms INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO task_comment_migration_report(comment_id,disposition,reason,recorded_at_ms)
SELECT legacy.id,'quarantined',
  CASE WHEN t.id IS NULL OR t.workspace_id IS NULL THEN 'missing_task_tenant'
    WHEN u.id IS NULL THEN 'missing_author' ELSE 'tenant_mismatch' END,
  unixepoch()*1000
FROM comments legacy
LEFT JOIN tasks t ON t.id=legacy.task_id
LEFT JOIN users u ON u.id=legacy.user_id
WHERE legacy.revision IS NULL;
--> statement-breakpoint

INSERT INTO task_discussion_state(task_id,workspace_id,audience_epoch,next_create_seq,next_change_seq)
SELECT task_id,workspace_id,1,MAX(create_seq)+1,MAX(create_seq)+1
FROM comments WHERE revision IS NOT NULL GROUP BY task_id,workspace_id;
--> statement-breakpoint
INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
SELECT task_id,create_seq,'create',id,revision,1,created_at*1000
FROM comments WHERE revision IS NOT NULL ORDER BY task_id,create_seq;
--> statement-breakpoint

CREATE TRIGGER task_discussion_state_guard_insert
BEFORE INSERT ON task_discussion_state
WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id=NEW.task_id AND t.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'invalid_task_discussion_tenant'); END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_state_identity_immutable
BEFORE UPDATE OF task_id,workspace_id ON task_discussion_state
WHEN NEW.task_id<>OLD.task_id OR NEW.workspace_id<>OLD.workspace_id
BEGIN SELECT RAISE(ABORT,'immutable_task_discussion_identity'); END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_task_workspace_immutable
BEFORE UPDATE OF workspace_id ON tasks
WHEN NEW.workspace_id IS NOT OLD.workspace_id
  AND EXISTS (SELECT 1 FROM task_discussion_state WHERE task_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'task_discussion_workspace_immutable'); END;
--> statement-breakpoint

CREATE TRIGGER task_comments_guard_insert
BEFORE INSERT ON comments
BEGIN
  SELECT CASE WHEN NEW.workspace_id IS NULL OR NEW.client_request_id IS NULL
      OR NEW.request_hash IS NULL OR NEW.revision IS NULL OR NEW.create_seq IS NULL
    THEN RAISE(ABORT,'incomplete_task_comment') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM tasks t JOIN task_discussion_state s ON s.task_id=t.id AND s.workspace_id=t.workspace_id
    WHERE t.id=NEW.task_id AND t.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'invalid_task_comment_tenant') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id
    WHERE wm.workspace_id=NEW.workspace_id AND wm.user_id=NEW.user_id
  ) THEN RAISE(ABORT,'invalid_task_comment_author') END;
  SELECT CASE WHEN NEW.root_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM comments root WHERE root.id=NEW.root_id AND root.task_id=NEW.task_id
      AND root.workspace_id=NEW.workspace_id AND root.root_id IS NULL
      AND root.deleted_at IS NULL AND root.revision IS NOT NULL
  ) THEN RAISE(ABORT,'invalid_task_comment_root') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comments_guard_update
BEFORE UPDATE ON comments
BEGIN
  SELECT CASE WHEN OLD.revision IS NULL
    THEN RAISE(ABORT,'quarantined_task_comment') END;
  SELECT CASE WHEN OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS NOT OLD.deleted_at OR NEW.body IS NOT NULL)
    THEN RAISE(ABORT,'task_comment_tombstone_immutable') END;
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.task_id IS NOT OLD.task_id
      OR NEW.user_id IS NOT OLD.user_id OR NEW.client_request_id IS NOT OLD.client_request_id
      OR NEW.request_hash IS NOT OLD.request_hash OR NEW.root_id IS NOT OLD.root_id
      OR NEW.create_seq IS NOT OLD.create_seq OR NEW.created_at IS NOT OLD.created_at
      OR NEW.revision IS NOT OLD.revision+1
    THEN RAISE(ABORT,'invalid_task_comment_update') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id
    WHERE wm.workspace_id=OLD.workspace_id AND wm.user_id=OLD.user_id
  ) THEN RAISE(ABORT,'invalid_task_comment_author') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comment_changes_guard_insert
BEFORE INSERT ON task_comment_changes
WHEN NEW.comment_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id AND c.revision=NEW.revision
)
BEGIN SELECT RAISE(ABORT,'invalid_task_comment_change_source'); END;
--> statement-breakpoint
CREATE TRIGGER task_comment_receipts_guard_insert
BEFORE INSERT ON task_comment_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
    AND c.user_id=NEW.actor_id AND c.create_seq=NEW.create_seq AND c.revision=NEW.revision
)
BEGIN SELECT RAISE(ABORT,'invalid_task_comment_receipt_source'); END;
--> statement-breakpoint
CREATE TRIGGER task_comment_attention_guard_insert
BEFORE INSERT ON task_comment_attention
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
      AND c.workspace_id=NEW.workspace_id AND c.revision=NEW.source_revision AND c.deleted_at IS NULL
  ) THEN RAISE(ABORT,'invalid_task_comment_attention_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.recipient_id
  ) THEN RAISE(ABORT,'invalid_task_comment_attention_recipient') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comment_attention_guard_update
BEFORE UPDATE ON task_comment_attention
BEGIN
  SELECT CASE WHEN NEW.id<>OLD.id OR NEW.event_id<>OLD.event_id OR NEW.task_id<>OLD.task_id
      OR NEW.workspace_id<>OLD.workspace_id OR NEW.recipient_id<>OLD.recipient_id
      OR NEW.comment_id<>OLD.comment_id OR NEW.root_id IS NOT OLD.root_id
      OR NEW.create_seq<>OLD.create_seq
    THEN RAISE(ABORT,'immutable_task_comment_attention_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
      AND c.workspace_id=NEW.workspace_id AND c.revision=NEW.source_revision AND c.deleted_at IS NULL
  ) THEN RAISE(ABORT,'invalid_task_comment_attention_source') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comment_outbox_guard_insert
BEFORE INSERT ON task_comment_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
      AND c.workspace_id=NEW.workspace_id AND c.revision=NEW.source_revision AND c.deleted_at IS NULL
  ) THEN RAISE(ABORT,'invalid_task_comment_outbox_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.recipient_id
  ) THEN RAISE(ABORT,'invalid_task_comment_outbox_recipient') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comment_outbox_guard_update
BEFORE UPDATE ON task_comment_outbox
BEGIN
  SELECT CASE WHEN NEW.id<>OLD.id OR NEW.event_id<>OLD.event_id OR NEW.task_id<>OLD.task_id
      OR NEW.workspace_id<>OLD.workspace_id OR NEW.recipient_id<>OLD.recipient_id
      OR NEW.comment_id<>OLD.comment_id OR NEW.created_at_ms<>OLD.created_at_ms
    THEN RAISE(ABORT,'immutable_task_comment_outbox_source') END;
  SELECT CASE WHEN NEW.state<>'dropped' AND NOT EXISTS (
    SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
      AND c.workspace_id=NEW.workspace_id AND c.revision=NEW.source_revision AND c.deleted_at IS NULL
  ) THEN RAISE(ABORT,'invalid_task_comment_outbox_source') END;
END;
--> statement-breakpoint

CREATE TRIGGER task_discussion_member_insert_epoch
AFTER INSERT ON workspace_members
BEGIN
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE workspace_id=NEW.workspace_id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE workspace_id=NEW.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_member_delete_epoch
AFTER DELETE ON workspace_members
BEGIN
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE workspace_id=OLD.workspace_id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE workspace_id=OLD.workspace_id;
  DELETE FROM task_comment_attention WHERE workspace_id=OLD.workspace_id AND recipient_id=OLD.user_id;
  UPDATE task_comment_outbox SET state='dropped',lease_until=NULL,lease_token=NULL
    WHERE workspace_id=OLD.workspace_id AND recipient_id=OLD.user_id AND state IN ('pending','leased');
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_member_update_epoch
AFTER UPDATE OF workspace_id,user_id,role ON workspace_members
BEGIN
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE workspace_id=OLD.workspace_id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE workspace_id=OLD.workspace_id;
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE workspace_id=NEW.workspace_id AND NEW.workspace_id<>OLD.workspace_id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE workspace_id=NEW.workspace_id AND NEW.workspace_id<>OLD.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_workspace_archive_epoch
AFTER UPDATE OF archived_at ON workspaces
WHEN NEW.archived_at IS NOT OLD.archived_at
BEGIN
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE workspace_id=NEW.id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE workspace_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_task_archive_epoch
AFTER UPDATE OF archived_at ON tasks
WHEN NEW.archived_at IS NOT OLD.archived_at AND EXISTS (
  SELECT 1 FROM task_discussion_state WHERE task_id=NEW.id
)
BEGIN
  INSERT INTO task_comment_changes(task_id,change_seq,kind,comment_id,revision,audience_epoch,happened_at_ms)
    SELECT task_id,next_change_seq,'audience',NULL,NULL,audience_epoch+1,unixepoch()*1000
    FROM task_discussion_state WHERE task_id=NEW.id;
  UPDATE task_discussion_state SET audience_epoch=audience_epoch+1,next_change_seq=next_change_seq+1
    WHERE task_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_task_delete_cleanup
BEFORE DELETE ON tasks
BEGIN
  DELETE FROM task_comment_outbox WHERE task_id=OLD.id;
  DELETE FROM task_comment_attention WHERE task_id=OLD.id;
  DELETE FROM task_comment_receipts WHERE task_id=OLD.id;
  DELETE FROM task_comment_changes WHERE task_id=OLD.id;
  DELETE FROM task_discussion_state WHERE task_id=OLD.id;
  DELETE FROM comments WHERE task_id=OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER task_discussion_workspace_delete_cleanup
BEFORE DELETE ON workspaces
BEGIN
  DELETE FROM task_comment_outbox WHERE workspace_id=OLD.id;
  DELETE FROM task_comment_attention WHERE workspace_id=OLD.id;
  DELETE FROM task_comment_receipts WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id=OLD.id);
  DELETE FROM task_comment_changes WHERE task_id IN (SELECT id FROM tasks WHERE workspace_id=OLD.id);
  DELETE FROM task_discussion_state WHERE workspace_id=OLD.id;
  DELETE FROM comments WHERE workspace_id=OLD.id;
END;

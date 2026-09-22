DROP TRIGGER conversation_attention_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_changes_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_dm_membership_delete;
--> statement-breakpoint
DROP TRIGGER conversation_dm_membership_insert;
--> statement-breakpoint
DROP TRIGGER conversation_dm_membership_key_immutable;
--> statement-breakpoint
DROP TRIGGER conversation_dm_metadata_guard;
--> statement-breakpoint
DROP TRIGGER conversation_dm_receipts_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_dm_user_id_immutable;
--> statement-breakpoint
DROP TRIGGER conversation_messages_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_messages_guard_update;
--> statement-breakpoint
DROP TRIGGER conversation_outbox_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_participants_epoch;
--> statement-breakpoint
DROP TRIGGER conversation_participants_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversation_receipts_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversations_guard_insert;
--> statement-breakpoint
DROP TRIGGER conversations_identity_immutable;
--> statement-breakpoint
DROP TRIGGER conversations_membership_delete_epoch;
--> statement-breakpoint
DROP TRIGGER conversations_membership_insert_epoch;
--> statement-breakpoint
DROP TRIGGER conversations_membership_update_epoch;
--> statement-breakpoint
DROP TRIGGER conversations_pair_state_epoch;
--> statement-breakpoint
DROP TRIGGER conversations_user_membership_cleanup;
--> statement-breakpoint
DROP TRIGGER conversations_workspace_archive_epoch;
--> statement-breakpoint
DROP TRIGGER conversations_workspace_cleanup;
--> statement-breakpoint
DROP TRIGGER task_comment_attention_guard_insert;
--> statement-breakpoint
DROP TRIGGER task_comment_attention_guard_update;
--> statement-breakpoint
DROP TRIGGER task_comment_changes_guard_insert;
--> statement-breakpoint
DROP TRIGGER task_comment_outbox_guard_insert;
--> statement-breakpoint
DROP TRIGGER task_comment_outbox_guard_update;
--> statement-breakpoint
DROP TRIGGER task_comment_receipts_guard_insert;
--> statement-breakpoint
DROP TRIGGER task_comments_guard_insert;
--> statement-breakpoint
DROP TRIGGER task_comments_guard_update;
--> statement-breakpoint
DROP TRIGGER task_discussion_task_delete_cleanup;
--> statement-breakpoint
DROP TRIGGER task_discussion_workspace_delete_cleanup;
--> statement-breakpoint
DROP TRIGGER work_links_guard_insert;
--> statement-breakpoint
CREATE TABLE conversations_erasure (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('project', 'dm')),
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'archived')),
  audience_epoch INTEGER NOT NULL DEFAULT 1 CHECK (audience_epoch >= 1),
  next_create_seq INTEGER NOT NULL DEFAULT 1 CHECK (next_create_seq >= 1),
  next_change_seq INTEGER NOT NULL DEFAULT 1 CHECK (next_change_seq >= 1),
  dm_low_user_id TEXT,
  dm_high_user_id TEXT,
  pair_state TEXT CHECK (pair_state IN ('pending', 'active', 'declined', 'blocked', 'left', 'membership_lost', 'rejoin_pending')),
  dm_requester_id TEXT,
  dm_blocked_by_user_id TEXT,
  dm_state_before_block TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  CHECK (kind='project' OR created_by IS NOT NULL),
  CHECK (
    (kind = 'project' AND dm_low_user_id IS NULL AND dm_high_user_id IS NULL AND pair_state IS NULL)
    OR
    (kind = 'dm' AND dm_low_user_id IS NOT NULL AND dm_high_user_id IS NOT NULL
      AND dm_low_user_id < dm_high_user_id AND pair_state IS NOT NULL)
  )
);
--> statement-breakpoint
INSERT INTO conversations_erasure SELECT id,workspace_id,kind,lifecycle,audience_epoch,next_create_seq,next_change_seq,dm_low_user_id,dm_high_user_id,pair_state,dm_requester_id,dm_blocked_by_user_id,dm_state_before_block,created_by,created_at FROM conversations;
--> statement-breakpoint
DROP TABLE conversations;
--> statement-breakpoint
ALTER TABLE conversations_erasure RENAME TO conversations;
--> statement-breakpoint
CREATE TABLE conversation_messages_erasure (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  author_id TEXT,
  client_request_id TEXT,
  request_hash TEXT,
  root_id TEXT,
  create_seq INTEGER NOT NULL CHECK (create_seq >= 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  body TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (root_id) REFERENCES conversation_messages(id),
  CHECK ((deleted_at IS NULL AND body IS NOT NULL) OR (deleted_at IS NOT NULL AND body IS NULL)),
  CHECK (author_id IS NOT NULL OR (body IS NULL AND deleted_at IS NOT NULL AND client_request_id IS NULL AND request_hash IS NULL))
);
--> statement-breakpoint
INSERT INTO conversation_messages_erasure SELECT id,conversation_id,workspace_id,author_id,client_request_id,request_hash,root_id,create_seq,revision,body,created_at,edited_at,deleted_at FROM conversation_messages;
--> statement-breakpoint
DROP TABLE conversation_messages;
--> statement-breakpoint
ALTER TABLE conversation_messages_erasure RENAME TO conversation_messages;
--> statement-breakpoint
CREATE TABLE comments_erasure (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT,
  task_id TEXT NOT NULL,
  user_id TEXT,
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
    (revision IS NULL AND user_id IS NOT NULL AND workspace_id IS NULL AND client_request_id IS NULL
      AND request_hash IS NULL AND edited_at IS NULL AND deleted_at IS NULL
      AND root_id IS NULL AND create_seq IS NULL AND body IS NOT NULL)
    OR
    (revision >= 1 AND workspace_id IS NOT NULL AND create_seq >= 1
      AND ((client_request_id IS NULL AND request_hash IS NULL)
        OR (client_request_id IS NOT NULL AND request_hash IS NOT NULL))
      AND (user_id IS NOT NULL OR (body IS NULL AND deleted_at IS NOT NULL AND client_request_id IS NULL AND request_hash IS NULL))
      AND ((deleted_at IS NULL AND body IS NOT NULL)
        OR (deleted_at IS NOT NULL AND body IS NULL)))
  )
);
--> statement-breakpoint
INSERT INTO comments_erasure SELECT id,workspace_id,task_id,user_id,body,created_at,client_request_id,request_hash,revision,edited_at,deleted_at,root_id,create_seq FROM comments;
--> statement-breakpoint
DROP TABLE comments;
--> statement-breakpoint
ALTER TABLE comments_erasure RENAME TO comments;
--> statement-breakpoint
CREATE UNIQUE INDEX conversations_one_project_room
  ON conversations(workspace_id) WHERE kind = 'project';
--> statement-breakpoint
CREATE UNIQUE INDEX conversations_one_dm_pair
  ON conversations(workspace_id, dm_low_user_id, dm_high_user_id) WHERE kind = 'dm';
--> statement-breakpoint
CREATE UNIQUE INDEX conversation_messages_request
  ON conversation_messages(conversation_id, author_id, client_request_id);
--> statement-breakpoint
CREATE UNIQUE INDEX conversation_messages_sequence
  ON conversation_messages(conversation_id, create_seq);
--> statement-breakpoint
CREATE INDEX conversation_messages_root ON conversation_messages(conversation_id, root_id, create_seq);
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
CREATE TRIGGER conversation_attention_guard_insert
BEFORE INSERT ON conversation_attention
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM conversation_messages m WHERE m.id=NEW.message_id AND m.conversation_id=NEW.conversation_id AND m.workspace_id=NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_attention_source') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=NEW.workspace_id AND wm.user_id=NEW.recipient_id)
    THEN RAISE(ABORT, 'invalid_attention_recipient') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.id=NEW.conversation_id AND c.kind='dm' AND
    (c.pair_state<>'active' OR NEW.recipient_id NOT IN (c.dm_low_user_id,c.dm_high_user_id) OR NOT EXISTS
      (SELECT 1 FROM conversation_participants p WHERE p.conversation_id=c.id AND p.user_id=NEW.recipient_id AND p.status='active' AND p.consented=1)))
    THEN RAISE(ABORT, 'invalid_dm_attention_recipient') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_changes_guard_insert
BEFORE INSERT ON conversation_changes
WHEN NEW.message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM conversation_messages m
  WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.revision = NEW.revision
)
BEGIN SELECT RAISE(ABORT, 'invalid_change_source'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_membership_delete
AFTER DELETE ON workspace_members
BEGIN
  UPDATE conversation_participants SET status='membership_lost',consented=0,retains_history=0,reopen_confirmed=0
    WHERE user_id=OLD.user_id AND status<>'removed'
      AND conversation_id IN (SELECT id FROM conversations WHERE kind='dm' AND workspace_id=OLD.workspace_id);
  UPDATE conversation_participants SET reopen_confirmed=0
    WHERE conversation_id IN (SELECT id FROM conversations WHERE kind='dm' AND workspace_id=OLD.workspace_id AND OLD.user_id IN(dm_low_user_id,dm_high_user_id));
  UPDATE conversations SET pair_state='membership_lost',dm_blocked_by_user_id=NULL,dm_state_before_block=NULL
    WHERE kind='dm' AND workspace_id=OLD.workspace_id AND OLD.user_id IN(dm_low_user_id,dm_high_user_id) AND pair_state NOT IN('blocked','left');
END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_membership_insert
AFTER INSERT ON workspace_members
BEGIN
  UPDATE conversation_participants SET status='rejoin_pending',consented=0,retains_history=0,reopen_confirmed=0
    WHERE user_id=NEW.user_id AND status='membership_lost' AND conversation_id IN (SELECT id FROM conversations WHERE kind='dm' AND workspace_id=NEW.workspace_id);
  UPDATE conversation_participants SET reopen_confirmed=0
    WHERE conversation_id IN (SELECT id FROM conversations WHERE kind='dm' AND workspace_id=NEW.workspace_id AND NEW.user_id IN(dm_low_user_id,dm_high_user_id));
  UPDATE conversations SET pair_state='rejoin_pending'
    WHERE kind='dm' AND workspace_id=NEW.workspace_id AND NEW.user_id IN(dm_low_user_id,dm_high_user_id) AND pair_state='membership_lost';
END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_membership_key_immutable
BEFORE UPDATE OF workspace_id, user_id ON workspace_members
WHEN (NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id) AND (
  EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND c.workspace_id=OLD.workspace_id AND OLD.user_id IN(c.dm_low_user_id,c.dm_high_user_id))
  OR EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND c.workspace_id=NEW.workspace_id AND NEW.user_id IN(c.dm_low_user_id,c.dm_high_user_id)))
BEGIN SELECT RAISE(ABORT, 'dm_membership_key_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_metadata_guard
BEFORE UPDATE OF dm_requester_id, dm_blocked_by_user_id, dm_state_before_block, pair_state ON conversations
WHEN OLD.kind = 'dm'
BEGIN
  SELECT CASE WHEN NEW.dm_requester_id IS NULL OR NEW.dm_requester_id NOT IN (NEW.dm_low_user_id, NEW.dm_high_user_id)
    THEN RAISE(ABORT, 'invalid_dm_requester') END;
  SELECT CASE WHEN NEW.pair_state = 'blocked' AND (
    NEW.dm_blocked_by_user_id IS NULL OR NEW.dm_blocked_by_user_id NOT IN (NEW.dm_low_user_id, NEW.dm_high_user_id)
    OR NEW.dm_state_before_block IS NULL OR NEW.dm_state_before_block = 'blocked'
  ) THEN RAISE(ABORT, 'invalid_dm_block') END;
  SELECT CASE WHEN NEW.pair_state <> 'blocked' AND (NEW.dm_blocked_by_user_id IS NOT NULL OR NEW.dm_state_before_block IS NOT NULL)
    THEN RAISE(ABORT, 'stale_dm_block') END;
  SELECT CASE WHEN NEW.pair_state = 'active' AND (
    (SELECT COUNT(*) FROM conversation_participants p JOIN workspace_members wm
      ON wm.workspace_id = NEW.workspace_id AND wm.user_id = p.user_id JOIN users u ON u.id = p.user_id
      WHERE p.conversation_id = NEW.id AND p.user_id IN (NEW.dm_low_user_id, NEW.dm_high_user_id)
        AND p.status = 'active' AND p.consented = 1 AND p.retains_history = 1) <> 2
  ) THEN RAISE(ABORT, 'dm_consent_required') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_receipts_guard_insert
BEFORE INSERT ON conversation_dm_receipts
WHEN NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id=NEW.conversation_id AND c.kind='dm'
  AND NEW.actor_id IN (c.dm_low_user_id,c.dm_high_user_id) AND c.pair_state=NEW.resulting_state)
BEGIN SELECT RAISE(ABORT, 'invalid_dm_receipt'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_user_id_immutable
BEFORE UPDATE OF id ON users
WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND OLD.id IN(c.dm_low_user_id,c.dm_high_user_id))
BEGIN SELECT RAISE(ABORT, 'dm_user_id_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_messages_guard_insert
BEFORE INSERT ON conversation_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = NEW.conversation_id AND c.workspace_id = NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_message_tenant') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspace_members wm JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = NEW.workspace_id AND wm.user_id = NEW.author_id)
    THEN RAISE(ABORT, 'invalid_message_author') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.id = NEW.conversation_id AND c.kind = 'dm' AND
    (c.pair_state <> 'active' OR NEW.author_id NOT IN (c.dm_low_user_id, c.dm_high_user_id)
      OR (SELECT COUNT(*) FROM conversation_participants p JOIN workspace_members wm ON wm.workspace_id=c.workspace_id AND wm.user_id=p.user_id
          JOIN users u ON u.id=p.user_id WHERE p.conversation_id=c.id AND p.status='active' AND p.consented=1 AND p.retains_history=1) <> 2))
    THEN RAISE(ABORT, 'invalid_dm_author') END;
  SELECT CASE WHEN NEW.root_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM conversation_messages root
    WHERE root.id=NEW.root_id AND root.conversation_id=NEW.conversation_id AND root.workspace_id=NEW.workspace_id AND root.root_id IS NULL)
    THEN RAISE(ABORT, 'invalid_message_root') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_outbox_guard_insert
BEFORE INSERT ON conversation_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM conversation_messages m WHERE m.id=NEW.message_id AND m.conversation_id=NEW.conversation_id AND m.workspace_id=NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_outbox_source') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=NEW.workspace_id AND wm.user_id=NEW.recipient_id)
    THEN RAISE(ABORT, 'invalid_outbox_recipient') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.id=NEW.conversation_id AND c.kind='dm' AND
    (c.pair_state<>'active' OR NEW.recipient_id NOT IN (c.dm_low_user_id,c.dm_high_user_id) OR NOT EXISTS
      (SELECT 1 FROM conversation_participants p WHERE p.conversation_id=c.id AND p.user_id=NEW.recipient_id AND p.status='active' AND p.consented=1)))
    THEN RAISE(ABORT, 'invalid_dm_outbox_recipient') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_participants_epoch
AFTER UPDATE OF status, consented, retains_history, reopen_confirmed ON conversation_participants
WHEN NEW.status IS NOT OLD.status OR NEW.consented <> OLD.consented OR NEW.retains_history <> OLD.retains_history OR NEW.reopen_confirmed <> OLD.reopen_confirmed
BEGIN
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1 WHERE id = NEW.conversation_id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000 FROM conversations WHERE id = NEW.conversation_id;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_participants_guard_insert
BEFORE INSERT ON conversation_participants
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversations c JOIN users u ON u.id = NEW.user_id
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id AND wm.user_id = NEW.user_id
    WHERE c.id = NEW.conversation_id AND c.kind = 'dm' AND NEW.user_id IN (c.dm_low_user_id, c.dm_high_user_id)
  ) THEN RAISE(ABORT, 'invalid_dm_participant') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_receipts_guard_insert
BEFORE INSERT ON conversation_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM conversation_messages m
  WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id
    AND m.author_id = NEW.actor_id AND m.create_seq = NEW.create_seq AND m.revision = NEW.revision
)
BEGIN SELECT RAISE(ABORT, 'invalid_receipt_source'); END;
--> statement-breakpoint
CREATE TRIGGER conversations_guard_insert
BEFORE INSERT ON conversations
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_conversation_workspace') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by)
    THEN RAISE(ABORT, 'invalid_conversation_creator') END;
  SELECT CASE WHEN NEW.kind = 'dm' AND (
    NEW.dm_requester_id IS NULL OR NEW.dm_requester_id <> NEW.created_by
    OR NEW.dm_requester_id NOT IN (NEW.dm_low_user_id, NEW.dm_high_user_id)
    OR NEW.pair_state <> 'pending'
    OR NEW.dm_blocked_by_user_id IS NOT NULL OR NEW.dm_state_before_block IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.dm_low_user_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.dm_high_user_id)
    OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.dm_low_user_id)
    OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.dm_high_user_id)
  ) THEN RAISE(ABORT, 'invalid_dm_pair') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_identity_immutable
BEFORE UPDATE OF id, workspace_id, kind, dm_low_user_id, dm_high_user_id ON conversations
WHEN NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.kind <> OLD.kind
  OR NEW.dm_low_user_id IS NOT OLD.dm_low_user_id OR NEW.dm_high_user_id IS NOT OLD.dm_high_user_id
BEGIN SELECT RAISE(ABORT, 'immutable_conversation_identity'); END;
--> statement-breakpoint
CREATE TRIGGER conversations_membership_delete_epoch
AFTER DELETE ON workspace_members
BEGIN
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = OLD.workspace_id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversations WHERE workspace_id = OLD.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_membership_insert_epoch
AFTER INSERT ON workspace_members
BEGIN
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.workspace_id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversations WHERE workspace_id = NEW.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_membership_update_epoch
AFTER UPDATE OF role, workspace_id, user_id ON workspace_members
BEGIN
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = OLD.workspace_id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversations WHERE workspace_id = OLD.workspace_id;
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.workspace_id AND NEW.workspace_id <> OLD.workspace_id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversations WHERE workspace_id = NEW.workspace_id AND NEW.workspace_id <> OLD.workspace_id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_pair_state_epoch
AFTER UPDATE OF pair_state, dm_blocked_by_user_id ON conversations
WHEN NEW.pair_state IS NOT OLD.pair_state OR NEW.dm_blocked_by_user_id IS NOT OLD.dm_blocked_by_user_id
BEGIN
  UPDATE conversation_outbox SET state='dropped',lease_until=NULL,lease_token=NULL
    WHERE conversation_id=NEW.id AND NEW.pair_state<>'active' AND state IN('pending','leased');
  UPDATE conversations SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1 WHERE id = NEW.id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000 FROM conversations WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_user_membership_cleanup
BEFORE DELETE ON users
BEGIN
  DELETE FROM workspace_members WHERE user_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_workspace_archive_epoch
AFTER UPDATE OF archived_at ON workspaces
WHEN NEW.archived_at IS NOT OLD.archived_at
BEGIN
  UPDATE conversations SET lifecycle = CASE WHEN NEW.archived_at IS NULL THEN 'active' ELSE 'archived' END,
    audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.id;
  INSERT INTO conversation_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversations WHERE workspace_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER conversations_workspace_cleanup
BEFORE DELETE ON workspaces
BEGIN
  DELETE FROM conversation_attention WHERE workspace_id = OLD.id;
  DELETE FROM conversation_outbox WHERE workspace_id = OLD.id;
  DELETE FROM conversation_receipts WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversation_changes WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversation_messages WHERE workspace_id = OLD.id;
  DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversations WHERE workspace_id = OLD.id;
END;
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
CREATE TRIGGER task_comment_changes_guard_insert
BEFORE INSERT ON task_comment_changes
WHEN NEW.comment_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id AND c.revision=NEW.revision
)
BEGIN SELECT RAISE(ABORT,'invalid_task_comment_change_source'); END;
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
CREATE TRIGGER task_comment_receipts_guard_insert
BEFORE INSERT ON task_comment_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM comments c WHERE c.id=NEW.comment_id AND c.task_id=NEW.task_id
    AND c.user_id=NEW.actor_id AND c.create_seq=NEW.create_seq AND c.revision=NEW.revision
)
BEGIN SELECT RAISE(ABORT,'invalid_task_comment_receipt_source'); END;
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
CREATE TRIGGER conversations_creator_erasure_guard
BEFORE UPDATE OF created_by ON conversations
WHEN NEW.created_by IS NOT OLD.created_by
BEGIN
  SELECT CASE WHEN NOT (OLD.kind='project' AND OLD.created_by IS NOT NULL
    AND NEW.created_by IS NULL AND EXISTS (SELECT 1 FROM meta
      WHERE key='google-drive:account-erasure:user:'||OLD.created_by AND value='active:v1'))
    THEN RAISE(ABORT,'invalid_conversation_creator_update') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_messages_guard_update
BEFORE UPDATE ON conversation_messages
BEGIN
  SELECT CASE WHEN OLD.deleted_at IS NOT NULL AND NOT (
    OLD.author_id IS NOT NULL AND NEW.author_id IS NULL AND NEW.body IS NULL
    AND NEW.client_request_id IS NULL AND NEW.request_hash IS NULL
    AND EXISTS (SELECT 1 FROM meta WHERE key='google-drive:account-erasure:user:'||OLD.author_id AND value='active:v1'))
    THEN RAISE(ABORT,'message_tombstone_immutable') END;
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.conversation_id IS NOT OLD.conversation_id
    OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.root_id IS NOT OLD.root_id
    OR NEW.create_seq IS NOT OLD.create_seq OR NEW.created_at IS NOT OLD.created_at
    OR NEW.revision IS NOT OLD.revision+1 OR NOT (
      (OLD.author_id IS NOT NULL AND NEW.author_id IS OLD.author_id
        AND NEW.client_request_id IS OLD.client_request_id AND NEW.request_hash IS OLD.request_hash)
      OR (OLD.author_id IS NOT NULL AND NEW.author_id IS NULL AND NEW.body IS NULL
        AND NEW.deleted_at IS NOT NULL AND NEW.client_request_id IS NULL AND NEW.request_hash IS NULL
        AND EXISTS (SELECT 1 FROM meta WHERE key='google-drive:account-erasure:user:'||OLD.author_id AND value='active:v1')))
    THEN RAISE(ABORT,'invalid_message_update') END;
END;
--> statement-breakpoint
CREATE TRIGGER task_comments_guard_update
BEFORE UPDATE ON comments
BEGIN
  SELECT CASE WHEN OLD.revision IS NULL THEN RAISE(ABORT,'quarantined_task_comment') END;
  SELECT CASE WHEN OLD.deleted_at IS NOT NULL AND NOT (
    OLD.user_id IS NOT NULL AND NEW.user_id IS NULL AND NEW.body IS NULL
    AND NEW.client_request_id IS NULL AND NEW.request_hash IS NULL
    AND EXISTS (SELECT 1 FROM meta WHERE key='google-drive:account-erasure:user:'||OLD.user_id AND value='active:v1'))
    THEN RAISE(ABORT,'task_comment_tombstone_immutable') END;
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id
    OR NEW.task_id IS NOT OLD.task_id OR NEW.root_id IS NOT OLD.root_id
    OR NEW.create_seq IS NOT OLD.create_seq OR NEW.created_at IS NOT OLD.created_at
    OR NEW.revision IS NOT OLD.revision+1 OR NOT (
      (OLD.user_id IS NOT NULL AND NEW.user_id IS OLD.user_id
        AND NEW.client_request_id IS OLD.client_request_id AND NEW.request_hash IS OLD.request_hash
        AND EXISTS (SELECT 1 FROM workspace_members wm JOIN users u ON u.id=wm.user_id
          WHERE wm.workspace_id=OLD.workspace_id AND wm.user_id=OLD.user_id))
      OR (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL AND NEW.body IS NULL
        AND NEW.deleted_at IS NOT NULL AND NEW.client_request_id IS NULL AND NEW.request_hash IS NULL
        AND EXISTS (SELECT 1 FROM meta WHERE key='google-drive:account-erasure:user:'||OLD.user_id AND value='active:v1')))
    THEN RAISE(ABORT,'invalid_task_comment_update') END;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_room_delete_cleanup
BEFORE DELETE ON conversations
BEGIN
  DELETE FROM suite_outbox WHERE type='task.created' AND
    CASE WHEN json_valid(object_ref) THEN json_extract(object_ref,'$.workLinkId') END IN
      (SELECT id FROM work_links WHERE source_conversation_id=OLD.id);
  DELETE FROM work_operation_receipts WHERE source_conversation_id=OLD.id OR work_link_id IN
    (SELECT id FROM work_links WHERE source_conversation_id=OLD.id);
  DELETE FROM work_links WHERE source_conversation_id=OLD.id;
  DELETE FROM conversation_dm_receipts WHERE conversation_id=OLD.id;
  DELETE FROM conversation_outbox WHERE conversation_id=OLD.id;
  DELETE FROM conversation_attention WHERE conversation_id=OLD.id;
  DELETE FROM conversation_receipts WHERE conversation_id=OLD.id;
  DELETE FROM conversation_changes WHERE conversation_id=OLD.id;
  DELETE FROM conversation_messages WHERE conversation_id=OLD.id;
  DELETE FROM conversation_participants WHERE conversation_id=OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER conversation_task_delete_cleanup
BEFORE DELETE ON tasks
BEGIN
  DELETE FROM work_links WHERE task_id=OLD.id;
  DELETE FROM task_comment_migration_report WHERE comment_id IN
    (SELECT id FROM comments WHERE task_id=OLD.id);
END;
--> statement-breakpoint
CREATE TRIGGER conversation_workspace_work_cleanup
BEFORE DELETE ON workspaces
BEGIN
  DELETE FROM suite_outbox WHERE type='task.created' AND
    CASE WHEN json_valid(object_ref) THEN json_extract(object_ref,'$.workLinkId') END IN
      (SELECT id FROM work_links WHERE source_project_id=OLD.id OR destination_project_id=OLD.id);
  DELETE FROM work_operation_receipts WHERE source_project_id=OLD.id OR destination_project_id=OLD.id
    OR work_link_id IN (SELECT id FROM work_links WHERE source_project_id=OLD.id OR destination_project_id=OLD.id);
  DELETE FROM work_links WHERE source_project_id=OLD.id OR destination_project_id=OLD.id;
  DELETE FROM task_comment_migration_report WHERE comment_id IN
    (SELECT c.id FROM comments c JOIN tasks t ON t.id=c.task_id WHERE t.workspace_id=OLD.id);
END;

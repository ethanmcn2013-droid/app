CREATE TABLE conversations (
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
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  CHECK (
    (kind = 'project' AND dm_low_user_id IS NULL AND dm_high_user_id IS NULL AND pair_state IS NULL)
    OR
    (kind = 'dm' AND dm_low_user_id IS NOT NULL AND dm_high_user_id IS NOT NULL
      AND dm_low_user_id < dm_high_user_id AND pair_state IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX conversations_one_project_room
  ON conversations(workspace_id) WHERE kind = 'project';
--> statement-breakpoint
CREATE UNIQUE INDEX conversations_one_dm_pair
  ON conversations(workspace_id, dm_low_user_id, dm_high_user_id) WHERE kind = 'dm';
--> statement-breakpoint

CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'removed', 'membership_lost', 'rejoin_pending')),
  consented INTEGER NOT NULL DEFAULT 0 CHECK (consented IN (0, 1)),
  retains_history INTEGER NOT NULL DEFAULT 0 CHECK (retains_history IN (0, 1)),
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
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
  CHECK ((deleted_at IS NULL AND body IS NOT NULL) OR (deleted_at IS NOT NULL AND body IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX conversation_messages_request
  ON conversation_messages(conversation_id, author_id, client_request_id);
--> statement-breakpoint
CREATE UNIQUE INDEX conversation_messages_sequence
  ON conversation_messages(conversation_id, create_seq);
--> statement-breakpoint
CREATE INDEX conversation_messages_root ON conversation_messages(conversation_id, root_id, create_seq);
--> statement-breakpoint

CREATE TABLE conversation_changes (
  conversation_id TEXT NOT NULL,
  change_seq INTEGER NOT NULL CHECK (change_seq >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('create', 'edit', 'delete', 'audience')),
  message_id TEXT,
  revision INTEGER,
  audience_epoch INTEGER NOT NULL CHECK (audience_epoch >= 1),
  happened_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, change_seq),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CHECK (
    (kind = 'audience' AND message_id IS NULL AND revision IS NULL)
    OR
    (kind <> 'audience' AND message_id IS NOT NULL AND revision IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE TABLE conversation_receipts (
  conversation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('send', 'edit', 'delete')),
  payload_hash TEXT NOT NULL,
  message_id TEXT NOT NULL,
  create_seq INTEGER NOT NULL,
  change_seq INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  committed_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, actor_id, client_request_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES conversation_messages(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE conversation_attention (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  root_id TEXT,
  create_seq INTEGER NOT NULL,
  reason_bits INTEGER NOT NULL DEFAULT 1,
  observed_at INTEGER,
  UNIQUE (conversation_id, recipient_id, message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX conversation_attention_recipient ON conversation_attention(recipient_id, observed_at, create_seq);
--> statement-breakpoint

CREATE TABLE conversation_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL DEFAULT 1,
  audience_epoch INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'delivered', 'dropped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  lease_until INTEGER,
  lease_token TEXT,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (conversation_id, recipient_id, message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX conversation_outbox_claim ON conversation_outbox(state, next_attempt_at);
--> statement-breakpoint

CREATE TRIGGER conversations_guard_insert
BEFORE INSERT ON conversations
BEGIN
  SELECT CASE WHEN NEW.kind <> 'project'
    THEN RAISE(ABORT, 'conversation_kind_not_enabled') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_conversation_workspace') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by)
    THEN RAISE(ABORT, 'invalid_conversation_creator') END;
END;
--> statement-breakpoint

CREATE TRIGGER conversations_identity_immutable
BEFORE UPDATE OF id, workspace_id, kind, dm_low_user_id, dm_high_user_id ON conversations
WHEN NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.kind <> OLD.kind
  OR NEW.dm_low_user_id IS NOT OLD.dm_low_user_id OR NEW.dm_high_user_id IS NOT OLD.dm_high_user_id
BEGIN SELECT RAISE(ABORT, 'immutable_conversation_identity'); END;
--> statement-breakpoint

CREATE TRIGGER conversation_messages_guard_insert
BEFORE INSERT ON conversation_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = NEW.conversation_id AND c.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_message_tenant') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.author_id
  ) THEN RAISE(ABORT, 'invalid_message_author') END;
  SELECT CASE WHEN NEW.root_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM conversation_messages root
    WHERE root.id = NEW.root_id AND root.conversation_id = NEW.conversation_id
      AND root.workspace_id = NEW.workspace_id AND root.root_id IS NULL
  ) THEN RAISE(ABORT, 'invalid_message_root') END;
END;
--> statement-breakpoint

CREATE TRIGGER conversation_messages_guard_update
BEFORE UPDATE ON conversation_messages
WHEN NEW.id <> OLD.id OR NEW.conversation_id <> OLD.conversation_id OR NEW.workspace_id <> OLD.workspace_id
  OR NEW.author_id <> OLD.author_id OR NEW.client_request_id <> OLD.client_request_id
  OR NEW.request_hash <> OLD.request_hash OR NEW.root_id IS NOT OLD.root_id
  OR NEW.create_seq <> OLD.create_seq OR NEW.revision <> OLD.revision + 1
BEGIN SELECT RAISE(ABORT, 'invalid_message_update'); END;
--> statement-breakpoint

CREATE TRIGGER conversation_changes_guard_insert
BEFORE INSERT ON conversation_changes
WHEN NEW.message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM conversation_messages m
  WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.revision = NEW.revision
)
BEGIN SELECT RAISE(ABORT, 'invalid_change_source'); END;
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

CREATE TRIGGER conversation_attention_guard_insert
BEFORE INSERT ON conversation_attention
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_messages m
    WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_attention_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.recipient_id
  ) THEN RAISE(ABORT, 'invalid_attention_recipient') END;
END;
--> statement-breakpoint

CREATE TRIGGER conversation_outbox_guard_insert
BEFORE INSERT ON conversation_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_messages m
    WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_outbox_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.recipient_id
  ) THEN RAISE(ABORT, 'invalid_outbox_recipient') END;
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

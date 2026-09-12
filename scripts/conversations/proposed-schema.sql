-- PC-04 EX-01 only. This schema is deliberately outside the active Drizzle ledger.
-- It is installed only in disposable, synthetic file databases.

CREATE TABLE conversation_spike_conversations (
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
  CHECK (
    (kind = 'project' AND dm_low_user_id IS NULL AND dm_high_user_id IS NULL AND pair_state IS NULL)
    OR
    (kind = 'dm' AND dm_low_user_id IS NOT NULL AND dm_high_user_id IS NOT NULL
      AND dm_low_user_id < dm_high_user_id AND pair_state IS NOT NULL)
  )
);
CREATE UNIQUE INDEX conversation_spike_one_project_room
  ON conversation_spike_conversations(workspace_id) WHERE kind = 'project';
CREATE UNIQUE INDEX conversation_spike_one_dm_pair
  ON conversation_spike_conversations(workspace_id, dm_low_user_id, dm_high_user_id) WHERE kind = 'dm';

CREATE TABLE conversation_spike_participants (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'removed', 'membership_lost', 'rejoin_pending')),
  consented INTEGER NOT NULL DEFAULT 0 CHECK (consented IN (0, 1)),
  retains_history INTEGER NOT NULL DEFAULT 0 CHECK (retains_history IN (0, 1)),
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE conversation_spike_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  root_id TEXT,
  create_seq INTEGER NOT NULL CHECK (create_seq >= 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  body TEXT,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  UNIQUE (conversation_id, create_seq),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (root_id) REFERENCES conversation_spike_messages(id),
  CHECK ((deleted_at IS NULL AND body IS NOT NULL) OR (deleted_at IS NOT NULL AND body IS NULL))
);

CREATE TABLE conversation_spike_changes (
  conversation_id TEXT NOT NULL,
  change_seq INTEGER NOT NULL CHECK (change_seq >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('create', 'edit', 'delete', 'audience')),
  message_id TEXT,
  revision INTEGER,
  audience_epoch INTEGER NOT NULL CHECK (audience_epoch >= 1),
  happened_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, change_seq),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE,
  CHECK (
    (kind = 'audience' AND message_id IS NULL AND revision IS NULL)
    OR
    (kind <> 'audience' AND message_id IS NOT NULL AND revision IS NOT NULL)
  )
);

CREATE TABLE conversation_spike_receipts (
  conversation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  message_id TEXT NOT NULL,
  create_seq INTEGER NOT NULL,
  change_seq INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  committed_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, actor_id, client_request_id),
  UNIQUE (message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES conversation_spike_messages(id) ON DELETE CASCADE
);

CREATE TABLE conversation_spike_attention (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  root_id TEXT,
  create_seq INTEGER NOT NULL,
  observed_at INTEGER,
  UNIQUE (conversation_id, recipient_id, message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE
);

CREATE TABLE conversation_spike_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'delivered', 'dropped')),
  created_at INTEGER NOT NULL,
  UNIQUE (conversation_id, recipient_id, message_id),
  FOREIGN KEY (conversation_id) REFERENCES conversation_spike_conversations(id) ON DELETE CASCADE
);

CREATE TRIGGER conversation_spike_conversation_guard_insert
BEFORE INSERT ON conversation_spike_conversations
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id)
    THEN RAISE(ABORT, 'invalid_conversation_workspace') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by)
    THEN RAISE(ABORT, 'invalid_conversation_creator') END;
  SELECT CASE WHEN NEW.kind = 'dm' AND (
    NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.dm_low_user_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.dm_high_user_id)
    OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.dm_low_user_id)
    OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.dm_high_user_id)
  ) THEN RAISE(ABORT, 'invalid_dm_pair') END;
END;

CREATE TRIGGER conversation_spike_conversation_identity_immutable
BEFORE UPDATE OF id, workspace_id, kind, dm_low_user_id, dm_high_user_id ON conversation_spike_conversations
WHEN NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.kind <> OLD.kind
  OR NEW.dm_low_user_id IS NOT OLD.dm_low_user_id OR NEW.dm_high_user_id IS NOT OLD.dm_high_user_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_conversation_identity');
END;

CREATE TRIGGER conversation_spike_participant_guard_insert
BEFORE INSERT ON conversation_spike_participants
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_spike_conversations c
    WHERE c.id = NEW.conversation_id AND c.kind = 'dm'
      AND NEW.user_id IN (c.dm_low_user_id, c.dm_high_user_id)
  ) THEN RAISE(ABORT, 'invalid_dm_participant') END;
END;

CREATE TRIGGER conversation_spike_participant_identity_immutable
BEFORE UPDATE OF conversation_id, user_id ON conversation_spike_participants
WHEN NEW.conversation_id <> OLD.conversation_id OR NEW.user_id <> OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_dm_participant');
END;

CREATE TRIGGER conversation_spike_message_guard_insert
BEFORE INSERT ON conversation_spike_messages
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_spike_conversations c
    WHERE c.id = NEW.conversation_id AND c.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_message_tenant') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = NEW.workspace_id AND user_id = NEW.author_id
  ) THEN RAISE(ABORT, 'invalid_message_author') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM conversation_spike_conversations c
    WHERE c.id = NEW.conversation_id AND c.kind = 'dm'
      AND (c.pair_state <> 'active'
        OR NEW.author_id NOT IN (c.dm_low_user_id, c.dm_high_user_id)
        OR NOT EXISTS (
          SELECT 1 FROM conversation_spike_participants p
          WHERE p.conversation_id = c.id AND p.user_id = NEW.author_id
            AND p.status = 'active' AND p.consented = 1
        ))
  ) THEN RAISE(ABORT, 'invalid_dm_author') END;
  SELECT CASE WHEN NEW.root_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM conversation_spike_messages root
    WHERE root.id = NEW.root_id AND root.conversation_id = NEW.conversation_id
      AND root.workspace_id = NEW.workspace_id AND root.root_id IS NULL
  ) THEN RAISE(ABORT, 'invalid_message_root') END;
END;

CREATE TRIGGER conversation_spike_message_guard_update
BEFORE UPDATE ON conversation_spike_messages
WHEN NEW.id <> OLD.id OR NEW.conversation_id <> OLD.conversation_id OR NEW.workspace_id <> OLD.workspace_id
  OR NEW.author_id <> OLD.author_id OR NEW.root_id IS NOT OLD.root_id OR NEW.create_seq <> OLD.create_seq
  OR NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'invalid_message_update');
END;

CREATE TRIGGER conversation_spike_change_guard_insert
BEFORE INSERT ON conversation_spike_changes
WHEN NEW.message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM conversation_spike_messages m
  WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id
    AND m.revision = NEW.revision
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_change_source');
END;

CREATE TRIGGER conversation_spike_attention_guard_insert
BEFORE INSERT ON conversation_spike_attention
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_spike_messages m
    WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_attention_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.recipient_id
  ) THEN RAISE(ABORT, 'invalid_attention_recipient') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM conversation_spike_conversations c
    WHERE c.id = NEW.conversation_id AND c.kind = 'dm'
      AND NOT EXISTS (
        SELECT 1 FROM conversation_spike_participants p
        WHERE p.conversation_id = c.id AND p.user_id = NEW.recipient_id
          AND p.status = 'active' AND p.consented = 1
      )
  ) THEN RAISE(ABORT, 'invalid_dm_attention_recipient') END;
END;

CREATE TRIGGER conversation_spike_outbox_guard_insert
BEFORE INSERT ON conversation_spike_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM conversation_spike_messages m
    WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id AND m.workspace_id = NEW.workspace_id
  ) THEN RAISE(ABORT, 'invalid_outbox_source') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.recipient_id
  ) THEN RAISE(ABORT, 'invalid_outbox_recipient') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM conversation_spike_conversations c
    WHERE c.id = NEW.conversation_id AND c.kind = 'dm'
      AND NOT EXISTS (
        SELECT 1 FROM conversation_spike_participants p
        WHERE p.conversation_id = c.id AND p.user_id = NEW.recipient_id
          AND p.status = 'active' AND p.consented = 1
      )
  ) THEN RAISE(ABORT, 'invalid_dm_outbox_recipient') END;
END;

CREATE TRIGGER conversation_spike_receipt_guard_insert
BEFORE INSERT ON conversation_spike_receipts
WHEN NOT EXISTS (
  SELECT 1 FROM conversation_spike_messages m
  WHERE m.id = NEW.message_id AND m.conversation_id = NEW.conversation_id
    AND m.author_id = NEW.actor_id AND m.create_seq = NEW.create_seq
    AND m.revision = NEW.revision
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_receipt_source');
END;

CREATE TRIGGER conversation_spike_membership_pair_key_immutable
BEFORE UPDATE OF workspace_id, user_id ON workspace_members
WHEN (NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id)
  AND (
    EXISTS (
      SELECT 1 FROM conversation_spike_conversations c
      WHERE c.workspace_id = OLD.workspace_id AND c.kind = 'dm'
        AND OLD.user_id IN (c.dm_low_user_id, c.dm_high_user_id)
    )
    OR EXISTS (
      SELECT 1 FROM conversation_spike_conversations c
      WHERE c.workspace_id = NEW.workspace_id AND c.kind = 'dm'
        AND NEW.user_id IN (c.dm_low_user_id, c.dm_high_user_id)
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'dm_membership_key_immutable');
END;

-- Canonical membership writers invalidate every room in the exact Project.
CREATE TRIGGER conversation_spike_membership_insert_epoch
AFTER INSERT ON workspace_members
BEGIN
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.workspace_id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE workspace_id = NEW.workspace_id;
  -- Rejoining one member requires a fresh confirmation from both people. The
  -- unaffected member keeps retained-history entitlement, but old consent is
  -- never reused to reactivate the pair.
  UPDATE conversation_spike_participants
    SET status = 'rejoin_pending', consented = 0
    WHERE conversation_id IN (
      SELECT c.id FROM conversation_spike_conversations c
      JOIN conversation_spike_participants rp
        ON rp.conversation_id = c.id AND rp.user_id = NEW.user_id
      WHERE c.workspace_id = NEW.workspace_id AND c.kind = 'dm'
        AND rp.status = 'membership_lost'
    );
  UPDATE conversation_spike_conversations SET pair_state = 'rejoin_pending'
    WHERE workspace_id = NEW.workspace_id AND kind = 'dm'
      AND pair_state = 'membership_lost'
      AND NEW.user_id IN (dm_low_user_id, dm_high_user_id)
      AND EXISTS (SELECT 1 FROM conversation_spike_participants p WHERE p.conversation_id = id AND p.user_id = NEW.user_id AND p.status = 'rejoin_pending');
END;

CREATE TRIGGER conversation_spike_membership_delete_epoch
AFTER DELETE ON workspace_members
BEGIN
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = OLD.workspace_id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE workspace_id = OLD.workspace_id;
  UPDATE conversation_spike_participants
    SET status = 'membership_lost', consented = 0, retains_history = 0
    WHERE user_id = OLD.user_id
      AND conversation_id IN (SELECT id FROM conversation_spike_conversations WHERE workspace_id = OLD.workspace_id AND kind = 'dm');
  UPDATE conversation_spike_conversations SET pair_state = 'membership_lost'
    WHERE workspace_id = OLD.workspace_id AND kind = 'dm'
      AND pair_state NOT IN ('blocked', 'left')
      AND OLD.user_id IN (dm_low_user_id, dm_high_user_id);
END;

CREATE TRIGGER conversation_spike_membership_update_epoch
AFTER UPDATE OF role, workspace_id, user_id ON workspace_members
BEGIN
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = OLD.workspace_id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE workspace_id = OLD.workspace_id;
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.workspace_id AND NEW.workspace_id <> OLD.workspace_id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE workspace_id = NEW.workspace_id AND NEW.workspace_id <> OLD.workspace_id;
END;

CREATE TRIGGER conversation_spike_archive_epoch
AFTER UPDATE OF archived_at ON workspaces
BEGIN
  UPDATE conversation_spike_conversations
    SET lifecycle = CASE WHEN NEW.archived_at IS NULL THEN 'active' ELSE 'archived' END,
        audience_epoch = audience_epoch + 1,
        next_change_seq = next_change_seq + 1
    WHERE workspace_id = NEW.id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE workspace_id = NEW.id;
END;

CREATE TRIGGER conversation_spike_participant_epoch
AFTER UPDATE OF status, consented, retains_history ON conversation_spike_participants
BEGIN
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE id = NEW.conversation_id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE id = NEW.conversation_id;
END;

CREATE TRIGGER conversation_spike_pair_state_epoch
AFTER UPDATE OF pair_state ON conversation_spike_conversations
WHEN NEW.pair_state IS NOT OLD.pair_state
BEGIN
  UPDATE conversation_spike_conversations
    SET audience_epoch = audience_epoch + 1, next_change_seq = next_change_seq + 1
    WHERE id = NEW.id;
  INSERT INTO conversation_spike_changes(conversation_id, change_seq, kind, audience_epoch, happened_at)
    SELECT id, next_change_seq - 1, 'audience', audience_epoch, unixepoch('subsec') * 1000
    FROM conversation_spike_conversations WHERE id = NEW.id;
END;

-- FK-independent account/workspace cleanup. Membership DELETE triggers run first.
CREATE TRIGGER conversation_spike_user_cleanup
BEFORE DELETE ON users
BEGIN
  DELETE FROM workspace_members WHERE user_id = OLD.id;
END;

CREATE TRIGGER conversation_spike_workspace_cleanup
BEFORE DELETE ON workspaces
BEGIN
  DELETE FROM conversation_spike_outbox WHERE workspace_id = OLD.id;
  DELETE FROM conversation_spike_attention WHERE workspace_id = OLD.id;
  DELETE FROM conversation_spike_receipts WHERE conversation_id IN (SELECT id FROM conversation_spike_conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversation_spike_changes WHERE conversation_id IN (SELECT id FROM conversation_spike_conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversation_spike_messages WHERE workspace_id = OLD.id;
  DELETE FROM conversation_spike_participants WHERE conversation_id IN (SELECT id FROM conversation_spike_conversations WHERE workspace_id = OLD.id);
  DELETE FROM conversation_spike_conversations WHERE workspace_id = OLD.id;
END;

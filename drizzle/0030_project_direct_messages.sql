ALTER TABLE conversations ADD COLUMN dm_requester_id TEXT;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN dm_blocked_by_user_id TEXT;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN dm_state_before_block TEXT;
--> statement-breakpoint
ALTER TABLE conversation_participants ADD COLUMN reopen_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (reopen_confirmed IN (0, 1));
--> statement-breakpoint
CREATE TABLE conversation_dm_receipts (
  actor_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('request', 'accept', 'decline', 'block', 'unblock', 'leave', 'reopen')),
  payload_hash TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  resulting_state TEXT NOT NULL CHECK (resulting_state IN ('pending', 'active', 'declined', 'blocked', 'left', 'membership_lost', 'rejoin_pending')),
  committed_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, client_request_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
--> statement-breakpoint

DROP TRIGGER conversations_guard_insert;
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
CREATE TRIGGER conversation_participants_identity_immutable
BEFORE UPDATE OF conversation_id, user_id ON conversation_participants
WHEN NEW.conversation_id <> OLD.conversation_id OR NEW.user_id <> OLD.user_id
BEGIN SELECT RAISE(ABORT, 'immutable_dm_participant'); END;
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

DROP TRIGGER conversation_messages_guard_insert;
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

DROP TRIGGER conversation_attention_guard_insert;
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
DROP TRIGGER conversation_outbox_guard_insert;
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

CREATE TRIGGER conversation_dm_receipts_guard_insert
BEFORE INSERT ON conversation_dm_receipts
WHEN NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id=NEW.conversation_id AND c.kind='dm'
  AND NEW.actor_id IN (c.dm_low_user_id,c.dm_high_user_id) AND c.pair_state=NEW.resulting_state)
BEGIN SELECT RAISE(ABORT, 'invalid_dm_receipt'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_receipts_immutable BEFORE UPDATE ON conversation_dm_receipts
BEGIN SELECT RAISE(ABORT, 'immutable_dm_receipt'); END;
--> statement-breakpoint

CREATE TRIGGER conversation_dm_membership_key_immutable
BEFORE UPDATE OF workspace_id, user_id ON workspace_members
WHEN (NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id) AND (
  EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND c.workspace_id=OLD.workspace_id AND OLD.user_id IN(c.dm_low_user_id,c.dm_high_user_id))
  OR EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND c.workspace_id=NEW.workspace_id AND NEW.user_id IN(c.dm_low_user_id,c.dm_high_user_id)))
BEGIN SELECT RAISE(ABORT, 'dm_membership_key_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER conversation_dm_membership_delete
AFTER DELETE ON workspace_members
BEGIN
  UPDATE conversation_participants SET status='membership_lost',consented=0,retains_history=0,reopen_confirmed=0
    WHERE user_id=OLD.user_id AND conversation_id IN (SELECT id FROM conversations WHERE kind='dm' AND workspace_id=OLD.workspace_id);
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
CREATE TRIGGER conversation_dm_user_id_immutable
BEFORE UPDATE OF id ON users
WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.kind='dm' AND OLD.id IN(c.dm_low_user_id,c.dm_high_user_id))
BEGIN SELECT RAISE(ABORT, 'dm_user_id_immutable'); END;
--> statement-breakpoint

ALTER TABLE work_operation_receipts ADD COLUMN source_conversation_id TEXT;
--> statement-breakpoint
UPDATE work_operation_receipts SET source_conversation_id=(SELECT l.source_conversation_id FROM work_links l WHERE l.id=work_operation_receipts.work_link_id);
--> statement-breakpoint
CREATE TRIGGER work_operation_receipts_source_conversation_required
BEFORE INSERT ON work_operation_receipts
WHEN NEW.source_conversation_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM work_links l WHERE l.id=NEW.work_link_id AND l.source_conversation_id=NEW.source_conversation_id)
BEGIN SELECT RAISE(ABORT, 'invalid_work_receipt_conversation'); END;

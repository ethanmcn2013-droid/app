-- Conversation-private files. Cleanup custody intentionally survives identity deletion.
CREATE TABLE conversation_chat_attachments (
  id text PRIMARY KEY NOT NULL,
  owner_id text NOT NULL,
  workspace_id text NOT NULL,
  conversation_id text NOT NULL,
  root_id text,
  audience_epoch integer NOT NULL,
  message_id text,
  position integer,
  client_request_id text NOT NULL,
  request_hash text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  backend text NOT NULL,
  store_identity text NOT NULL,
  storage_key text NOT NULL,
  stored_path text,
  state text NOT NULL,
  writer_settled integer NOT NULL DEFAULT 0,
  custody_until integer NOT NULL, -- Absolute write-admission grant; never evidence of writer termination.
  expires_at integer NOT NULL,
  created_at integer NOT NULL,
  CONSTRAINT conversation_chat_attachment_state CHECK(state IN ('uploading','ready','bound','cleanup','deleted')),
  CONSTRAINT conversation_chat_attachment_backend CHECK(backend IN ('disk','blob')),
  CONSTRAINT conversation_chat_attachment_bytes CHECK(size_bytes > 0 AND size_bytes <= 2097152),
  CONSTRAINT conversation_chat_attachment_hash CHECK(length(request_hash)=64),
  CONSTRAINT conversation_chat_attachment_binding CHECK((state='bound' AND message_id IS NOT NULL AND position IS NOT NULL) OR state!='bound')
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_conversation_chat_attachment_request ON conversation_chat_attachments(owner_id,client_request_id);
--> statement-breakpoint
CREATE INDEX idx_conversation_chat_attachment_owner ON conversation_chat_attachments(owner_id,state,created_at);
--> statement-breakpoint
CREATE INDEX idx_conversation_chat_attachment_message ON conversation_chat_attachments(conversation_id,message_id,position);
--> statement-breakpoint
CREATE INDEX idx_conversation_chat_attachment_project ON conversation_chat_attachments(workspace_id,state);

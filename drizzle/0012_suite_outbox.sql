-- Durable Tasks-owned propagation queue. Delivery is idempotent by event_id.
CREATE TABLE IF NOT EXISTS suite_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL,
  actor_user_id TEXT,
  workspace_id TEXT,
  object_ref TEXT,
  payload TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  delivered_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_suite_outbox_pending ON suite_outbox(delivered_at, occurred_at);
CREATE INDEX IF NOT EXISTS idx_suite_outbox_workspace ON suite_outbox(workspace_id, occurred_at);

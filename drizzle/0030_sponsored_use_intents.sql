CREATE TABLE sponsored_use_intents (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('event','erase')),
 actor_key TEXT NOT NULL CHECK (length(actor_key)=64),
 entitlement_id TEXT,
 epoch TEXT NOT NULL CHECK (length(epoch)=8),
 payload TEXT NOT NULL CHECK (json_valid(payload)),
 created_at INTEGER NOT NULL,
 delivered_at INTEGER,
 CHECK ((kind='event' AND entitlement_id IS NOT NULL) OR (kind='erase' AND entitlement_id IS NULL))
);
--> statement-breakpoint
CREATE INDEX sponsored_use_pending_idx ON sponsored_use_intents(delivered_at,created_at);
--> statement-breakpoint
CREATE INDEX sponsored_use_actor_idx ON sponsored_use_intents(actor_key);
--> statement-breakpoint
CREATE TABLE sponsored_use_subjects (
 actor_key TEXT NOT NULL CHECK (length(actor_key)=64),
 epoch TEXT NOT NULL CHECK (length(epoch)=8),
 subject_id_hash TEXT NOT NULL CHECK (length(subject_id_hash)=32),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(actor_key,epoch)
);

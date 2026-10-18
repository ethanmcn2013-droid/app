CREATE TABLE timeline_project_presentation (
 workspace_slug TEXT NOT NULL, project_slug TEXT NOT NULL, settings_json TEXT NOT NULL CHECK(json_valid(settings_json)), updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(workspace_slug,project_slug), FOREIGN KEY(workspace_slug,project_slug) REFERENCES projects(workspace_slug,slug) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE timeline_publication_presentation (
 publication_id TEXT PRIMARY KEY NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
 settings_json TEXT NOT NULL CHECK(json_valid(settings_json)), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
--> statement-breakpoint
CREATE TABLE timeline_guest_subscriptions (
 id TEXT PRIMARY KEY NOT NULL,publication_id TEXT NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
 share_token_hash TEXT NOT NULL,email TEXT NOT NULL,email_hash TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','unsubscribed')),
 confirmation_token_hash TEXT,confirmation_expires_at INTEGER,unsubscribe_token_hash TEXT,undo_token_hash TEXT,undo_until INTEGER,
 confirmed_at INTEGER,last_confirmation_sent_at INTEGER,
 delivery_state TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_state IN ('pending','sending','sent','failed','unknown')),
 delivery_attempt_id TEXT,provider_message_id TEXT,created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_share_email ON timeline_guest_subscriptions(share_token_hash,email_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_confirmation ON timeline_guest_subscriptions(confirmation_token_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_unsubscribe ON timeline_guest_subscriptions(unsubscribe_token_hash);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_undo ON timeline_guest_subscriptions(undo_token_hash);
--> statement-breakpoint
CREATE INDEX timeline_guest_publication ON timeline_guest_subscriptions(publication_id);
--> statement-breakpoint
CREATE TABLE timeline_guest_deliveries (
 id TEXT PRIMARY KEY NOT NULL,subscription_id TEXT NOT NULL REFERENCES timeline_guest_subscriptions(id) ON DELETE CASCADE,
 publication_id TEXT NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('update','date_change','photos','final30','final7','final1','foryou7','postfinal7')),dedupe_key TEXT NOT NULL,
 due_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','unknown','suppressed')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),claimed_at INTEGER,sent_at INTEGER,failed_at INTEGER,attempt_id TEXT,last_error_code TEXT,provider_message_id TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_delivery_dedupe ON timeline_guest_deliveries(dedupe_key);
--> statement-breakpoint
CREATE UNIQUE INDEX timeline_guest_delivery_attempt ON timeline_guest_deliveries(attempt_id);
--> statement-breakpoint
CREATE INDEX timeline_guest_delivery_due ON timeline_guest_deliveries(status,due_at);

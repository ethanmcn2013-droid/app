ALTER TABLE user_preferences ADD COLUMN sponsor_measurement_enabled integer NOT NULL DEFAULT 1;

--> statement-breakpoint

CREATE TABLE sponsored_use_project_links (
  recipient_key text NOT NULL,
  epoch text NOT NULL,
  workspace_id_hash text NOT NULL,
  sponsor_id text NOT NULL,
  updated_at integer NOT NULL,
  PRIMARY KEY (recipient_key, epoch, workspace_id_hash)
);

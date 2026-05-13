-- User-level cross-product email cadence preferences. Distinct from
-- notification_prefs which carries in-app workspace-internal toggles.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  daily_signal_cadence TEXT NOT NULL DEFAULT 'off',
  weekly_summary TEXT NOT NULL DEFAULT 'off',
  time_zone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Hot-column indexes. Every read against tasks/comments/activities/
-- notifications/entitlements/workspace_members/share_links was a full
-- table scan before this — fine at seed-row counts, expensive once
-- a single workspace gets a few hundred tasks. IF NOT EXISTS keeps
-- the file safe to re-run.
--
-- Apply on Turso prod via:  turso db shell <db> < drizzle/0003_hot_indexes.sql

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ws_lane ON tasks(workspace_id, lane);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

CREATE INDEX IF NOT EXISTS idx_activities_task_created ON activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_ws_created ON activities(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_workspace ON entitlements(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_notes ON entitlements(notes);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_share_links_workspace_id ON share_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_share_link_visits_token_at ON share_link_visits(token, visited_at DESC);

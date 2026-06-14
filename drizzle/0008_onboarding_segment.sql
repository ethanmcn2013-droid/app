-- Segmented onboarding fields on workspaces.
-- Additive only — existing active_domain + template_id unchanged.

ALTER TABLE workspaces ADD COLUMN primary_use_case TEXT;
ALTER TABLE workspaces ADD COLUMN secondary_context TEXT;
ALTER TABLE workspaces ADD COLUMN onboarding_completed_at INTEGER;

-- Planning Period foundation. Additive and forward-fixable; no existing table
-- is rebuilt, no id/slug/content/token is rewritten, and no legacy user is
-- sent back through onboarding.
--
-- Production procedure remains the repository-wide migration contract:
-- verified backup -> isolated-copy dry run -> reviewed SQL -> invariant checks.

CREATE TABLE IF NOT EXISTS planning_periods (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'general'
    CHECK (context_type IN ('school_year', 'semester', 'wedding_season', 'general')),
  start_date TEXT,
  end_date TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  archived_at INTEGER,
  position REAL NOT NULL DEFAULT 1000,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (start_date IS NULL OR start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_planning_periods_owner_position
  ON planning_periods(owner_user_id, archived_at, position);

-- SQLite cannot add a foreign-key constraint to an existing table without a
-- destructive rebuild. The application DAL and migration invariants enforce
-- the relationship now; a reviewed rebuild can tighten it in a later window.
ALTER TABLE workspaces ADD COLUMN planning_period_id TEXT;
ALTER TABLE workspaces ADD COLUMN context_type TEXT NOT NULL DEFAULT 'project';
ALTER TABLE workspaces ADD COLUMN primary_date TEXT;
ALTER TABLE workspaces ADD COLUMN primary_date_label TEXT;
ALTER TABLE workspaces ADD COLUMN position REAL NOT NULL DEFAULT 1000;
ALTER TABLE workspaces ADD COLUMN archived_at INTEGER;
ALTER TABLE workspaces ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workspaces ADD COLUMN updated_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_workspaces_period_position
  ON workspaces(planning_period_id, archived_at, position);

CREATE TABLE IF NOT EXISTS planning_period_migration_report (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  disposition TEXT NOT NULL
    CHECK (disposition IN ('grouped', 'ambiguous_owner', 'missing_owner')),
  detail TEXT NOT NULL,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Record uncertainty before changing any grouping. Exactly one owner
-- membership is the only safe inference; owner_user_id alone is not enough.
INSERT OR REPLACE INTO planning_period_migration_report (
  workspace_id, disposition, detail, recorded_at
)
SELECT
  w.id,
  CASE
    WHEN COUNT(wm.user_id) = 0 THEN 'missing_owner'
    ELSE 'ambiguous_owner'
  END,
  CASE
    WHEN COUNT(wm.user_id) = 0 THEN 'No owner membership; left ungrouped for review.'
    ELSE 'Multiple owner memberships; left ungrouped for review.'
  END,
  unixepoch()
FROM workspaces w
LEFT JOIN workspace_members wm
  ON wm.workspace_id = w.id AND wm.role = 'owner'
WHERE w.planning_period_id IS NULL
GROUP BY w.id
HAVING COUNT(wm.user_id) <> 1;

-- A deterministic default per unambiguous owner. Re-running these data
-- statements is harmless and preserves every existing workspace identifier.
INSERT OR IGNORE INTO planning_periods (
  id, owner_user_id, name, context_type, start_date, end_date,
  timezone, position, revision
)
SELECT
  'planning-legacy-' || lower(hex(wm.user_id)),
  wm.user_id,
  'Active work',
  'general',
  date(MIN(w.created_at), 'unixepoch'),
  date(MIN(w.created_at), 'unixepoch', '+1 year', '-1 day'),
  'UTC',
  1000,
  1
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.role = 'owner'
  AND w.planning_period_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM workspace_members owners
    WHERE owners.workspace_id = w.id AND owners.role = 'owner'
  ) = 1
GROUP BY wm.user_id;

-- Forward-fix any pre-existing period rows created during an earlier preview
-- of the additive schema. The horizon is stable from created_at and finite.
UPDATE planning_periods
SET start_date = COALESCE(start_date, date(created_at, 'unixepoch')),
    end_date = COALESCE(
      end_date,
      date(COALESCE(start_date, date(created_at, 'unixepoch')), '+1 year', '-1 day')
    ),
    updated_at = unixepoch()
WHERE start_date IS NULL OR end_date IS NULL;

UPDATE workspaces
SET planning_period_id = (
      SELECT 'planning-legacy-' || lower(hex(wm.user_id))
      FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id AND wm.role = 'owner'
      LIMIT 1
    ),
    context_type = COALESCE(context_type, 'project'),
    updated_at = COALESCE(updated_at, unixepoch())
WHERE planning_period_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM workspace_members owners
    WHERE owners.workspace_id = workspaces.id AND owners.role = 'owner'
  ) = 1;

INSERT OR REPLACE INTO planning_period_migration_report (
  workspace_id, disposition, detail, recorded_at
)
SELECT id, 'grouped', 'Assigned to the owner default Active work period.', unixepoch()
FROM workspaces
WHERE planning_period_id LIKE 'planning-legacy-%';

CREATE TABLE IF NOT EXISTS workspace_sponsorships (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sponsor_id TEXT NOT NULL,
  sponsor_ref TEXT,
  entitlement_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  consented_metadata TEXT NOT NULL DEFAULT '{}',
  metadata_version INTEGER NOT NULL DEFAULT 1,
  consent_receipt_id TEXT NOT NULL,
  consented_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (json_valid(consented_metadata))
);

CREATE INDEX IF NOT EXISTS idx_workspace_sponsorships_workspace
  ON workspace_sponsorships(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_sponsorships_sponsor
  ON workspace_sponsorships(sponsor_id, status);

-- This table deliberately has no user/member/role grant columns. A sponsor
-- sees activation status and expressly consented metadata through a separate,
-- allowlisted DTO; content access still requires workspace_members.

CREATE TABLE IF NOT EXISTS planning_onboarding_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL
    CHECK (context_type IN ('school_year', 'semester', 'wedding_season', 'general')),
  state TEXT NOT NULL CHECK (json_valid(state)),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  revision INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_planning_onboarding_user_status
  ON planning_onboarding_sessions(user_id, status);

-- Post-migration invariants (expect zero rows after ambiguous rows are reviewed):
-- SELECT * FROM planning_period_migration_report WHERE disposition <> 'grouped';
-- SELECT COUNT(*) FROM workspaces w LEFT JOIN planning_periods p
--   ON p.id = w.planning_period_id
--   WHERE w.planning_period_id IS NOT NULL AND p.id IS NULL;
-- SELECT COUNT(*) FROM workspace_sponsorships s JOIN workspace_members m
--   ON m.workspace_id = s.workspace_id AND m.user_id = s.sponsor_id;

-- Competitor-review keystone 2026-05-16 (T·63).
--
-- Sponsor identity was not persisted on the workspace surface. It lived
-- only on the entitlements row and inside comp_codes.notes JSON (written
-- by studio's issue-codes.ts). Every venue-facing surface — the HBAP-1
-- quiet eyebrow, the HBAP-2 couple briefing, the per-venue seed — had to
-- re-resolve the sponsor through a multi-table lookup and fight for a
-- mutation window. That is the single unlock the competitor-review
-- action plan names ("The single unlock for everything else").
--
-- This migration adds two nullable text columns to `workspaces` and an
-- index so the venue-facing reads land once and cache. The dual-write
-- happens at redemption in src/server/actions/comp.ts (the wedding-tier
-- short-circuit), in the same statement that flags template_id /
-- active_domain. Null = the workspace is not venue-sponsored.
--
-- NOT idempotent: SQLite `ALTER TABLE ADD COLUMN` has no IF NOT EXISTS
-- and errors with "duplicate column name" if re-run. This is a run-once
-- migration. If it has already been applied, that error is expected and
-- safe to ignore — no data is touched. `CREATE INDEX IF NOT EXISTS` is
-- idempotent and safe to re-run on its own.
--
-- Apply on Turso prod (one statement at a time is fine):
--   turso db shell ethanmcnamara-tasks < drizzle/0006_workspace_venue_sponsor.sql
--
-- Local/dev applies automatically via `drizzle-kit push --force`
-- (db:push) off the schema.ts change — this file is the prod path,
-- matching the 0002–0005 operator-applied pattern.

ALTER TABLE workspaces ADD COLUMN venue_sponsor_slug text;
ALTER TABLE workspaces ADD COLUMN venue_sponsor_name text;

CREATE INDEX IF NOT EXISTS idx_workspaces_venue_sponsor_slug
  ON workspaces (venue_sponsor_slug);

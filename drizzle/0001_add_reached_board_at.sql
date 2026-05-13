-- Cycle 8.4.6+ — "Did the next person finish?" signal for Venue Editions.
-- Idempotent ALTER ADD COLUMN. Safe on Turso/SQLite — appends to the
-- table, existing rows get NULL.
--
-- Powers a single column on signalstudio.ie/hq/partners that answers:
-- of the couples who redeemed, how many actually reached the board?
-- Brand-aware monitoring at pilot scale — one boolean, not an event log.
--
-- Apply on prod Turso:
--   turso db shell tasks "ALTER TABLE entitlements ADD COLUMN reached_board_at INTEGER;"

ALTER TABLE entitlements ADD COLUMN reached_board_at INTEGER;

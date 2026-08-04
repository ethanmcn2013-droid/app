-- 0027 · share_links.token_hash + share_links.token_scheme (E08.06 / R-033)
--
-- share_links.token was the raw guest secret, stored as the primary key and
-- resolved by WHERE token = ?. A read of this table disclosed live access to
-- every share link. Timeline's audience_shares already stored a sha256 behind
-- a unique index and compared it in constant time; this brings share_links to
-- the same shape.
--
-- Additive only. No existing row is modified and no existing link stops
-- working: every current row keeps token_scheme = 'plaintext' and keeps
-- resolving through the legacy branch of the dual-read resolver until
-- scripts/db/backfill-share-link-token-hashes.mjs moves it. The unique index
-- is created over a column that is NULL on every existing row, which SQLite
-- permits, so it cannot collide at apply time.

ALTER TABLE share_links ADD COLUMN token_hash TEXT;
--> statement-breakpoint
ALTER TABLE share_links ADD COLUMN token_scheme TEXT NOT NULL DEFAULT 'plaintext';
--> statement-breakpoint
CREATE UNIQUE INDEX uq_share_links_token_hash ON share_links (token_hash);

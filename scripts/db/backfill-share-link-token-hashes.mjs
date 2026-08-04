#!/usr/bin/env node
/**
 * E08.06 / R-033 — move `share_links` off plaintext secrets.
 *
 * Migration 0027 added `token_hash` and `token_scheme`. It deliberately did
 * NOT move any data: an ALTER cannot compute sha256, and doing it in SQL
 * would have meant trusting a hash function libSQL does not ship. This script
 * is the data half, and it is the step that actually removes the exposure.
 *
 * For each row still reading `token_scheme = 'plaintext'`:
 *   1. hash the secret currently sitting in `token`,
 *   2. mint a fresh non-secret public id,
 *   3. repoint `share_link_visits.token` at the new public id,
 *   4. overwrite `share_links.token` with the public id and write the hash.
 *
 * After a row is moved, its secret exists nowhere on the server. The link
 * keeps working, because the resolver hashes the URL's secret and matches the
 * stored hash.
 *
 * ORDER OF OPERATIONS — this is not optional, and getting it wrong takes
 * every share link down:
 *
 *   1. Apply migration 0027 (additive; nothing breaks).
 *   2. Deploy the dual-read resolver (`resolveShareLinkRow`). It understands
 *      both schemes. Old links still resolve through the legacy branch.
 *   3. Run this script. Rows move one at a time; a row is either fully moved
 *      or untouched.
 *   4. Confirm `--status` reports zero plaintext rows.
 *   5. Only then delete the legacy branch from `resolveShareLinkRow` and
 *      `emailShareLinkAction`, and make `token_hash` NOT NULL.
 *
 * Running this BEFORE step 2 breaks every existing share link, because the
 * deployed code would still be looking for a plaintext match that no longer
 * exists. There is no recovery from a partially-run backfill against old
 * code other than rolling the code forward.
 *
 * Usage:
 *   node scripts/db/backfill-share-link-token-hashes.mjs --status
 *   node scripts/db/backfill-share-link-token-hashes.mjs            (dry run)
 *   node scripts/db/backfill-share-link-token-hashes.mjs --apply
 *
 * Dry run is the default and prints exactly what --apply would do. Nothing is
 * written without --apply. The script is idempotent: a second --apply run
 * finds zero plaintext rows and exits 0 having written nothing.
 */

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";

const argv = new Set(process.argv.slice(2));
const APPLY = argv.has("--apply");
const STATUS_ONLY = argv.has("--status");

function fail(message) {
  console.error(`backfill-share-link-token-hashes: ${message}`);
  process.exit(1);
}

/** Must stay byte-identical to hashShareToken in src/server/share-token.ts. */
function hashShareToken(secret) {
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(secret)) {
    throw new TypeError("Invalid share token shape");
  }
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Must stay identical in shape to generateSharePublicId. */
function newPublicId() {
  return `sl_${randomBytes(12).toString("hex")}`;
}

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
if (!url) fail("TURSO_DATABASE_URL (or DATABASE_URL) must be set");

const client = createClient(authToken ? { url, authToken } : { url });

const columns = await client.execute(
  "SELECT COUNT(*) AS n FROM pragma_table_info('share_links') WHERE name IN ('token_hash','token_scheme')",
);
if (Number(columns.rows[0].n) !== 2) {
  fail(
    "share_links is missing token_hash / token_scheme. Apply migration 0027 first (pnpm db:migrate).",
  );
}

async function status() {
  const rows = await client.execute(
    "SELECT token_scheme AS scheme, COUNT(*) AS n FROM share_links GROUP BY token_scheme ORDER BY token_scheme",
  );
  const counts = Object.fromEntries(rows.rows.map((r) => [r.scheme, Number(r.n)]));
  const plaintext = counts.plaintext ?? 0;
  const hashed = counts.sha256 ?? 0;
  console.log(`share_links: ${plaintext} plaintext, ${hashed} sha256`);
  return { plaintext, hashed };
}

if (STATUS_ONLY) {
  const { plaintext } = await status();
  console.log(
    plaintext === 0
      ? "No secret is stored in share_links. The legacy resolver branch can be deleted."
      : `${plaintext} share link secrets are still stored in plaintext. Run with --apply.`,
  );
  process.exit(0);
}

const pending = await client.execute(
  "SELECT token FROM share_links WHERE token_scheme = 'plaintext' ORDER BY created_at",
);

console.log(
  `${pending.rows.length} row(s) to move. Mode: ${APPLY ? "APPLY" : "dry run (no writes)"}.`,
);

let moved = 0;
let skipped = 0;

for (const row of pending.rows) {
  const secret = String(row.token);
  let hash;
  try {
    hash = hashShareToken(secret);
  } catch {
    // A row whose token does not even look like a token cannot be moved
    // safely, and guessing would be worse than reporting it. Left alone.
    console.warn(`  SKIP  token of unexpected shape, left as plaintext`);
    skipped += 1;
    continue;
  }
  const publicId = newPublicId();

  if (!APPLY) {
    console.log(`  would move 1 row → ${publicId} (hash ${hash.slice(0, 12)}…)`);
    moved += 1;
    continue;
  }

  // One row, one batch. The visit rows are repointed BEFORE the parent key
  // changes so the join is never dangling, and the whole batch is atomic, so
  // a row is either fully moved or untouched.
  await client.batch(
    [
      {
        sql: "UPDATE share_link_visits SET token = ? WHERE token = ?",
        args: [publicId, secret],
      },
      {
        sql: "UPDATE share_links SET token = ?, token_hash = ?, token_scheme = 'sha256' WHERE token = ? AND token_scheme = 'plaintext'",
        args: [publicId, hash, secret],
      },
    ],
    "write",
  );
  moved += 1;
}

console.log(
  APPLY
    ? `Moved ${moved} row(s), skipped ${skipped}.`
    : `Dry run complete: ${moved} row(s) would move, ${skipped} would be skipped. Re-run with --apply.`,
);

const after = await status();
if (APPLY && after.plaintext > skipped) {
  fail(
    `expected at most ${skipped} plaintext row(s) after apply, found ${after.plaintext}`,
  );
}
process.exit(0);

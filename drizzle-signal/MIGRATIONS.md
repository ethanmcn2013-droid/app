# Signal / Briefing schema provenance

MIG-01 successor (2026-09-05): source 279c and evidence efca, including their authored local fixtures, remain historical and unaccepted. The original LIKE predicate treated underscore as a wildcard and omitted ordinary sqlitex tables/indexes. Current fingerprint/proofs use literal-prefix GLOB matching, with a new immutable review receipt. Old review receipts and sealed evidence remain unchanged. Existing provisional 279c database registrations retain their old receipt identities and are refused by the successor checksum contract; this slice does not restamp them or claim compatibility/production adoption. Use new disposable fixtures for current local checks. Any transition of retained fixtures requires a separately reviewed decision.

The owning tests exercise ordinary and sqlitex table/index additions at every Notes/Signal schema boundary: registered inventory/migration refuse, unregistered inventory reports unknown-legacy and adoption/migration refuse, direct receipt proofs fail, and each refusal leaves the file byte-identical. Actual sqlite_stat1 and sqlite_autoindex objects remain compatible with adoption and no-op. These are local author checks; successor acceptance still belongs to principal review.

This is a local/test operational runner. It accepts only an explicitly named absolute local file URL and an explicit local or test environment. Remote URLs, production/preview/staging environments, auth-token arguments and ambient module URLs are unsupported. There is no production adoption authority or automatic restore/retry here.

The owning scripts are scripts/db/signal-inventory.mjs and scripts/db/signal-migrate.mjs. They share only the bounded Notes/Signal helpers. Tasks and Timeline runners, package/CI and the primary App migration chain are unchanged.

## Preserved history

drizzle.signal.config.ts records the July2026 reset and its tracked0000_signal_baseline. A database created through a different path still needs explicit adoption if it lacks this owning ledger.

Every existing SQL file, snapshot and journal is preserved. New migration-ledger.json pins canonical LF SQL, journal, snapshot and review-receipt checksums. Each reviewed schema boundary has an exact normalized sqlite_schema fingerprint plus table/index, integrity and FK proofs. Owning .gitattributes pins SQL to LF without rewriting historical files.

The metadata table is signal_briefing_schema_migrations. __drizzle_migrations is read and fingerprinted, never created or updated by this runner. A registration marked adopted_legacy means the observed schema matches a local version; it does not claim the local SQL ran in the foreign history. Execution receipts retain the observed foreign ledger, target identity, source/review hashes and operator release SHA.

## Local commands

Use installed repository dependencies and Node22. Supply a disposable absolute path as a file URL, for example file:///C:/isolated/rehearsal/signal.db. No default signal.db is opened. A new file requires --create and an existing file refuses that flag.

```text
node scripts/db/signal-migrate.mjs migrate --database-url <absolute-file-URL> --environment test --release-sha <40-character-source-SHA> --create
node scripts/db/signal-inventory.mjs --database-url <absolute-file-URL> --environment test
node scripts/db/signal-migrate.mjs status --database-url <absolute-file-URL> --environment test
node scripts/db/signal-migrate.mjs adopt --database-url <absolute-file-URL> --environment test --release-sha <40-character-source-SHA> --receipt <local-adoption-receipt.json>
node scripts/db/signal-migrate.mjs migrate --database-url <absolute-file-URL> --environment test --release-sha <40-character-source-SHA>
node --test --test-concurrency=1 scripts/db/notes-signal-migrate.test.mjs
```

Inventory/status opens the named existing file, verifies its actual main database path, uses a read transaction with query_only, and emits hashes/counts/proof results and schema-migration IDs. It does not emit module data or foreign migration hashes. A successful status is fresh, adoption-required, pending or current. Unknown legacy schema is explicitly classified and both write commands refuse it. Changed/malformed owning metadata, changed foreign history or failing integrity/FK proofs fail instead of reporting current.

An unregistered recognized database must use adopt. A registered database may migrate only its remaining source entries. A write transaction repeats the observations/proofs and commits schema plus metadata together. Failed SQL, proofs or metadata roll back the transaction; a newly requested empty file can remain on disk. A no-op still checks registered schema, receipts and current proofs. There is no blind baseline replay or high-water rewrite.

## Adoption receipt

An operator reviews inventory from this exact local target. Copy its observed fields into a separate local document; inventory does not grant or auto-generate authorization.

```json
{
  "schemaVersion": "notes-signal-adoption/1",
  "id": "reviewed-local-signal-adoption",
  "module": "signal",
  "environment": "test",
  "authorizedBy": "Accountable local rehearsal operator",
  "reviewedBy": "Actual reviewer",
  "databaseIdentitySha256": "<inventory value>",
  "sourceLedgerSha256": "<inventory value>",
  "schemaFingerprintSha256": "<inventory value>",
  "matchedThrough": "<inventory value>",
  "legacyDrizzleChain": "<replace with the exact inventory object>",
  "backupEvidence": {"reference": "<verified backup/restore receipt reference>", "sha256": "<receipt/artifact SHA256>"}
}
```

The receipt binds module, environment, canonical target URL hash, source ledger, schema boundary and observed foreign history. Adoption writes metadata only. Repeating the exact adoption receipt is a no-op only while that same adopted registration remains current; a different receipt or later migration is refused.

The backupEvidence reference/hash must be present, but this runner does not independently certify the referenced backup or its restore procedure. Production adoption still needs actual production inventory, reviewed foreign-chain evidence, verified backup/restore, target-specific approval and a separately authorized transport/runner slice. The January182935 restored-module packet remains historical proof; these local checks do not renew production recovery or any runtime lifecycle review.

## Limits and future changes

Schema matching is intentionally strict: a partial, extended or differently expressed foreign schema is not guessed compatible or force-adopted. It requires a separately reviewed profile/migration decision. Existing read-only snapshots and foreign rows are never rewritten. Add future forward SQL with a new immutable receipt and snapshot/journal entry; do not edit applied SQL or a prior receipt. The current source loader validates every top-level module SQL file.

On an explicit local file copy, current target identity can differ from historical execution identities. Status exposes both; no-op preserves the original receipts without relabelling the restore as a migration. The tests exercise a consistent local VACUUM INTO copy, not distributed or production restore and not a renewal of the original backup-helper run. Operators must keep target files quiescent during file replacement; concurrent remote drivers/network filesystems and replacement across processes are not certified. No background coordination architecture was added.

Principal owns final command/CI registration and canonical ACCEPTANCE/HQ changes. Source/receipt review is still required. The companion module contract is [notes](../drizzle-notes/MIGRATIONS.md). Jan21 external hold continues.

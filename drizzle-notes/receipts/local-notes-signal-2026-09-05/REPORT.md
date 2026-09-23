# Notes/Signal local schema adoption — principal handoff

Implemented and locally verified at **279cbe5c54797a0b6995ac57ae22346081f13256** from exact **a6293a82955d17bc414506ab89412f8667c1cd2f**, branch **ops/january-notes-signal-migrations**, worktree C:/Users/ethan/signal-studio-workspace/worktrees/app/ops-january-notes-signal-migrations. Source commit changes15 owning files; all14 inventoried historical SQL/snapshot/journal/config/shared-runner inputs remain byte-identical. No package/CI/registry/HQ, primary App0031/0032 or Drive/token lifecycle source changed. This is a distinct operational schema-provenance task, unrelated to held reviews.

## Canonical gap and bounded result

Canonical Studio ACCEPTANCE.md operational migration/rollback/restore row said Notes/Signal production adoption lacked an owning receipted runner. The prior182935 module restore packet explicitly replayed two Notes SQL entries and one Signal baseline on fresh disposable databases, and did not prove production upgrade/adoption/no-op behavior. Its selected owning receipts/manifests are copied unchanged into this packet. It was not rerun.

This slice supplies explicit local/test inventory, status, fresh migration, metadata-only known-schema adoption and checked no-op paths. It does not enable production adoption. Notes retains the foreign notes.git history named in drizzle.notes.config.ts; Signal retains its July reset history. __drizzle_migrations is fingerprinted/read only; its rows and DDL are never created/updated by the runner.

## Ownership and implementation

- scripts/db/notes-signal-ledger.mjs validates only Notes/Signal owning ledgers: full SQL registration, ordered original journal parity, canonical checksums for SQL/journal/snapshots/review receipts, strict known schema fingerprints and scalar SELECT proofs. It reuses the unchanged shared hash/text helpers; shared migration-ledger.mjs is not generalized or edited.
- scripts/db/notes-signal-migrate.mjs owns its actual file connection. Explicit absolute file URL/local-or-test environment required; missing, relative, memory, remote, production and URL-option targets refuse before opening. --create is explicit/exclusive. Actual main database file path is checked. Inventory uses query_only plus a read transaction. Writes reobserve target/schema/foreign metadata under one write transaction, then commit schema/proofs/receipt metadata together.
- notes-inventory.mjs, signal-inventory.mjs, notes-migrate.mjs and signal-migrate.mjs provide module-specific entry points. No ambient database URL, auth token, unsafe push or default development store is consumed.
- Owning tables signal_notes_schema_migrations and signal_briefing_schema_migrations retain SQL/review hashes and content-addressed execution/adoption provenance. Source-ledger order, not wall-clock timestamp order, defines the valid prefix. Applied and adopted_legacy remain distinct. A copied file exposes its current target identity separately from retained original execution identities.
- drizzle-notes and drizzle-signal receive only new LF attributes, ledgers, review receipts and MIGRATIONS.md guides. Their original SQL/snapshot/journal/config files are untouched. No business schema migration is invented.

Known schema boundaries from actual disposable SQL execution:

| Module/version | Runtime tables / explicit indexes | Fingerprint |
|---|---|---|
| Notes0000 | 5 / 9 | 1d03e137d3f8c566ef492e0b16cb591b979decd8fa6e2f85b04a6b64145672e9 |
| Notes0001reviewed_at | 5 / 10 | b37164718f2851d3f6a2e8e690b2ba85783c6733e06c58f035c71f0a3ec1cacc |
| Signal0000 | 10 / 7 | 253c30d3b1c0f4a392f3cae2699003823899cb65162fa576d0bcbfef2d090a4b |

Metadata/foreign ledger tables are separately identified and excluded from application fingerprints. A matching foreign schema can be adopted only with a target-bound receipt. Unknown, partial, extended or differently expressed schemas refuse; there is no assumption that a live legacy schema matches these profiles.

## Exact verification

Final Node22.23.2 tests ran after committing source279c, with empty dirty status and file hashes checked again during packaging. **21/21 groups, exit0**. Actual file-backed libSQL0.17.3 plus the real new source execute; seven authored MJS files lint with **0errors/0warnings, exit0**. No broad UI/build/provider suite was run or claimed.

Coverage: both fresh baselines/current/no-op, byte-stable inventory/no-op, populated known legacy adoption preserving every runtime row and foreign history, repeat receipt/no-op and different-receipt refusal, wrong target/module/environment/schema/source/history/version/backup-reference refusals, unknown schema/missing index/foreign-only refusal, SQL/snapshot/journal/review checksum and unregistered SQL refusal, failed postcondition rollback of all schema+metadata and corrected retry, registered schema/metadata/foreign-history drift refusal, consistent local copies preserving original receipt identity, Notes baseline adoption followed only by reviewed_at, actual CLI positive and missing-target/ambient-URL negative controls, and populated FK proof failure.

Owning commands on a checkout with installed pinned dependencies:

```text
node --test --test-concurrency=1 scripts/db/notes-signal-migrate.test.mjs
node scripts/db/notes-inventory.mjs --database-url <absolute-local-file-URL> --environment test
node scripts/db/signal-inventory.mjs --database-url <absolute-local-file-URL> --environment test
node scripts/db/notes-migrate.mjs migrate --database-url <absolute-local-file-URL> --environment test --release-sha <source-SHA> --create
node scripts/db/signal-migrate.mjs migrate --database-url <absolute-local-file-URL> --environment test --release-sha <source-SHA> --create
```

Exact host gate commands are recorded in test-final/receipt.json and lint-final/receipt.json. Existing principal dependencies were read only; no installation, shared node_modules link or purge. The scratch verifier bundles actual ESM to CJS for that read-only dependency runtime, replacing each import.meta.url with its exact source URL so module-relative ledgers remain correct. It records all inputs, bundle hashes, commands, exit codes and synthetic CLI output. No DB/service provider adapter or runtime behavior stub is used. OS-only environment keys, NODE_PATH, isolated TEMP and test CLI directory are supplied.

Failed receipts remain: test-01 passed19/20; the intended orphan fixture was refused during insertion because FK enforcement was still on. Fixture setup now explicitly disables FK only for the corruption insert; actual runner reenables it and rejects adoption. lint-01 found a test loop variable named module under the existing Next lint rule; renamed moduleName without weakening lint. Initial commit whitespace check exited2 for one trailing space in the Signal guide; fixed before commit. Harmless React autodetection notices reflect using dependencies outside the new worktree. No failed receipt was overwritten.

## Adoption and restore limits

Receipts must bind module/environment, canonical target URL hash, exact source ledger, matched schema boundary and observed foreign ledger. AuthorizedBy/reviewedBy/backup evidence fields are operator provenance; they are not fabricated production or independent acceptance. The required backupEvidence reference/hash is not itself verified by this runner. Actual production inventory, foreign-chain review, backup restore and target-specific release approval remain required, as does a separately authorized production transport slice.

The local copy test uses VACUUM INTO with synthetic rows and verifies current/no-op, schema proofs and retained rows/receipt identity. It is not a new run of the historical backup/restore helpers, a full module runtime restore, distributed recovery, remote contention or production adoption. File targets must remain quiescent during cross-process replacement; remote drivers/network filesystems are unverified. No generic coordination architecture or automatic migration retry was added.

Principal owns final test/command registration and canonical operational-row updates. Suggested addition to that row: “Notes/Signal now have source279c local/test receipt-backed inventory/adoption/migrate/no-op tools,21 focused groups passing on disposable file databases; unknown legacy states refuse and historical chains remain unchanged. Actual production inventory/adoption, backup/restore and explicit operational approval remain open.” Retain the preceding182935 history and its limitations. No other programme percentage/closure change is implied.

Prior-stop provenance clarification for future readers: principal instructed the prior Drive stop after an automatic review rejection; no separate user stop was sent. The sealed Drive artifacts, held tests/review and source-hash discrepancy were not reopened or changed. Jan21 external hold remains.

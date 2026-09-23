# Notes/Signal MIG-01 correction

Source **53295ee7d1d9b395513872aed2d958feebfd0557**, parent **efca49f470d8ba35aa30d7aca8335b473d084ed7**, task base **a6293a82955d17bc414506ab89412f8667c1cd2f**. Branch **ops/january-notes-signal-migrations** in C:/Users/ethan/signal-studio-workspace/worktrees/app/ops-january-notes-signal-migrations. Eight source/owning-ledger/receipt/doc files changed. Source is frozen for principal review. Local commits only; no push or integration performed.

## Finding and repair

Principal independently validated MIG-01 (bounded P2 local schema classification) on original279c. SQL LIKE treats underscore as a wildcard: the old predicate omitted an ordinary sqlitex_independent_extra table, incorrectly certifying registered databases current and unregistered databases adoption-required. The original four failing controls, per-case actual JSON/databases and exact log remain unchanged. The principal's native21/21 and additional populated-forward rollback pass are retained alongside that finding, not substituted for it. Original279c/efca and their provisional fixtures remain historical and unaccepted.

The only runtime behavior change is scripts/db/notes-signal-ledger.mjs schemaFingerprint: name NOT GLOB 'sqlite_*' matches the literal sqlite_ internal prefix. Both current owning proof receipts use the same corrected table/index predicate. New local-schema-review-mig01-2026-09-05.json receipts name and hash their original predecessors; current module ledgers pin the successors. All baseline SQL, snapshots, journals, original receipt bytes and sealed evidence are preserved. No shared migration-ledger.mjs, runner transaction logic, primary migrations, package/CI/registry/HQ, Drive or other product source changed.

## Committed-source verification

- Native Node22.23.2 owning suite: **48/48**, exit0. This is the original21 plus24 undeclared-object groups (three schema boundaries x registered/unregistered x table/index x ordinary/sqlitex name) and3 positive internal-object groups.
- Every negative group directly executes the corrected receipt proof, then the actual inventory and relevant write commands. Registered inventory/migration reject fingerprint mismatch; unregistered inventory returns unknown-legacy and migration/adoption reject. Valid pre-fault adoption receipts cannot bypass the schema refusal. File SHA256 is unchanged after each refusal, and the extra row/index survives. Notes baseline pending migration and current/no-op paths are both included.
- Actual ANALYZE creates sqlite_stat1; actual sqlite_autoindex objects are present. They remain excluded from application fingerprints/proofs; adoption, forward migration where applicable and checked no-op succeed.
- **2/2 compatibility cases**, exit0: exact native279c CLI sources create new provisional Notes/Signal databases, followed by synthetic writing. Exact successor inventory and migrate each exit1 with owning ledger SQL/review checksum mismatch. File bytes and every original metadata row remain unchanged. This proves refusal without restamping; it does not approve a transition for retained provisional databases.
- Focused seven-file lint: exit0, 0errors/0warnings. The existing React autodetection console notice from using the external dependency installation is retained separately; no TSX is in scope. No full App build, broad suite or provider test was run or claimed.

Exact commands, working directories, source/input hashes, native test log, six actual positive CLI calls, negative CLI checks, disposable databases and compatibility command stderr/exit codes are preserved in the ZIP. The native test command is:

```text
Node22 --test --test-concurrency=1 scripts/db/notes-signal-migrate.test.mjs
```

The fresh owning worktree has no node_modules installation. A retained Node module.register resolver redirects only unresolved @libsql/client to the existing principal dependency installation using native ESM import conditions. Native .mjs source and actual CLI wrappers execute without transformation, bundling, junction or DB/provider stub. Child CLIs inherit only the same resolver, OS keys and isolated disposable TEMP/TMP. Existing libSQL client0.17.3 is read only. The original author279c CJS-based evidence stays historical; the original principal native21 proof remains a separate retained receipt.

## Provenance and compatibility

The clean application fingerprints are unchanged. The proof text changed, so review receipt IDs and checksums changed explicitly. The existing metadata verifier intentionally refuses provisional old registrations; this repair does not silently amend review/execution metadata, pretend migration SQL ran again, force adoption or provide a compatibility conversion. Any retained fixture transition needs a separately reviewed decision.

20 unchanged source inputs have matching parent Git blobs; 28 current source readbacks bind this packet. All seven original sealed chat output files match their recorded SHA256 values, including the original archive2cb8c931c2c9e6075b0a669fd15e43ad15e474a51b9a3c4011387ef2cb9349fd. Twenty selected principal report/script/log/JSON/database files were copied byte-for-byte; originals remain in place. No failed receipt was overwritten. Preliminary and final successor runs all passed; the four original MIG-01 failures remain explicit.

## Review and operational limits

Principal still owns independent acceptance, command/CI registration and the canonical operational-row update. Suggested scoped wording after review: “MIG-01 successor53295ee7 locally verifies literal SQLite internal-prefix classification and immutable predecessor receipts;48 native groups and2 original-registration refusal cases pass. Original279c/efca evidence remains historical/unaccepted. Actual production inventory/adoption, retained-fixture compatibility and backup/restore acceptance remain open.” No change to programme closure or launch permission is implied.

These are local/test file databases with strict known schema profiles. Live legacy schemas/foreign chains have not been inventoried or reconciled. BackupEvidence requires a reference/hash but does not certify the referenced backup or production restore. Cross-process file replacement, network filesystems, remote-driver behavior and actual production adoption remain unverified. Jan21 external hold remains. No remote/provider/production operation, held review/test retry, general runtime abstraction or new coordination architecture occurred.

Worktree tracked source is clean. Four pre-existing untracked shared hooks remain untouched; per-command empty hooks avoided unrelated workflows without changing shared configuration. No servers are running for this lane. Next action: principal reviews exact53295ee7 and this separate evidence commit; preserve the predecessor packet.

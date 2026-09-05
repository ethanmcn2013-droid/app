# Timeline database migrations

New adoption receipts require `schemaFingerprintVersion: "sqlite-schema/2"`
and the complete current schema fingerprint. Existing unversioned receipts stay
immutable and may only replay an exactly recorded adoption. The no-op result
labels any historical fallback and reports the complete current fingerprint
separately. See [compatibility and operator limits](../drizzle/receipts/local-schema-enumeration-2026-09-05/REPLAY.md).

`drizzle-timeline/migration-ledger.json` is the migration authority for the
Timeline database. It binds every SQL file to an order, a canonical LF
SHA-256, an execution policy, a Drizzle journal entry, a content-addressed
review receipt and snapshot, a rollback plan, and machine-verifiable
postconditions — the same discipline `drizzle/migration-ledger.json` carries
for Tasks, with one difference that changes the whole procedure.

## The two-history seam

Production's Timeline schema was migrated from a different repository
(`timeline.git`) as a standalone `0000–0007` chain. This repository carries a
single consolidated `0000_timeline_baseline.sql`. The two describe the same
schema and share not one hash (`drizzle.timeline.config.ts:5-10`).

**The consolidated baseline is therefore never replayed.** Every statement in
it is a `CREATE`, so running it against production would attempt to create
tables over live couple data. The runner refuses it on any database that
already has application objects and says so:

```
existing database has no Timeline migration ledger; run receipt-backed adopt
instead of executing the consolidated baseline
```

The foreign chain's own high-water table, `__drizzle_migrations`, is **read and
fingerprinted, never written**. Adopting somebody else's history is honest;
rewriting it is not. This repository's runner keeps its own namespaced ledger
table, `signal_timeline_schema_migrations`.

## Commands

| Command | What it does |
|---|---|
| `pnpm timeline:db:status` | Read-only. Reports `fresh`, `adoption-required`, `pending` or `current`, plus the observed legacy chain. |
| `pnpm timeline:db:dry-run` | Writes nothing to the target. Reports the plan and, for a local file, rehearses the whole apply on a `VACUUM INTO` copy — twice, to prove the second run is a no-op. |
| `pnpm timeline:db:migrate` | Applies pending forward migrations, each in one atomic batch with its receipt's proofs as in-transaction guards. |
| `pnpm timeline:db:adopt` | Registers an existing database's exact fingerprint as `adopted_legacy`. One metadata row; no schema change. |

`timeline:db:push:unsafe` remains available for disposable local schema
forensics and must never reach a remote database. Remote targets additionally
require `--environment` and `--confirm-production=timeline`, and pending
migrations require a `timeline-migration-execution/1` receipt.

## Production order (plan §12)

Nothing below may run without founder authorization.

1. Back up the Timeline database and **verify the restore**. Both receipts
   become the adoption receipt's `operatorEvidence` (two entries minimum).
2. Fingerprint the target: `pnpm timeline:db:status` records the legacy chain's
   row count and hash digest; `timelineSchemaFingerprintSha256` records the
   schema.
3. Run the **read-only inventory** (`pnpm timeline:db:inventory`) against Tasks
   and Timeline. It cannot write.
4. Restore the verified backup into an **isolated copy** and point
   `--database-url` at it. Run `adopt`, then `migrate`, then `migrate` again to
   prove the no-op, then the backfill in dry-run and apply modes.
5. Only then, against production: `adopt` with the receipt, `migrate` with a
   `timeline-migration-execution/1` receipt, the exact-only backfill, and a
   post-migration inventory.
6. Record backup id, adopted-ledger fingerprint, migration hashes, start/end
   times, row counts, postconditions, and the operator manifest's location.

## Current forward migration

`0001_suite_project_bindings.sql` is additive: two new tables
(`suite_project_bindings`, `timeline_source_sync_state`) and one index on the
legacy `projects.source_tasks_workspace_id`. No existing table is altered and
no row is read or written. Both legacy mirrors — `workspaces.suite_workspace_id`
and `projects.source_tasks_workspace_id` — are kept and still dual-written, so
a rollback dual-read resolves the same exact rows.

The new tables start **empty**. Populating them is the separately-authorized
exact-only backfill (`scripts/db/timeline-backfill-bindings.mjs`), which is
dry-run by default and writes only for exact, non-ambiguous evidence.

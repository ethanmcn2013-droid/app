# Tasks database migrations

`drizzle/migration-ledger.json` is the migration authority. It binds every SQL
file to an order, canonical LF SHA-256, execution policy, Drizzle journal entry,
content-addressed review receipt, optional schema snapshot, rollback plan, and
machine-verifiable postconditions.

The database keeps an exact row per supported runtime migration in
`signal_schema_migrations`. Drizzle's `__drizzle_migrations` table is maintained
only as a compatible high-water mirror. The Tasks runner verifies every exact
row and hash; it never trusts only the greatest timestamp.

## Frozen legacy chain

`0000` through `0013` reached production through a mixture of migration SQL and
historical schema pushes. They are registered as `legacy-adopt-only` evidence.
They must never be replayed against an existing database.

`0014_current_schema_baseline.sql` is the supported fresh-database baseline. It
contains all 24 application tables, 27 named indexes, the two parent/workspace
guard triggers, and the schema constraints represented in `schema.ts`. Normal
fresh databases apply this baseline and then every registered `forward`
migration in order; they do not replay 0000-0013.

## Current forward migration

`0028_project_drive.sql` adds the Project Drive custody model: immutable
provider-connection and board-folder generations, exact folder-permission
receipts, and the resource fields that bind a Drive file to its storage
generation. Existing resources remain `storage='signal'`.

The checked-in review receipt is deliberately **not authorized for
production**. Local and CI application prove the migration now. Production
requires a fresh `tasks-migration-execution/1` receipt covering the exact
ledger, backup, target identity and isolated-copy dry run, plus the founder's
explicit production authorization.

Do not run `drizzle-kit migrate` directly. Its pinned LibSQL runner checks only
the latest timestamp and does not validate historical hashes. Use the Tasks
runner:

```text
pnpm db:status
pnpm db:migrate
pnpm db:bootstrap
```

An existing unledgered database fails closed with `adoption-required`. Adopt it
only with a target-bound production receipt after backup, isolated-copy dry
run, schema fingerprint, integrity check, foreign-key check, and every declared
postcondition passes:

```text
pnpm db:adopt -- \
  --environment=production \
  --confirm-production=tasks \
  --receipt=drizzle/receipts/production-adoption-2026-07-15.json
```

Adoption never executes 0000-0013 or the full baseline SQL. It verifies the
existing schema and then atomically records `0014` as `adopted_legacy` in the
exact ledger plus the compatible Drizzle high-water row. Re-running adoption or
migration is a strict no-op.

## Creating the next migration

1. Change `src/server/db/schema.ts`.
2. Do not run ordinary `drizzle-kit generate` until the snapshot chain is
   deliberately repaired: the latest checked-in snapshot is 0015 while the
   receipt-backed hand-reviewed chain continues through 0028. Blind generation
   from that stale base can repeat already-applied schema. Follow the latest
   hand-reviewed forward migration and journal shape, or repair snapshot
   continuity as its own reviewed package first.
3. Review the SQL and assign it the `forward` policy in
   `drizzle/migration-ledger.json` with its canonical LF SHA-256.
4. Add a `tasks-migration-receipt/1` review receipt containing the exact hash,
   reviewer, authorization, risk, rollback plan, and read-only SQL proofs.
5. Run `pnpm db:contract`. CI rejects extra files, missing files, hash changes,
   journal gaps, missing snapshots, and missing receipts.
6. Before production, create a `tasks-migration-execution/1` receipt with a
   verified backup hash, passed isolated-copy dry run, the exact target database
   identity, environment, ledger hash, and pending migration ids/hashes. Every
   remote database uses this safety path even if an environment flag is omitted
   or misspelled; unknown environment labels fail closed.
7. Run `pnpm db:migrate -- --environment=production
   --confirm-production=tasks --receipt=<execution-receipt>`.

The runner applies each forward migration, its proof guards, and both ledger
rows in one write transaction. If any proof fails, SQL and ledger writes roll
back together.

`db:push:unsafe` remains available only for disposable local schema forensics.
It is not part of development startup, CI, preview, production, or recovery.

## Production evidence retained on 2026-07-15

- 0013 planning-period backup and dry-run receipt.
- 0008-0012 atomic chain backup, dry-run, invariant, integrity, and FK receipt.
- Stable counts after repair: 11 users, 7 workspaces, 11 memberships, 131 tasks.
- Six data invariants at zero, `PRAGMA integrity_check = ok`, foreign-key
  violations = 0.

The committed adoption receipt stores only content hashes and non-secret proof
results. Database credentials and backup bytes stay outside the repository.

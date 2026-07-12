# Tasks database migrations

Normal development and delivery use the reviewed SQL migrations in this
directory:

```text
pnpm db:migrate
```

Fresh disposable local databases can be bootstrapped with:

```text
pnpm db:bootstrap
```

`db:push:unsafe` is retained only for an explicitly approved local recovery or
schema-forensics operation. It is not part of `dev`, CI, preview, or production
delivery. Production migrations require a backup receipt, a dry-run against an
isolated copy, reviewed SQL, post-migration invariant checks, and a rollback
plan in the remediation ledger.

## 0013 Planning Periods

`0013_planning_periods.sql` is the additive Planning Period catalog and legacy
Workspace grouping migration. Read `docs/planning-periods.md` before applying
it. In particular:

- automatic grouping requires exactly one owner membership;
- ambiguous rows are reported and left unchanged;
- every exposed v2 period receives a deterministic finite date horizon;
- no Workspace ID, slug, content row, or share token is rewritten;
- sponsorship rows never grant membership;
- rollback starts by disabling the new production flags, not by dropping data.

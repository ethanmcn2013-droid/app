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

# Remote conversation runtime candidate

This packet adds an explicit remote runtime path to the existing Project
conversation, Task outcome and Task Discussion services. It does not migrate or
contact a remote database. The original local fixture path is unchanged.

Activation requires `SIGNAL_CONVERSATION_INTERNAL_ENABLED=true`,
`SIGNAL_CONVERSATION_DATABASE_MODE=remote`,
`SIGNAL_CONVERSATION_REMOTE_ENABLED=true`, the canonical `TASKS_DATABASE_URL`
(`libsql://`), `TASKS_AUTH_TOKEN`, a non-secret
`SIGNAL_CONVERSATION_REMOTE_TARGET` label, and
`SIGNAL_CONVERSATION_REMOTE_URL_SHA256` equal to the SHA-256 of the exact URL.
The existing `SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS` allowlist remains required
for read; `SIGNAL_CONVERSATION_SEND_ENABLED=true` separately enables writes.
Demo/review modes, missing or mismatched configuration, insecure URL forms and
runtime configuration changes fail closed. Never record the URL or token in a
receipt or log. Rotate either by starting a new runtime instance after changing
its binding.

The receiving integrator must reconcile migration IDs before any remote apply:
this branch uses conversation `0028`–`0031`, while concurrent January work also
uses those numbers for unrelated migrations. No migration or ledger was changed
here. A target must carry the final reconciled schema and pass its receipt-backed
contract before this candidate can operate. Enabling the path does not prove
remote transaction support, primary visibility, real Clerk mapping, performance
or production readiness.

The opt-in `scripts/conversations/probe-remote-transactions.ts` makes a bounded
provider check against a designated isolated remote Tasks test database only.
It requires an `isolated-` target label, exact CLI target and URL fingerprint,
`--confirm-isolated-write`, and a non-production local process. With the above
environment configured, run:

```text
node --import tsx --import ./src/test/register-server-only.mjs scripts/conversations/probe-remote-transactions.ts --target=<isolated-target-label> --expect-url-sha256=<exact-url-sha256> --confirm-isolated-write
```

It opens two independent clients, checks commit visibility, duplicate receipt
identity, rollback and refusal after a membership change. It creates only
synthetic probe tables and removes its rows. This is a transport feasibility
check, not the full authenticated conversation acceptance: later run the actual
Project/DM/Discussion service, Clerk account and migration tests on the named
isolated target before any live-data decision. Record the target label, exact
candidate SHA, commands, pass/fail and limitations without credentials.

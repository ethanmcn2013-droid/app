# Isolated typed command baseline

This source accepts a restricted English syntax, not arbitrary natural language or voice. Examples:

- `assign me and due 2026-10-08 and status doing`
- `unassign me and clear due`
- `create 3 tasks called "Research and review" and status todo`

The whole input must match. Dates are absolute ISO calendar dates; status is one of `todo`, `doing`, `review`, `done`. Creation requires no selected tasks; editing requires 1–10 exact selected ordinary top-level tasks. Unknown, destructive, mixed and duplicate clauses refuse the entire request. No provider is called. Initial typed transport accepts default stored columns only; broader configuration/timezone semantics remain open.

## Disposable setup

Run from the App checkout:

```text
node --import tsx --import ./src/test/register-server-only.mjs scripts/ping/prepare-typed-fixture.ts
```

An optional approved isolated test Clerk user ID may be supplied as the sole argument. This maps the genuine test session to a synthetic user; it does not create a session or bypass Clerk. The setup creates a fresh owned temporary file, canonical synthetic schema, fixture-only receipts, a typed-runtime marker and two ordinary tasks. It emits the local database URL intentionally as a setup receipt, without echoing the mapping ID. No customer environment, production migration or provider access is involved.

Start only the approved isolated local application with `PING_TYPED_ENABLED=1`, the emitted URL assigned identically to `PING_TYPED_DATABASE_URL` and `TASKS_DATABASE_URL`, and genuine isolated Clerk configuration. Runtime defaults off. Hosted Vercel, remote, demo, default file, mismatched targets, absent/outside-temp files and missing markers are refused. Markers establish isolation, not authentication. The runtime requires real Clerk user/session IDs and exactly one same-target stored user mapping; it never uses the development `david` fallback or provisions users. Missing configuration stays unavailable.

## Contract and truth

The five bounded same-origin POST actions at `/api/ping` are prepare, execute, cancel, receipt and refresh. Shared DTOs live in `src/lib/ping/typed-contract.ts`. Prepare treats UI Project/selection/preimages as candidates, verifies current authority and exact rows, captures stored configuration itself, and returns an actor/session-bound opaque token. Actor, session, final-input authority and server original never come from the request or parser. The response does not echo raw input. Same normalized request UUID plus identical payload is idempotent; changed payload conflicts.

Execution uses the existing command service exactly once for the retained original. Response loss, absent/denied receipt or a failed call remains unknown; no executor retry/new command identity is made. Cancellation confirms not invoked only before the latch. A valid completion after cancellation may establish historical commit without authorizing hydration. Receipt retrieval reauthorizes current access; refresh reauthorizes/fence-checks and reads the actual shared canonical active task query in the same read transaction. It uses the canonical mapping, rollups, ordering and 2,000-row cap. JSON Date fields must be checked/restored by the client before same-context provider hydration. Matches/diverged describes relevant current task postconditions, not a mounted browser acknowledgement.

Custody is deliberately finite and process-local: one physical lane per actor/session, at most 32 retained lanes/preparations, a 10-second undispatched expiry, at most 24 receipt reads with no overlap and a 500 ms minimum interval, and at most 3 refresh attempts with a 10-second delivery guard. An explicit new prepare retires a resolved idle lane; 512 bounded retired request identities prevent issuing a new original for an old normalized UUID. Expired/cancelled untouched identities also retire. Saturation refuses new work. Unresolved invoked lanes never expire into permission for another execute. Process restart loses this custody; unavailable old tokens do not establish rollback. Durable reload, account-wide coordination and production availability require later work. The known installed Windows libSQL contention/recreation limitation is preserved.

Offline tests with injected actor/session exercise actual isolated service and SQL effects; they do not establish genuine login. Full natural-language interpretation, provider/voice finality, authenticated mounted browser completion, live latency, edit telemetry/invalidation parity and operated-use gates remain separate. The initial source has no dependency/schema/lock change, production release or external account action.

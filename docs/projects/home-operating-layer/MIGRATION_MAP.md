# Contract · Migration map and persistence architecture

**Status:** Sealed (Wave 1). Binding on every later wave that adds, changes or backfills
persisted state for Home.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Consistent with:** `contracts/PROJECT_SCOPE.md` (sealed) and `DECISIONS.md` D-H01 … D-H13.
It does not redefine Project identity; §5 uses `ProjectId` exactly as `PROJECT_SCOPE.md` §1
defines it.
**Adopts:** `docs/wave/DECISIONS.md` D-011 (the Home Analytics flag), `DEPLOY.md` §4,
`drizzle/MIGRATIONS.md`, `AGENTS.md` "Database release gate".
**Companion:** `ROLLBACK.md` — the five kill boundaries and the flag matrix.
**Defers to, and does not restate:** `contracts/INBOX_EVENT.md` §14–§15 for the Inbox event
shape (§5.1) and `contracts/ANALYTICS_CLAIM.md` §15 for the snapshot writer (§5.4). Both landed
in this worktree from parallel Wave 1 lanes while this contract was being written; where they
overlap, they own the shape and this contract owns the migration architecture around it.
**Decisions taken here:** D-M01 … D-M09 (§11). Lane-scoped ids so they cannot collide with a
concurrent Wave 1 lane also writing `DECISIONS.md`; the lead renumbers them into the `D-Hxx`
series on fold-in.

Changing anything sealed here requires a founder-approved ADR or a lead-owned amendment.
An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

It is the persistence and migration architecture for the Home operating layer: which
databases exist, which of them has a safety net and which does not, what shape every later
wave's schema work takes, and what a backfill must prove before it is allowed to run.

It is **not** a migration. **No migration file, ledger entry, receipt, backfill script or
`package.json` script is written in this wave.** That is stated as a decision (D-M09), not
left as an omission, because three open PRs are contending on `package.json` right now
(`COLLISION_REGISTER.md` §1c) and a fourth writer would be a collision, not a contribution.

Everything below is design that a later wave can execute mechanically.

---

## 1. The databases in play

Six module databases exist. The env convention is one pair per module,
`<MODULE>_DATABASE_URL` / `<MODULE>_AUTH_TOKEN` — stated in source as "the one env
convention" (`scripts/db/backup-all.mjs:43-52`), module list at `scripts/db/backup.mjs:42-49`.

| Module | Env vars | Boot tier | Tracked SQL | Exact ledger | Receipt-backed runner | Production drift alarm | Home's relationship |
|---|---|---|---|---|---|---|---|
| **tasks** | `TASKS_DATABASE_URL` / `TASKS_AUTH_TOKEN` | **fatal in production** (`src/env.ts:14-20`) | `drizzle/` — 28 files | **yes** — `drizzle/migration-ledger.json` | **yes** — `scripts/db/migrate.mjs` | **yes** — `db-migration-drift.yml` | Reads today. Owns Project identity, tasks, notifications, activities. **Home's new stores land here** (D-M02). |
| **signal** (the Home briefing database — legacy name) | `SIGNAL_DATABASE_URL` / `SIGNAL_AUTH_TOKEN` | warn (`src/env.ts:42-43`) | `drizzle-signal/0000_signal_baseline.sql` — **1 file** | **no** | **no** | **no** | Reads today. Holds the briefing engine, `user_preferences`, and the analytics snapshot tables Wave 8 must write. |
| **notes** | `NOTES_DATABASE_URL` / `NOTES_AUTH_TOKEN` | warn (`src/env.ts:31-32`) | `drizzle-notes/` — 2 files | no | no | no | Home never reads a Note body (§8). A Notes-owned outbox is a Wave 6 producer (§7.3). |
| **timeline** | `TIMELINE_DATABASE_URL` / `TIMELINE_AUTH_TOKEN` | warn (`src/env.ts:36-37`) | `drizzle-timeline/` — 1 file | no | no | no | Read through the exact-Project resolver only (`PROJECT_SCOPE.md` §2.2). A Timeline-owned outbox is a Wave 6 producer. |
| **entitlements** | `ENTITLEMENTS_*` | not validated | none in this repo | no | no | no | **Out of scope.** Named so the six-module backup set is not mistaken for four. |
| **studio** | `STUDIO_*` | not validated | none in this repo | no | no | no | **Out of scope.** Same reason. |

`src/env.ts:42` names the Signal database in source, verbatim, as
`"Home briefing database (legacy name; briefing engine + preferences)"`. The legacy name is
not cosmetic: it is why the boundary in §3 is easy to miss.

### 1.1 What lives in the Signal / Home database today

Nine tables, all from one baseline file (`drizzle-signal/0000_signal_baseline.sql`):
`analytics_users`, `planning_events`, `phrasing_rotations`, `briefing_feedback`,
`surfaced_items`, `analytics_view_preferences`, `analytics_metric_snapshots`,
`analytics_snapshot_runs`, `analytics_schema_versions`, plus the folded-in
`user_preferences` (`src/modules/signal/server/db/signal-analytics-schema.ts:21-211` and
`:214-217`). Twelve source files hold a client against it, all through
`signalAnalyticsDb` (`src/modules/signal/server/db/signal-analytics-client.ts:25`).

The schema file's own header says: *"Tables managed by the signal.git migration stream…
DO NOT run migrations against prod from this repo; tables already exist"*
(`signal-analytics-schema.ts:16-18`). That instruction predates the 2026-07-31 data-layer
reset and is now the clearest evidence of the gap in §3: there is a documented prohibition
on migrating it from here, and no documented way to migrate it at all.

---

## 2. The Tasks migration system, exactly as it is

This is the only receipt-backed path in the estate. Every design in §5–§7 is written to
extend it rather than to invent a second one.

### 2.1 The ledger

`drizzle/migration-ledger.json`, `schemaVersion: tasks-migration-ledger/1`, **28 entries**,
append-only in practice because every entry binds an immutable canonical hash.

| Policy | Ids | Meaning |
|---|---|---|
| `legacy-adopt-only` | `0000_flat_blur` … `0013_planning_periods` (14) | Reached production through a mix of migration SQL and historical schema pushes. **Never replayed** (`drizzle/MIGRATIONS.md:15-17`). |
| `baseline` | `0014_current_schema_baseline` (exactly one) | The supported fresh-database baseline — 24 tables, 27 named indexes, two guard triggers (`MIGRATIONS.md:19-23`). |
| `forward` | `0015_notes_extract_exact_identity` … `0027_share_link_token_hash` (13) | The only migrations a runner will execute against an existing database. |

The database keeps an exact row per migration in `signal_schema_migrations`; Drizzle's
`__drizzle_migrations` is maintained only as a compatible high-water mirror, and the runner
"verifies every exact row and hash; it never trusts only the greatest timestamp"
(`MIGRATIONS.md:8-11`).

`drizzle/MIGRATIONS.md:25-32` is stale — it still names `0015` as "the current forward
migration" while the ledger carries forwards through `0027`. **Recorded, not fixed**: that
file is release documentation and correcting it belongs with the next migration that
touches it, not with a contract wave. Later waves must read the ledger, never that heading.

### 2.2 What `loadAndValidateLedger()` fails closed on

Enumerated from `scripts/db/migration-ledger.mjs`; every one of these is a hard throw:

- ledger `schemaVersion`, `dialect`, `databaseLedgerTable`, `drizzleHighWaterTable` not the
  expected values, or zero entries (`:92-97`);
- **`.gitattributes` missing, or missing the exact line `drizzle/*.sql text eol=lf`**
  (`:99-101`) — the LF pin is a validated invariant, not a convention;
- a non-contiguous ordinal, a malformed or duplicate id, a file name that does not match its
  id, a non-increasing `when`, an invalid policy, a `legacy-adopt-only` entry after the
  baseline or a non-legacy entry before it, more or fewer than one baseline (`:112-127`, `:161`);
- a missing SQL file, or **a canonical-LF SHA-256 that does not match the ledger** (`:129-132`);
- a declared snapshot that is missing, mis-hashed or not `sqlite` (`:134-140`);
- a receipt that is missing, mis-hashed, of the wrong `schemaVersion`, or missing
  `authorizedBy` / `reviewedBy` / `authorizationSource` (`:36-54`);
- an entry with zero or more than one record in its receipt, or a record missing
  `reviewedAt`, `risk`, `rollbackPlan`, or with an empty `postconditions` array (`:57-65`);
- a `baseline` or `forward` entry with **no machine-verifiable proofs**, a proof that is not
  a single read-only `SELECT`, a proof containing `;`, a duplicate proof id, or a proof with
  no `expected` (`:67-81`);
- **any top-level `drizzle/*.sql` file not registered exactly once** (`:163`) — an unregistered
  file is a failure, so a migration cannot be smuggled in by adding a file;
- a Drizzle journal that is absent, wrong-versioned, a different length, or disagrees with the
  ledger on index, tag or timestamp, or has `breakpoints !== true` (`:165-175`).

### 2.3 `pnpm db:contract` — the pre-flight gate

`package.json:38` → `node scripts/check-migration-contract.mjs && node --test scripts/db/migration-ledger.test.mjs`.

`check-migration-contract.mjs` gates **the scripts themselves**, so the safe path cannot be
loosened by editing `package.json`:

| Assertion | Line |
|---|---|
| `dev` must not run `drizzle-kit push` | `:12-15` |
| `db:migrate` must be **exactly** `node scripts/db/migrate.mjs migrate` | `:16-19` |
| `db:bootstrap` must start with `${migrate} &&` | `:20-23` |
| `db:adopt` must be exactly `node scripts/db/migrate.mjs adopt` | `:24-27` |
| `db:contract` must itself run the fail-closed ledger tests | `:28-31` |

It then runs `loadAndValidateLedger()` and prints `ok (N SQL files, N receipts, baseline <id>)`.
It runs **first** in both `ci.yml:45-46` and `verify.yml:26`.

### 2.4 The two production paths, and only two

1. **Operator / local** — `pnpm db:contract` → `pnpm db:status -- --environment=production
   --confirm-production=tasks` → author a `tasks-migration-execution/1` receipt carrying the
   verified backup hash, a passed isolated-copy dry run, the exact target database identity,
   environment, current ledger hash and every pending migration id + hash → `pnpm db:migrate --
   --environment=production --confirm-production=tasks --receipt=<file>` (`DEPLOY.md:93-118`).
   The receipt is validated field by field at `scripts/db/migrate.mjs:197-218`; a remote or
   production target with pending migrations and **no** receipt is refused at `:198`.
2. **CI** — the `db-migrate` workflow with `command=execute` (`db-migrate.yml:76-82`), which runs
   `scripts/db/execute-production-migration.mjs`: logical backup → restore into an isolated
   local copy and apply the pending forwards there → write the execution receipt → the real
   apply through `migrate.mjs`, which re-validates everything inside one write transaction.
   Evidence is retained 90 days as the `db-migration-evidence` artifact (`db-migrate.yml:91-99`).

The runner applies each forward migration, its proof guards and both ledger rows **in one
write transaction**; if any proof fails, SQL and ledger writes roll back together
(`MIGRATIONS.md:88-90`). An existing unledgered database fails closed: `status` reports
`adoption-required` when the database has objects but no exact ledger rows
(`migrate.mjs:449`), and `migrate` refuses outright — *"existing database has no exact
migration ledger; run receipt-backed adopt instead of executing legacy SQL"*
(`migrate.mjs:308`). Adoption then needs its own target-bound receipt (`:220-243`).

### 2.5 The drift alarm

`db-migration-drift.yml` runs `scripts/db/check-prod-migrated.mjs` on every PR to `main`,
every push to `main`, daily at 07:00 and on dispatch. It exits **1** when production is behind
the source ledger and **2** when `TASKS_DATABASE_URL` / `TASKS_AUTH_TOKEN` are absent
(`check-prod-migrated.mjs:10-15`, `:24-30`). It is read-only.

### 2.6 Explicitly forbidden, in every wave

- **Never** `drizzle-kit push` or `drizzle-kit migrate` against production. `drizzle-kit
  migrate`'s pinned LibSQL runner checks only the latest timestamp and does not validate
  historical hashes (`MIGRATIONS.md:42-44`).
- **Never** replay `0000`–`0013`. The chain is non-idempotent (`AGENTS.md` "Database release
  gate"; `MIGRATIONS.md:15-17`).
- **Never** paste an individual `drizzle/*.sql` into production (`DEPLOY.md:95-97`).
- `db:push:unsafe`, `notes:db:push:unsafe`, `timeline:db:push:unsafe`,
  `signal:db:push:unsafe` are for disposable local schema forensics only — "not part of
  development startup, CI, preview, production, or recovery" (`MIGRATIONS.md:92-93`).
- No migration is applied as a side effect of a merge. Applying stays a deliberate,
  receipt-gated operator action (`db-migration-drift.yml:3-5`).

---

## 3. The Signal / Home database has no safety net — D-M01

### 3.1 The gap, stated exactly

`DEPLOY.md:126-137` is the primary source, and it is blunt:

> `pnpm db:migrate` and the continuous `db-migration-drift` workflow cover the Tasks
> database only. […] **A SQL file in the repository is not proof that a module database was
> changed in production.**

For the database that holds Home's briefing data, concretely:

| Protection | Tasks | Signal / Home |
|---|---|---|
| Exact append-only ledger with per-file canonical hashes | yes | **none** |
| Registered review receipt with risk, rollback plan and machine-verifiable proofs | yes | **none** |
| Receipt-backed runner refusing to run ahead of the ledger | yes | **none** |
| Production execution receipt binding backup + dry run + target identity | yes | **none** |
| Single-transaction apply with proof-guard rollback | yes | **none** |
| `adoption-required` fail-closed on an unledgered database | yes | **none** |
| Continuous production drift alarm | yes | **none** |
| `.gitattributes` LF pin as a validated invariant | yes (`drizzle/*.sql` only) | **none** — the pin covers `drizzle/*.sql` and nothing else |
| Backup coverage | yes (`--modules=tasks` in `db-migrate.yml:85`) | **capable but unscheduled** — `backup-all.mjs` supports `signal` (`backup.mjs:42-49`), nothing runs it on a schedule (`backup-all.mjs:20-24` records the scheduling decision as the founder's, deliberately not taken) |

The only change mechanism that exists for it today is `signal:db:push:unsafe`
(`package.json`), which is `drizzle-kit push --force` and is prohibited against production
by §2.6.

### 3.2 D-M01 · Wave 1 records the Signal / Home database as **UNPROTECTED**

**Decision.** Wave 1 does **not** bring it under the receipt-backed runner. It records it as
unprotected, and makes bringing it under the runner a **hard precondition gate (G-DB1)** that
must be closed before the first Home-programme write to that database — which by D-M02 is not
until Wave 8.

**Rationale.**

1. Generalising the runner means editing `scripts/db/*` **and** `package.json`. `package.json`
   is being edited by PRs #126, #128 and #129 simultaneously (`COLLISION_REGISTER.md` §1c) and
   is on this lane's forbidden list. A fourth concurrent writer is a collision.
2. `check-migration-contract.mjs:16-27` pins `db:migrate` and `db:adopt` to **exact strings**.
   Any generalisation changes those strings and therefore changes the gate that protects them.
   That is a lead-owned change to the safety mechanism itself, taken deliberately on a merged
   base, not smuggled into a contract wave.
3. Nothing is at risk yet. Waves 1–3 introduce no schema at all, and D-M02 puts the Inbox and
   assignment stores in the Tasks database, which already has the net. The exposure window
   opens only when Wave 8 writes snapshots.
4. Recording it is the honest output. Doing it badly — a half-generalised runner with a
   Tasks-shaped receipt schema — would be worse than the current state, because it would look
   like protection.

**What "unprotected" means for release safety, concretely.** Until G-DB1 closes:

- A schema change to that database in production is **unobservable from this repository**. No
  gate, no test and no workflow can tell whether `drizzle-signal/0000_signal_baseline.sql`
  describes the live schema. A green CI run says nothing about it.
- A Home release therefore cannot claim "the database is current". It may only claim "the Tasks
  database is current", which is what `check-prod-migrated.mjs` actually proves.
- There is **no rollback plan on file** for any change to it, because there is no receipt to
  carry one. `ROLLBACK.md` §2.5 consequently treats every Signal-database state as
  forward-only.
- A code path that assumes a column exists there will fail at runtime, not at deploy time. The
  boot validator does not help: `SIGNAL_DATABASE_URL` is only a **warn** tier
  (`src/env.ts:42-43`), and the validator skips entirely when `NODE_ENV !== production` or demo
  mode is on (`src/env.ts:53-54`).
- The evidence harness cannot cover it either: every rendered proof runs in demo mode
  (`experience/playwright.config.ts:59-76`), and `SIGNAL_ANALYTICS_V1_ENABLED` is pinned false
  at `:73`.

**Consequence.** `RISK_REGISTER.md` R-H14 stays **open** at the end of Wave 1, and is
re-stated here with a named owner and a gate rather than closed by a document.

### 3.3 G-DB1 · What "under the runner" requires — the mechanical checklist

So Wave 8 does not have to re-derive this. Each item is lead-owned.

1. **Generalise the runner by module, not by copy.** `scripts/db/migrate.mjs` already
   parameterises the target through `databaseUrl` and `databaseIdentitySha256()` (`:33-39`) and
   already validates a `supportedEnvironments` set (`:42`). What is hard-coded is the ledger
   path (`migration-ledger.mjs:91`, `drizzle/migration-ledger.json`), the receipt
   `schemaVersion` strings (`migrate.mjs:202`, `:225`), the `.gitattributes` pin
   (`migration-ledger.mjs:100`) and the `--confirm-production=tasks` token (`migrate.mjs:493`).
   All five become module-parameterised. Nothing else in the runner is Tasks-specific.
2. **Author `drizzle-signal/migration-ledger.json`** with `schemaVersion:
   signal-migration-ledger/1`, one `baseline` entry for the existing
   `0000_signal_baseline.sql`, and no `legacy-adopt-only` entries. Receipt schemas become
   `signal-migration-receipt/1` and `signal-migration-execution/1`.
3. **Extend `.gitattributes`** with `drizzle-signal/*.sql text eol=lf` before the ledger's
   pin check is generalised, or the loader throws.
4. **Adopt, do not baseline.** The production database already exists with rows. It must enter
   through the **adoption** path (`migrate.mjs:389-430`), which verifies the existing schema
   fingerprint and atomically records the baseline as `adopted_legacy` — it never executes the
   baseline SQL. Adoption refuses an empty database (`:397`) and refuses an unreceipted Drizzle
   high-water history (`:421`).
5. **Extend `db-migration-drift.yml`** to a second job over `SIGNAL_DATABASE_URL` /
   `SIGNAL_AUTH_TOKEN`. Note `check-prod-migrated.mjs:10-15` exits 2 without secrets, so a fork
   PR turns it red for an unrelated reason (`audit/D-baseline-release.md` §2.6) — the new job
   needs the same treatment as the existing one, whatever that turns out to be.
6. **Extend `check-migration-contract.mjs`** so the new script strings are pinned exactly as
   `db:migrate` is, otherwise the new path is protected by nothing.
7. **Add `signal` to the scheduled backup set** before the first write, or the "restore a
   backup into an isolated database" step of `ROLLBACK.md` §5 has no backup to restore.

**Acceptance.** G-DB1 is closed when `node scripts/db/migrate.mjs status
--module=signal --environment=production --confirm-production=signal` reports `current`
against production, from CI, with the drift job green — and not before.

---

## 4. Expand → migrate → contract, sealed

Every schema change in this programme is additive first. Three phases, three separate
releases, never compressed.

| Phase | What it may do | What it may never do | Release rule |
|---|---|---|---|
| **Expand** | add tables, add nullable columns, add indexes, add triggers that only guard new state | change a column type, add a NOT NULL without a default, rename, drop, or narrow a constraint | Ships **before** any code that reads the new shape. Old code must run unchanged against the expanded schema — that is the property that makes deployment rollback safe (`ROLLBACK.md` §2.5). |
| **Migrate** | dual-write new and old, backfill under §6, dual-read with old as the source of truth, then flip the read to new | drop the old shape, stop writing the old shape | Ships behind a flag. The observation window (`ROLLBACK.md` §6) runs entirely inside this phase. |
| **Contract** | stop writing the old shape, then in a **separate later release** drop it | run inside an observation window, or in the same release as its expand | Requires a fresh founder decision naming the exact columns being dropped, and a receipt whose `rollbackPlan` states honestly whether the drop is reversible. |

**Sealed rules.**

1. **No `contract` phase ships in this programme.** Every store below expands and migrates;
   the drop is scheduled out, deliberately, with its own authorization. The precedent is in
   the repository: `0027_share_link_token_hash`'s receipt states that once the backfill has
   moved any row, rolling back "is a data-loss operation on the affected links, not a
   reversal" — a drop whose reversibility depends on data state is not an incident-path action.
2. **Backward compatibility is a property of the schema, not of the code.** After every
   expand, the immediately-previous production deployment must still run correctly. This is
   what makes "deployment rollback does not roll back the database" survivable
   (`ROLLBACK.md` §2.5).
3. **One concern per migration.** The ledger binds one canonical hash per file; a migration
   carrying two unrelated changes cannot be rolled forward past one of them.
4. **Every migration's receipt carries a real `rollbackPlan`,** and the plan states the
   condition under which it stops being valid. `loadAndValidateLedger` already refuses a
   receipt without one (`migration-ledger.mjs:63`); this contract additionally forbids the
   string "none" or "n/a".
5. **Proofs are postconditions, not intentions.** Each receipt's `proofs[]` must include at
   least one read-only `SELECT` that fails if the migration did not take effect, and at least
   one that fails if it took effect twice.

---

## 5. The schema work, wave by wave

Design only. No SQL is written in this wave. Column lists are the specification a later wave
generates from `src/server/db/schema.ts`, per `MIGRATIONS.md:69-87`.

### 5.0 D-M02 · New Home stores land in the **Tasks** database

**Decision.** The Inbox event store (§5.1), normalized assignments (§5.2) and the visibility
revision register (§5.3) are created in the **Tasks** database. The analytics snapshot tables
(§5.4) stay where they already are, in the Signal / Home database.

**Rationale.**

- The Tasks database is the only one with a ledger, a receipt-backed runner and a drift alarm
  (§1). Putting new state anywhere else means creating it unprotected.
- Home's dominant Inbox producers already live there: `notifications`
  (`src/server/db/schema.ts:569-591`), `activities` (`:519`), `workspace_members` (`:458-477`)
  and the Project row itself (`:272-277`). Two of the three are the same tenant boundary.
- The Charter locks "one canonical Inbox: one route, one event store" (locked decision 6). An
  event store split across two databases is two stores with one name.
- The snapshot tables are not moved because moving live tables is a larger and riskier change
  than protecting them, and because `analytics_metric_snapshots` /
  `analytics_snapshot_runs` / `analytics_schema_versions` already exist with the right shape
  (`signal-analytics-schema.ts:133-211`). Their protection is G-DB1.

**Consequence.** The unprotected-database exposure is confined to Wave 8. Waves 6 and 7 run
entirely on the protected path.

### 5.1 Wave 6 — the Inbox event store (new) — **owned by `contracts/INBOX_EVENT.md`**

**Boundary, and why it moved.** `contracts/INBOX_EVENT.md` was authored by a parallel Wave 1
lane in this worktree while this contract was being written. It owns the Inbox event **shape**
and specifies it in full: three tables (`inbox_events`, `inbox_event_states`,
`inbox_source_action_attempts`), their exact columns, their `CHECK` constraints, their indexes,
the dedup rule, the retention horizon and the E1–E4 / M1–M3 / C1–C3 sequence
(`contracts/INBOX_EVENT.md` §14, §15).

**That contract is canonical for the schema. This one does not restate it, and does not compete
with it.** What follows is only what this contract owns: the migration-architecture obligations
that shape must satisfy.

**Independent convergence, recorded.** Both lanes chose the **Tasks** database for the same
three reasons, reached separately — the canonical Project id and membership live there, and it
is the only database under the receipt-backed runner with a drift alarm
(`contracts/INBOX_EVENT.md` §14 opening; D-M02 above). Two independent reads, one answer. That
agreement is worth more than either statement alone and neither is amended.

**Obligations this contract places on it.**

| # | Obligation | Source |
|---|---|---|
| 1 | `0028_inbox_events.sql` is registered in `drizzle/migration-ledger.json` with policy `forward`, canonical LF SHA-256, a `tasks-migration-receipt/1` review receipt carrying `risk`, a real `rollbackPlan` and non-empty `postconditions`, plus at least one read-only `SELECT` proof. Otherwise `loadAndValidateLedger` throws and `db:contract` fails. | §2.2, §4 rule 4 |
| 2 | Every top-level `drizzle/*.sql` file must be registered exactly once — an unregistered file fails the loader (`migration-ledger.mjs:165`). The migration cannot be added by dropping in a file. | §2.2 |
| 3 | It reaches production only through `pnpm db:migrate` with a `tasks-migration-execution/1` receipt, or the `db-migrate` workflow with `command=execute`. Never `drizzle-kit push`, never `drizzle-kit migrate`. | §2.4, §2.6 |
| 4 | The M1 backfill of historical `notifications` rows satisfies **all five** backfill properties of §6, and produces **two** receipts — the second showing `rowsWritten = 0`. Gate G-DB5. | §6 |
| 5 | The M1 backfill runs **outside** the migration transaction. | §6.2 rule 1, D-M08 |
| 6 | Cross-product events are produced through a **source-owned outbox** (§5.5), never by a direct cross-database insert from a source action. | D-M07 |
| 7 | Each event row carries the visibility revision it was recorded under (§5.3), so a row recorded under a wider membership than the reader now holds renders `stale`, not `ready`. This is an **addition** to `contracts/INBOX_EVENT.md` §14's column list and is recorded here as a divergence for the lead, not applied silently. | §5.3, D-M06 |
| 8 | `notifications.read_at` stays unwritten. It has no writer today (`src/server/db/schema.ts:586`; `REPOSITORY_TRUTH.md` finding 7) and this programme adds none, so a deployment rollback finds it exactly as it was. | `ROLLBACK.md` §6 |
| 9 | The client `localStorage` read state (`src/components/app/inbox/inbox-app.tsx:210-212`) is never imported into the server store. It is per-device and unauthenticated; importing it would fabricate a server fact from a client claim. `contracts/INBOX_EVENT.md` M1 reaches the same conclusion from the other direction — there is no read state to backfill. | §6.2 rule 2 |
| 10 | `notify()` is not modified by Wave 6. Its early return when a payload carries no `taskId` (`src/server/db/notifications.ts:40-47`) stays; workspace-level events arrive through the outbox. Editing it would touch the daily-digest lane's working set (`COLLISION_REGISTER.md` §1b). | Collision register |

**Honesty requirement this contract adds.** An undrained outbox, a missing producer or a failed
delivery renders the Inbox as **behind** — with the last delivered instant and the outstanding
count — never as an empty Inbox and never as "all clear". `suite_outbox` already carries the
signals needed to say so: `delivered_at`, `attempts`, `last_error`
(`src/server/db/schema.ts:203-207`).

### 5.2 Wave 7 — normalized `task_assignments`

**The audit shows JSON assignment cannot support exact cross-Project queries.** Three
independent reasons, all in `audit/B-domain-permissions.md:365-405`:

1. `assignees` is a JSON text column with no index — `src/server/db/schema.ts:53-56`; the
   index list is `:156-171` (`workspace_id`, `parent_task_id`, `(workspace_id, lane)`,
   `due_at`, `(workspace_id, is_milestone)`, `source_note_id`). There is no `task_assignees`
   table anywhere.
2. The only assignee-scoped read is a **`LIKE`**, not an equality:
   `like(tasks.assignees, `%"${escapedId}"%`)` at `src/server/db/queries.ts:335`, duplicated in
   the digest at `src/server/db/daily-digest.ts:76`. It is a full scan per Project, cannot use
   an index, and is exact only by the surrounding double-quote convention. Its host
   `getTasksForUser` is workspace-scoped by construction and has **zero callers**.
3. The shipped cross-Project read groups by **Project, not assignee** — `listYourWorkForUser`
   never touches `assignees` (`src/server/planning/queries.ts:67-137`).

**Therefore: normalize.** Expand adds `task_assignments`:

| Column | Shape | Note |
|---|---|---|
| `task_id` | text NOT NULL | FK → `tasks.id`, `onDelete: cascade`. |
| `user_id` | text NOT NULL | Not an FK to `users` — see below. |
| `workspace_id` | text NOT NULL | Denormalized deliberately, so "assigned to me across all Projects" is one indexed read and never a join through `tasks` per Project. |
| `assigned_at` | integer NOT NULL | |
| `assigned_by` | text NULL | Null for backfilled rows — unknown stays unknown. |
| `source` | text NOT NULL | `backfill` / `action`. A backfilled row is never presented as an audited assignment. |
| `member_at_backfill` | integer NULL | `1` / `0` / null. See below. |

PK `(task_id, user_id)`. Indexes `(user_id, workspace_id)` and `(workspace_id, user_id)`.

**`user_id` is deliberately not a foreign key.** Nothing validates that an assignee is a
member: `assignees` is in `PATCHABLE_TASK_COLUMNS` (`src/server/actions/tasks.ts:370`) and is
written straight through (`:419-424`, `:445-448`), and `addTaskAction` writes
`input.assignees ?? []` unchecked (`:561`). A foreign key would make the backfill fail on real
production rows, and "the backfill crashed" is not the same finding as "these rows are
assigned to non-members". `member_at_backfill` records the fact at backfill time so the
product answer — still open, owned by Wave 7 (`PROJECT_SCOPE.md` §13 item 6) — can be applied
later without re-deriving it, and so My work can disclose the count rather than silently
dropping or silently showing those rows (`PROJECT_SCOPE.md` §3.1 consequence 3).

**Backfill.** From the JSON column via `json_each` — the idiom already exists in the estate for
tags at `src/modules/signal/server/analytics/policy.ts:213-216`. Under §6 in full.

**Migrate.** Dual-write: every writer of `assignees` writes both, in the same transaction.
Reads move to `task_assignments` one surface at a time. `queries.ts:335` and
`daily-digest.ts:76` are **not** rewritten by this programme — `daily-digest.ts` is
foreign-owned (`COLLISION_REGISTER.md` §1b) and `getTasksForUser` is dead code whose removal is
a separate cleanup.

**Contract.** Dropping `tasks.assignees` is **out of scope** and needs its own founder
decision. It is read by shipped surfaces and by the analytics mirror; a drop is not reversible
once writers stop.

### 5.3 Visibility / access revisions

**The problem this solves, and the one it does not.** Membership is revalidated per request and
Home adds no membership cache (`PROJECT_SCOPE.md` §3 rule 4) — live authorization is already
correct. The exposure is in **stored derived state**: an analytics snapshot or an Inbox event
computed under a membership set that has since changed. Serving it as current would present a
number derived from access the reader no longer has.

**This is a truth mechanism, not an authorization mechanism.** Seam 1 still authorizes every
read (`PROJECT_SCOPE.md` §3, D-H02). The revision register only decides whether a stored
derived row may be described as **current** or must be described as **stale**.

**Expand.** `project_visibility_revisions` in the Tasks database:

| Column | Shape |
|---|---|
| `workspace_id` | text PK |
| `revision` | integer NOT NULL |
| `changed_at` | integer NOT NULL |
| `reason` | text NOT NULL — `member-added` / `member-removed` / `role-changed` / `archived` / `unarchived` |

Every derived row (`inbox_events.visibility_revision`, and the snapshot column in §5.4) stores
the revision it was computed under. A read whose stored revision is behind the current one
renders `stale` in the existing coverage vocabulary — `ProviderCoverageStatus` is already
`ready | partial | stale | unavailable | unsupported`
(`src/modules/signal/lib/analytics/contracts.ts:227-232`). Home extends that vocabulary rather
than inventing a second one (`PROJECT_SCOPE.md` §5 rule 7).

**Precondition, not our edit.** The bump must be written in the same transaction as the
membership change, which means editing `src/server/actions/settings.ts` (invite redemption,
member management, Project delete) and `src/server/actions/planning.ts` (Project delete). Those
are foreign-adjacent action files under active migration by the Project Truth lanes. Recorded
as **G-DB3**, owned by the lead, sequenced after those lanes merge. Until it closes, no
derived row may be described as current.

**Fail-closed default.** A missing revision row is **not** revision 0. It is `unknown`, and a
derived row whose basis cannot be established renders `stale`, never `ready`.

### 5.4 Wave 8 — analytics snapshots

**What exists.** The tables, and nothing that writes them.

- `analytics_metric_snapshots` (`signal-analytics-schema.ts:133-172`),
  `analytics_snapshot_runs` (`:176-199`), `analytics_schema_versions` (`:203-211`) — all
  present in `drizzle-signal/0000_signal_baseline.sql:1-37`.
- `captureWorkspaceSnapshots` (`snapshots.ts:244`) has **zero callers repo-wide**; a grep over
  `src/` returns its definition and nothing else. Independently confirmed by
  `docs/wave/ANALYTICS_TRUTH.md` R7 and `audit/B-domain-permissions.md:546-572`.
- `listEligibleSnapshotWorkspaces` is also uncalled, and its eligibility boundary is
  `analytics_users.linked_workspace_id IS NOT NULL` — **one Project per user, not all of them**
  (`snapshots.ts:57-66`).
- `vercel.json:3-8` declares exactly **one** cron, `/api/cron/digest?send=1`. There is no
  snapshot job to disable, because there is no snapshot job.

So Analytics history is a read path over an empty table, and every history read returns
`insufficient_history` (`snapshots.ts:50-54`).

**The writer, the metrics and the schedule are owned by `contracts/ANALYTICS_CLAIM.md` §15**,
authored by a parallel Wave 1 lane in this worktree. That contract keeps
`captureWorkspaceSnapshots` as the unit of work, canonicalises `snapshot_at` to the UTC day
boundary, renames `project_id` to `label_id` while introducing a real `project_id` carrying a
canonical `ProjectId`, and specifies leases, retries and versioning. This contract does not
restate any of that.

**This contract answers the question that contract left open.** `ANALYTICS_CLAIM.md` §open item
6 records that the `SIGNAL_*` database has no drift alarm and no receipt-backed runner, and
leaves the choice as *"either it comes under the receipt-backed runner before the writer is
enabled, or the exposure is accepted explicitly"*. **D-M01 takes the first branch: G-DB1 closes
before the writer is enabled.** That is now decided, not open.

**Migration-architecture obligations on that work.**

| # | Obligation |
|---|---|
| 1 | Every schema change to the Signal / Home database — including the `project_id` → `label_id` rename — is **additive first** and happens **after G-DB1**, through a `signal` ledger entry with a receipt, a rollback plan and machine-verifiable proofs (§3.3). Until G-DB1 closes there is no compliant way to change that database at all. |
| 2 | A rename is never done in place. Expand adds the new column; migrate dual-writes and backfills under §6; the old column is never reinterpreted. `ANALYTICS_CLAIM.md` §15.3 states the same rule — recorded as agreement. |
| 3 | The backfill from `project_id` to `label_id` satisfies all five properties of §6 and produces two receipts (G-DB5). |
| 4 | Each snapshot row carries the **visibility revision** it was computed under (§5.3). A row whose basis cannot be established renders `stale`, never `ready`. Recorded here as an addition to `ANALYTICS_CLAIM.md` §15.3's column list, for the lead to fold in. |
| 5 | Each snapshot row carries an enumerated, **non-content** basis disclosure: provider set, capability set, Projects read and Projects unresolved. `ProjectSetResult.coverage` already distinguishes `complete \| partial \| unavailable` (`PROJECT_SCOPE.md` §11.1); persisting it is what stops a stored partial number being re-read as complete. `safeCoverage` (`snapshots.ts:455-464`) and `scalarSnapshotAggregate` already guarantee no source content is persisted — this contract seals that rather than relying on it. |
| 6 | `analytics_snapshot_runs` records **why** a Project was in or out of a run, so an absent Project is explainable rather than invisible. |
| 7 | `analytics_schema_versions` is used as the per-stream metric-version ledger. It is not repurposed and no second version register is created. |

**Eligibility is not authorization.** Whatever `listEligibleSnapshotWorkspaces` returns decides
only **what gets captured**. Every read still authorizes through seam 1 (`PROJECT_SCOPE.md` §3,
D-H02). A wider capture set must never become a sixth membership seam — that is an automatic
veto. `ANALYTICS_CLAIM.md` §15.2 keeps the `linked_workspace_id` boundary for V1 and discloses
its consequence; this contract adds only the prohibition.

**Job.** Gated by `SIGNAL_ANALYTICS_JOBS_ENABLED`, default off, fail-closed (`ROLLBACK.md` §3).
Adding the second cron entry to `vercel.json` is a Wave 8 deliverable, is release-affecting, and
interacts with the deployment plan's cron limits (`ANALYTICS_CLAIM.md` §open item 5 — open,
lead/founder).

**Honesty requirement.** With the job off, or newly on, history is genuinely insufficient.
`insufficient_history` and `unavailable` are distinct from each other and both are distinct
from zero. A frozen or absent series is never rendered as flat, as healthy, or as complete
(Charter locked decision 11).

### 5.5 Source-owned transactional outboxes

**What exists — and the part that is easy to over-read.**

- `suite_outbox` exists in the Tasks database (`src/server/db/schema.ts:193-210`), with
  `event_id` UNIQUE, `delivered_at`, `attempts`, `last_error`, and indexes
  `(delivered_at, occurred_at)` and `(workspace_id, occurred_at)`.
- The producer helper `appendOutboxEvent` exists (`src/server/db/outbox.ts:6-21`) with
  `onConflictDoNothing` on `event_id`. **It has zero callers.** A repo-wide grep across `src/`
  and `scripts/` returns only `outbox.ts` itself, `schema.ts`, one entry in
  `src/server/tenant-scope-rules.mjs:140`, and the ledger tamper tests. **Nothing produces an
  outbox event today.**
- The delivery worker exists at `src/app/api/cron/outbox/route.ts`, authorized by `CRON_SECRET`
  with a constant-time compare (`:12-19`), and 503s unless both `OUTBOX_DELIVERY_SECRET` and
  `SUITE_OUTBOX_CONSUMERS_JSON` are configured (`:38-42`).
- **It is not scheduled.** `vercel.json:3-8` declares one cron and it is the digest. Nothing
  drains the outbox.

So the mechanism is real, correct in shape, and completely inert. Wave 6 activates it rather
than replacing it.

**Sealed design.**

1. **Each source database owns its own outbox table**, written in the **same transaction** as
   the source mutation. Tasks reuses `suite_outbox`. Notes and Timeline each need one
   (`notes_outbox`, `timeline_outbox`) in their own databases — a cross-database transaction is
   impossible between separate Turso instances, so an outbox in the consumer's database would
   be a dual-write with no atomicity, which is the exact failure the pattern exists to prevent.
2. **The Inbox event store is the only consumer of record.** Delivery is idempotent on
   `event_id`; the unique index on `inbox_events.event_id` is what makes at-least-once delivery
   safe.
3. **No source writes an Inbox event directly.** A direct cross-database insert from a source
   action is prohibited: it cannot be atomic with the mutation, and it produces an Inbox that is
   silently wrong when the second write fails.
4. **Lag is disclosed, never hidden.** `delivered_at IS NULL` count, oldest undelivered
   `occurred_at`, and `last_error` are the available signals (`schema.ts:203-207`) and Home
   renders the Inbox as **behind** using them. An undrained outbox never renders as an empty
   Inbox.
5. **Notes and Timeline outboxes are unprotected until their databases are** (§3). Recorded as
   **G-DB4**: the same generalisation as G-DB1, per module, before their first outbox write.
6. **Scheduling.** `/api/cron/outbox` must be added to `vercel.json` before the first producer
   ships, with `SUITE_OUTBOX_CONSUMERS_JSON` and `OUTBOX_DELIVERY_SECRET` configured.
   Shipping a producer without a drain fills a table nothing reads.

---

## 6. The backfill contract

Every backfill in this programme satisfies all five properties. A backfill that cannot
demonstrate all five does not run.

### 6.1 The five properties, made mechanical

| Property | What it means here | How it is proved |
|---|---|---|
| **Idempotent** | Re-running over the same source rows produces the same target rows and changes nothing the second time. | Writes use `INSERT … ON CONFLICT DO NOTHING` against a natural key (`(task_id, user_id)` for §5.2, `event_id` for §5.1) — the same idiom already used at `src/server/db/outbox.ts:21`. |
| **Resumable** | A crash, a timeout or a deploy mid-run loses no progress and duplicates nothing. | A watermark row per backfill records the last completed source key and batch number. Resume reads the watermark; it never restarts from zero and never guesses. |
| **Batched** | It never holds a long write transaction, and it never loads the table into memory. | Fixed batch size, ordered by a stable key, one transaction per batch. Explicitly **outside** the migration runner: the runner applies a migration and its proofs in a single write transaction (`MIGRATIONS.md:88-90`), and a long backfill inside that envelope would hold the write lock for its whole duration. |
| **Receipt-producing** | The run leaves committed evidence, not console output. | A `home-backfill-execution/1` receipt modelled on `tasks-migration-execution/1` (`migrate.mjs:197-218`): schema version, id, environment, `databaseIdentitySha256`, ledger hash at run time, source and target row counts before and after, batches completed, rows written, rows skipped, and the verification query results. |
| **Second-run no-op** | Running it again immediately afterwards writes nothing. | The receipt of run 2 must show `rowsWritten = 0` and byte-identical target counts. This is a **required artifact**, not an optional check — a backfill with one receipt is unverified. |

### 6.2 Additional sealed rules

1. **Never inside a migration.** Expand adds the empty table; a separate authorized script
   fills it. This keeps the migration's proofs fast and its transaction short.
2. **Never destructive.** A backfill only inserts into new state. It never updates or deletes a
   source row. If reconciliation is needed, it is a separate, separately-authorized script.
3. **A partial run is a named state.** If a backfill stops at 60%, the surface reading the new
   table renders `partial` with the count read and the count outstanding — never the 60% as if
   it were the whole. This is Charter locked decision 11 applied to our own tooling.
4. **The verification query is written before the backfill runs**, is read-only, and is stored
   in the receipt with its expected result — the same discipline as a ledger proof
   (`migration-ledger.mjs:73-80`).
5. **Production backfills take the CI path.** The credentials already live as repo secrets
   (`db-migrate.yml:78-80`); putting production data on a laptop to run a script is a data
   handling decision nobody has taken, and `backup-all.mjs:20-24` records exactly that
   reasoning about the sibling case.

---

## 7. Cross-database read boundaries

1. **Home never joins across databases.** Each source is read through its own client and the
   results are composed in the application, with per-source coverage. There is no cross-database
   view, no mirror table created by this programme, and no denormalized copy of another
   module's rows into Home storage beyond the enumerated event payload of §8.
2. **A source that fails degrades that source only.** One unavailable Project or one
   unavailable provider does not make the aggregate unavailable, and does not make it complete
   either (`PROJECT_SCOPE.md` §5 rule 7).
3. **The existing read-only Tasks mirror in the signal module is not extended.** It is a
   subordinate adapter (`PROJECT_SCOPE.md` §3, seam 4). This programme adds no data to it and
   no new mirror.

---

## 8. Privacy — what may never enter Home storage

**Sealed.** Home storage never contains a private Note body, a comment body, a task
description, or a broad content snapshot of any source.

**Evidence for the boundary.** `notes.user_id` is the tenant and `notes.workspace_id` is
documented as "Optional projection … Notes never owns or copies Workspace membership. A null
value is the normal, durable 'Unfiled' state" (`src/modules/notes/server/db/notes-schema.ts:54-62`).
The static tenant gate encodes the same thing — Notes' `tenantColumns` is `["user_id"]`
(`src/server/tenant-scope-rules.mjs:177-181`). Audit B calls this seam the best-defended in
the estate (`audit/B-domain-permissions.md:482-525`), and `PROJECT_SCOPE.md` §2.4 seals that
Home does not weaken it.

**The allowed payload.** An Inbox event row carries **ids, enumerated kinds, enumerated status
codes and timestamps** — nothing else. `contracts/INBOX_EVENT.md` §14 already achieves this by
construction: its three tables have typed columns and **no free-text content column at all**.
This contract seals that as a rule rather than leaving it as a property of one sketch, so a
later column addition cannot reintroduce one. The single exception is the one
`PROJECT_SCOPE.md` §2.4 already grants: the **creator-authored approved extract**, which has
already crossed the boundary by the creator's own action, carried only where it is labelled as
such — and it is not carried in an Inbox event row.

**The same rule for analytics.** Snapshots store counts, aggregates and enumerated coverage.
`ProviderCoverage.issues` is already documented in source as "Safe diagnostic codes or
plain-language gaps; **never source content**"
(`src/modules/signal/lib/analytics/contracts.ts:243`). Home does not relax that.

**Enforced, not asserted.** A contract test enumerates the permitted payload keys and fails on
any key outside the set (assertion M8, §10). A privacy boundary defended only by review is
defended for one release.

---

## 9. Gates

| Gate | Statement | Blocks | Owner |
|---|---|---|---|
| **G-DB1** | The Signal / Home database is under the receipt-backed runner with a ledger, an adoption receipt and a drift job. | Any Home-programme write to that database — i.e. Wave 8. | Lead |
| **G-DB2** | `db:contract` green and the Tasks drift alarm green on the release SHA. | Every Home release. | Lead |
| **G-DB3** | The visibility revision bump is written in the same transaction as every membership change. | Describing any stored derived row as current. | Lead, after the Project Truth lanes merge |
| **G-DB4** | Notes and Timeline databases are under the runner. | Their first outbox write. | Lead |
| **G-DB5** | Every backfill has two receipts, the second showing `rowsWritten = 0`. | Enabling any surface that reads the backfilled table. | The wave that runs it |
| **G-DB6** | `/api/cron/outbox` is scheduled and configured. | The first outbox producer shipping. | Wave 6 |

---

## 10. Executable assertions

**Specified here, not written as test files this wave — D-M09.** The reasoning is D-H13's,
unchanged and now stronger: every natural home for these assertions is `scripts/db/*`,
`src/server/db/*` or `package.json`, and `package.json` currently has three concurrent writers
(`COLLISION_REGISTER.md` §1c). A new failing test dropped into a contended file reads as a
boundary breach rather than a scheduling artefact. Each assertion names what makes it fail
today so implementation is mechanical.

| # | Assertion | Must fail today because |
|---|---|---|
| M1 | A `signal` migration ledger exists and `loadAndValidateLedger({ module: "signal" })` passes | there is no ledger and the loader is Tasks-only (`migration-ledger.mjs:91`) |
| M2 | `.gitattributes` pins `drizzle-signal/*.sql` to LF | it pins `drizzle/*.sql` only |
| M3 | `db-migration-drift` covers the Signal database | it runs `check-prod-migrated.mjs`, which reads `TASKS_*` only (`:7-8`) |
| M4 | Every `drizzle-signal/*.sql` file is registered exactly once in a ledger | no ledger registers any of them |
| M5 | `task_assignments` exists and an "assigned to me across all Projects" read uses it, not `LIKE` | the only assignee read is `like(tasks.assignees, …)` (`queries.ts:335`) |
| M6 | No cross-Project assignee read scans `tasks.assignees` | `queries.ts:335` and `daily-digest.ts:76` both do |
| M7 | `inbox_events` exists and `inbox_event_states` has a writer | neither table exists; read state is client `localStorage` (`inbox-app.tsx:210-212`) |
| M8 | No Inbox table has a free-text content column | no Inbox table exists; the guard must land with the tables, not after them |
| M8b | Every `inbox_events` row carries a visibility revision | the column is a divergence from `contracts/INBOX_EVENT.md` §14 recorded at §5.1 obligation 7, not yet folded in |
| M9 | At least one source action writes an outbox row in the same transaction as its mutation | `appendOutboxEvent` has zero callers |
| M10 | `/api/cron/outbox` appears in `vercel.json` | `vercel.json:3-8` declares only the digest cron |
| M11 | A snapshot row without a `visibility_revision` renders `stale`, never `ready` | the column does not exist |
| M12 | `captureWorkspaceSnapshots` has at least one caller behind `SIGNAL_ANALYTICS_JOBS_ENABLED` | it has zero callers (`snapshots.ts:244`) |
| M13 | Every backfill script's second run reports `rowsWritten = 0` | no backfill script exists |
| M14 | No migration in this programme drops a column | trivially true today; it is a standing guard, not a bug report |

---

## 11. Decisions taken in this contract

| Id | Decision | Rationale in short | Consequence |
|---|---|---|---|
| **D-M01** | The Signal / Home database is recorded as **unprotected**; bringing it under the runner is gate **G-DB1** before Wave 8, not Wave 1 work. | Generalising the runner requires editing `package.json`, which has three concurrent writers, and changing the exact-string pins in `check-migration-contract.mjs:16-27` that protect the safe path. Nothing is at risk until Wave 8 (D-M02). | `R-H14` stays open with a named gate. No Home release may claim "the database is current" — only "the Tasks database is current". |
| **D-M02** | New Home stores land in the **Tasks** database; analytics snapshots stay where they already are. | Tasks is the only database with a ledger, runner and drift alarm; the dominant Inbox producers already live there; moving live snapshot tables is riskier than protecting them. | Waves 6 and 7 run entirely on the protected path. The unprotected exposure is confined to Wave 8. |
| **D-M03** | Expand → migrate → contract, with **no contract phase in this programme**. | A drop whose reversibility depends on data state is not an incident-path action — the repository's own `0027` receipt says so. | Every old shape survives this programme. Deployment rollback stays safe (`ROLLBACK.md` §2.5). |
| **D-M04** | Every new Home table's `workspace_id` is **NOT NULL** from creation. | The nullable-during-cutover pattern (`schema.ts:38-41`) is exactly the Unprojectable ambiguity `PROJECT_SCOPE.md` §6 has to disclose. A new table must not inherit a legacy compromise. **Independently reached** by `contracts/INBOX_EVENT.md` §14 for `inbox_events` — two lanes, one answer, neither amended. | No new Home table ever has an unprojectable row to explain. Generalised here from one table to all of them. |
| **D-M05** | `task_assignments.user_id` is **not** a foreign key, and carries `member_at_backfill`. | Nothing validates assignees against membership (`tasks.ts:370`, `:561`). An FK would turn a real finding into a crashed backfill. | The open Wave 7 product question (`PROJECT_SCOPE.md` §13 item 6) can be answered later from recorded fact, not re-derived. |
| **D-M06** | Visibility revisions are a **truth** mechanism, never an authorization mechanism. | Live authorization is already correct (seam 1, per request, no cache). The exposure is stored derived state described as current. | A stale-basis row renders `stale` in the existing `ProviderCoverageStatus` vocabulary. No sixth membership seam is created. |
| **D-M07** | Outboxes are **source-owned** and written in the source's own transaction; the existing `suite_outbox` is activated, not replaced. | A cross-database transaction between separate Turso instances is impossible; an outbox in the consumer's database is a dual-write with no atomicity. The existing mechanism is correct in shape and merely inert. | Notes and Timeline each need their own outbox table, behind G-DB4. |
| **D-M08** | Backfills run **outside** the migration transaction, produce two receipts, and the second must show `rowsWritten = 0`. | The runner applies migration + proofs in one write transaction (`MIGRATIONS.md:88-90`); a long backfill inside it holds the write lock for its duration. | A backfill with one receipt is unverified and does not close G-DB5. |
| **D-M09** | Write no migration file, ledger entry, receipt, backfill script or `package.json` script in Wave 1; specify the assertions instead of creating the test files. | Wave scope rule; `package.json` has three concurrent writers (`COLLISION_REGISTER.md` §1c); D-H13 set this precedent for exactly this reason. | §10 is written so implementation is mechanical. The lead schedules the test commit on a merged base. |

---

## 12. Open, and owned elsewhere

1. **G-DB1 is not closed.** The Signal / Home database is unprotected today. Owner: lead.
2. **The scheduled-backup decision is the founder's and has not been taken.**
   `backup-all.mjs:20-24` records that running a production dump inside GitHub Actions puts
   planning data into Actions artifact storage, which carries a residency question. Until it is
   taken, "restore a backup" in `ROLLBACK.md` §5 depends on a backup someone remembered to run.
3. **`drizzle/MIGRATIONS.md` §"Current forward migration" is stale** (§2.1). Owner: whoever
   lands the next Tasks migration.
4. **Whether `assignees` is ever dropped** is a founder decision, not an implementation choice
   (§5.2).
5. **What happens to tasks assigned to non-members** is still open (`PROJECT_SCOPE.md` §13
   item 6). §5.2 records the fact so the answer is applicable; it does not answer it.
6. **The Notes and Timeline outbox tables** (G-DB4) have no owner yet. Neither module's database
   has a ledger.
7. **Two divergences from sibling contracts are recorded, not applied.** The
   `visibility_revision` column is an addition to `contracts/INBOX_EVENT.md` §14's table
   (§5.1 obligation 7) and to `contracts/ANALYTICS_CLAIM.md` §15.3's column list (§5.4
   obligation 4). Both were authored in parallel; neither is edited by this lane. Owner: lead,
   to fold in or to reject with a reason. Assertion M8b exists so the divergence cannot be
   lost silently.
8. **A second `vercel.json` cron interacts with the deployment plan's cron limits**
   (`contracts/ANALYTICS_CLAIM.md` §open item 5). §5.5 needs a third for the outbox drain
   (G-DB6), so the limit question is now load-bearing for two waves, not one. Owner:
   lead / founder.

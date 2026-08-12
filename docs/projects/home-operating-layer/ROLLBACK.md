# Contract · Rollback design and the flag matrix

**Status:** Sealed (Wave 1). Binding on every Home release, staged enablement and incident.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Companion:** `MIGRATION_MAP.md` — the persistence architecture these boundaries roll back over.
**Consistent with:** `contracts/PROJECT_SCOPE.md` (sealed), `DECISIONS.md` D-H01 … D-H13.
**Adopts:** `docs/wave/DECISIONS.md` D-011 (the dedicated Home Analytics flag) unamended, and
`RECONCILIATION.md` row 9 (the five flag responsibilities).
**Folds in flags declared by sibling Wave 1 contracts:** `HOME_INBOX_V2_ENABLED`
(`contracts/INBOX_EVENT.md` E4), `SIGNAL_ANALYTICS_JOBS_ENABLED`
(`contracts/ANALYTICS_CLAIM.md` §15.1), `HOME_REVIEW_LAB_ENABLED` /
`HOME_REVIEW_LAB_REVIEWERS` (implemented at `src/lib/home-layer/lab/policy.ts:42`, `:45`), and
the telemetry policy vars (`contracts/HOME_CONTEXT.md`). §3.2 is the whole matrix; no Home flag
exists outside it.
**Decisions taken here:** D-R01 … D-R07 (§8). Lane-scoped ids; the lead renumbers them into
the `D-Hxx` series on fold-in.

---

## 0. The one-paragraph answer

Home has **five independent stop boundaries**, four of them environment state and one of them
code state. Four can be exercised in seconds without a deploy; the fifth needs one.
**Deployment rollback does not roll back the database, and must never be assumed to roll back
environment variables.** Everything below follows from that single sentence: the schema stays
backward-compatible so the previous deployment still runs, no schema downgrade is ever
required, the last-known-good deployment id and the flag matrix are recorded **separately**
because they are separate things, and suspected corruption stops writes and restores into an
isolated database rather than over the live one.

---

## 1. What must be true before any Home release

Recorded in the release record before enablement, not reconstructed afterwards.

| Recorded | Why it must be explicit |
|---|---|
| The **exact last-known-good production deployment id** | It is the only input to boundary 5. The repository already has this convention: `experience/council-reviews/baselines/wave-0-b0.json` binds an app commit **and** a deployment id (`audit/D-baseline-release.md` §3.6). |
| The **full flag matrix** (§3), value by value, at the moment of release | Flags are deployment-independent state (§2.5). A deployment id does not carry them. |
| The **migration ledger hash** and the Tasks drift status | `db:contract` prints the ledger hash; `check-prod-migrated.mjs` prints applied/pending. Gate G-DB2. |
| The **backup identity** for every database Home writes | Boundary 5's corruption path (§5) has nothing to restore without it. |
| Which claims are **unproven** | Field performance has no RUM provider (`R-H05`); the 9.5 council has never certified anything (`R-H08`); there is no visual-regression baseline (`R-H09`). A release record that omits these is not honest. |

---

## 2. The five independent boundaries

Independent means: each can be exercised without touching the other four, each has a distinct
blast radius, and no two of them are the same lever wearing two names.

| # | Boundary | Mechanism | Latency | Blast radius | What it explicitly does **not** do |
|---|---|---|---|---|---|
| 1 | **Provider kill** | `HOME_PROVIDER_{TASKS,NOTES,TIMELINE}_ENABLED` | seconds, no deploy | One source's contribution to Home reads | Does not affect that product's own routes. Does not change Home's shell. Does not delete anything. |
| 2 | **Experience kill** | `HOME_OPERATING_LAYER_ENABLED` | seconds, no deploy | The entire Home operating layer | Does not touch the three products. Does not roll back schema. Does not stop the analytics job. |
| 3 | **Analytics job kill** | `SIGNAL_ANALYTICS_JOBS_ENABLED` | seconds, no deploy | Snapshot **writes** only | Does not remove captured history. Does not disable the Analytics view. Does not stop reads. |
| 4 | **Mutation kill** | `HOME_MUTATIONS_ENABLED` | seconds, no deploy | Every Home-originated write | Does not affect reads. Does not affect writes made from a product's own surface. |
| 5 | **Deployment rollback** | Promote the recorded last-known-good deployment | minutes, platform action | The code | **Does not roll back database state. Must not be assumed to roll back environment variables.** |

### 2.1 Boundary 1 — provider kill

Turns one source off as an input to Home. The surviving requirement is the hard part: with a
provider off, Home renders that source as **unavailable** in the existing coverage vocabulary
— `ProviderCoverageStatus` is already `ready | partial | stale | unavailable | unsupported`
(`src/modules/signal/lib/analytics/contracts.ts:227-232`), and the coverage record already
carries capabilities, history window, staleness and issues
(`src/modules/signal/server/analytics/providers/coverage.ts:8-30`).

**Sealed.** A killed provider is never rendered as zero, as empty, as complete or as all
clear. A Today list missing its Notes provider says so. This is Charter locked decision 11
applied to our own kill switch, and it is the single most likely place for this programme to
lie by omission.

### 2.2 Boundary 2 — experience kill

The umbrella. Off-path behaviour is specified exactly in §4 because "the flag is off" is
worth nothing unless what happens instead is written down.

### 2.3 Boundary 3 — analytics job kill

Stops snapshot capture writes. Two facts make its semantics unusual and both must be stated:

- **There is no job to stop today.** `captureWorkspaceSnapshots` has zero callers repo-wide
  (`src/modules/signal/server/analytics/snapshots.ts:244`), and `vercel.json:3-8` declares
  exactly one cron, `/api/cron/digest?send=1`. Until Wave 8 adds one, this boundary is a
  pre-emptive gate, not a live control.
- **Killing it freezes history; it does not erase it.** Already-captured rows stay readable.
  A frozen series must render as **stale** with its last capture time, and a series that never
  started renders `insufficient_history` — a status the read path already models
  (`snapshots.ts:50-54`). Neither is ever rendered as flat, healthy, complete or zero.

### 2.4 Boundary 4 — mutation kill

Every Home-originated write refuses, with a **typed refusal the caller can detect**.

This is not a preference. The failure it prevents already exists in the codebase: a Tasks
mutation targeting a Project the cookie does not name finds no row and **silently no-ops with
a success return** (`src/server/actions/tasks.ts:114`, `:118-122`; catalogued at
`docs/wave/MUTATION_INVENTORY.md:54-64`). `selectWorkspaceAction` does the same — it returns
`{ ok: true }` on a membership refusal (`src/server/actions/cross-workspace.ts:191`).

**Sealed.** A Home write that is switched off must be distinguishable from a Home write that
succeeded. Never a silent no-op, never an optimistic UI that shows success the source did not
confirm. `HOME_MUTATIONS_ENABLED` stays default-off until Home's write path takes an explicit
`ProjectId` (`PROJECT_SCOPE.md` §9, `R-H11`).

### 2.5 Boundary 5 — deployment rollback, and its two hard limits

Vercel's GitHub app performs every deploy; `deploy.yml` is an explicit no-op stub whose own
header says so (`.github/workflows/deploy.yml:3-13`, `:19-27`). So rollback is a platform
action against the recorded deployment id, not a workflow in this repository.

**Limit 1 — it does not roll back database state. This is certain.** The databases are
external Turso instances reached by URL from environment variables
(`src/env.ts:14-20`, `:42-43`; `src/modules/signal/server/db/signal-analytics-client.ts:25`).
They are not part of the deployment artifact. Rolling a deployment back changes the code that
talks to them and changes nothing inside them.

**Limit 2 — it must not be assumed to roll back environment variables.** Whether promoting an
older deployment restores that deployment's environment snapshot is **not determinable from
this repository**: there is no deploy workflow to read, and no document in the tree states it.
Stating it either way would be a guess.

**The safe rule, which does not depend on resolving that question.** Flag state is recorded
**separately** from deployment identity (§1), and the rollback runbook **re-reads and
re-asserts the entire flag matrix after the rollback completes** rather than inferring it. If
the platform restored the old snapshot, the re-assertion is a no-op. If it did not, the
re-assertion is the fix. Either way the operator ends in a known state.

### 2.6 The seven consequences, stated plainly

1. **The schema stays backward-compatible.** Every change is additive under
   expand → migrate → contract (`MIGRATION_MAP.md` §4), so the immediately-previous production
   deployment runs correctly against the expanded schema. This is the property that makes
   boundary 5 usable at all.
2. **No schema downgrade is ever required.** No Home rollback drops a column, drops a table or
   reverses a migration. `MIGRATION_MAP.md` D-M03 ships no contract phase in this programme,
   precisely so this stays true.
3. **The exact last-known-good deployment id is recorded** before enablement (§1). "Roll back
   to whatever was there before" is not a plan.
4. **Flag states are recorded separately** and re-asserted after rollback (§2.5). A deployment
   id does not carry flag state.
5. **Rollback is application-first.** Disable flags before promoting a deployment; a flag
   change is seconds and reversible, a deployment promotion is minutes and changes the code
   under every request in flight. The repository already states this pattern for the planning
   rollout: *"Rollback is application-first: disable the production flags… Do not drop the new
   columns/tables under incident pressure"* (`docs/planning-periods.md:188-193`).
6. **Suspected corruption stops writes first** (§5), before any restore is attempted and before
   any deployment is promoted.
7. **Legacy read compatibility is retained through the observation window** (§6), so a rollback
   inside that window lands on code that can still read everything present.

---

## 3. The flag matrix

### 3.1 D-R01 · One convention: closed everywhere, explicit opt-in

Audit D found **two contradictory default conventions in this repository**
(`audit/D-baseline-release.md` §7.2, and the trap note at `:411`):

| Convention | Source | Default | Truthy set |
|---|---|---|---|
| A — fail-closed | `src/modules/signal/server/analytics/feature-flag.ts:11-16` | **off in every environment**; explicit `false`/`0` always wins | `true`, `1` |
| B — environment-inverted | `src/lib/planning/flags.ts:20-33` | `NODE_ENV !== "production"` — **on in dev and test**, off in production | `1`, `true`, `yes`, `on` |

**Decision: every Home flag follows convention A's semantics.** Off in every environment
unless explicitly opted in; an explicit `false` or `0` always wins.

**Why, specifically.**

1. Convention B is on in dev **and in test**. A Home flag on that convention would be enabled
   in every local session and every `node --test` run, while the rendered evidence harness —
   which builds and serves a production build (`experience/playwright.config.ts:59-76`) — would
   exercise the flag-**off** path. The evidence would prove the surface nobody is shipping.
   That is exactly backwards.
2. The repository already treats convention A's flag as the thing you pin explicitly for an
   evidence run: `experience/playwright.config.ts:73` sets `SIGNAL_ANALYTICS_V1_ENABLED:
   "false"`. Opting a flag **on** for a specific run is a recorded act; inheriting it from
   `NODE_ENV` is not.
3. The brief requires "server-side, default-off, fail-closed". Convention B is none of those
   three in dev and test.
4. Convention B's own doc comment scopes it honestly to "new writes"
   (`flags.ts:25-29`). Home's umbrella flag gates a whole surface, not a write. Copying a write
   flag's default onto a surface flag is the trap audit D names.

**Independently corroborated in this worktree.** The protected-lab lane reached the same
conclusion from the other direction and wrote the reasoning into source:
`src/lib/home-layer/lab/policy.ts:14-30` names both conventions, rejects `flags.ts` because "it
would serve the lab to anyone who reached a non-production build, which is exactly the exposure
R-H10 exists to close", and copies `feature-flag.ts` because "default-off must mean off in
*every* environment, not off in one of them". Two lanes, one answer. This decision is a
generalisation of theirs to the whole matrix, not a competing one.

**With one improvement borrowed from convention B.** `flags.ts:30-32` takes the environment as
an injectable parameter (`resolvePlanningFeatureFlags(env = process.env)`), which makes the
matrix unit-testable without mutating `process.env`; `feature-flag.ts:12` reads `process.env`
directly. Home takes A's semantics and B's injectable signature:
`resolveHomeFlags(env: Readonly<Record<string, string | undefined>> = process.env)`. The lab
lane already applies exactly this shape — its policy is "pure functions over an environment"
that import nothing (`policy.ts:1-12`).

**Parsing, sealed.** `true` / `1` → on. `false` / `0` → off. **Anything else → off**, including
`yes`, `on`, and typos. A fail-closed gate does not guess. Because a silently-off typo is
correct but invisible, an unrecognised value additionally emits one boot-time warning through
the existing pattern at `src/env.ts:22-45`. **Stated limitation:** that validator skips
entirely when `NODE_ENV !== "production"` or demo mode is on (`src/env.ts:53-54`), so the
warning is production-only. It is a safety net, not a gate.

### 3.2 The matrix

All server-side. No client-side flag system, no flag provider and no runtime flag store exists
in this repository (`audit/D-baseline-release.md` §7), and this programme does not introduce one.

| Flag | Governs | Default | Boundary | Off-path behaviour |
|---|---|---|---|---|
| `HOME_OPERATING_LAYER_ENABLED` | The whole Home operating layer | **off** | 2 | §4 — current `/app/home` and `/app/home/briefing` behaviour remains; the new routes are absent or 404 |
| `SIGNAL_HOME_ANALYTICS_ENABLED` | The Home Analytics **view** only | **off** | 2 (nested) | `/app/home/analytics` is absent or 404. `/app/home/briefing` is unaffected. |
| `SIGNAL_ANALYTICS_V1_ENABLED` | **Not ours.** The briefing-engine switch | **off** — unchanged | — | Untouched by this programme. Turning it on replaces a shipped surface. |
| `SIGNAL_ANALYTICS_JOBS_ENABLED` | Snapshot capture writes | **off** | 3 | No capture. Existing history stays readable and renders `stale`; absent history renders `insufficient_history`. |
| `HOME_MUTATIONS_ENABLED` | Every Home-originated write | **off** | 4 | Writes refuse with a typed, detectable refusal. Never a silent no-op. |
| `HOME_PROVIDER_TASKS_ENABLED` | Tasks as a Home read source | **off** | 1 | That source renders `unavailable`, never zero. |
| `HOME_PROVIDER_NOTES_ENABLED` | Notes as a Home read source | **off** | 1 | As above. |
| `HOME_PROVIDER_TIMELINE_ENABLED` | Timeline as a Home read source | **off** | 1 | As above. |
| `HOME_INBOX_V2_ENABLED` | The new Inbox read path | **off** | 2 (nested) | `/app/inbox` keeps rendering the legacy surface. Owned by `contracts/INBOX_EVENT.md` E4. |
| `HOME_REVIEW_LAB_ENABLED` | The protected `/lab` Home directions | **off** | — | The lab route family answers 404. Name already implemented at `src/lib/home-layer/lab/policy.ts:42`. |
| `HOME_REVIEW_LAB_REVIEWERS` | Reviewer identities for the lab | **empty** | — | Empty resolves to the single source literal (the founder) and nothing else; with the flag off it grants nothing. `src/lib/home-layer/lab/policy.ts:45`, `:59`. |
| `HOME_TELEMETRY_ALLOWLIST` / `HOME_TELEMETRY_REJECTED_FIELDS` | Home telemetry field policy | **absent** | — | Owned by `contracts/HOME_CONTEXT.md` §"telemetry.ts". Listed so the matrix is the whole matrix. |

### 3.3 D-R02 · `SIGNAL_ANALYTICS_V1_ENABLED` is never reused as the Home Analytics view gate

Adopted from `docs/wave/DECISIONS.md` D-011, unamended, and independently confirmed by audit D
§7.1. That flag has exactly two consumers — `src/modules/signal/app/signal-brief-page.tsx:38`,
which chooses **which briefing engine renders** at `/app/home/briefing`, and
`src/modules/signal/server/analytics/policy.ts:44`, the authorization gate for the whole
analytics domain. Turning it on replaces a shipped, operator-visible surface. It is a
briefing-engine switch, not a view switch. `SIGNAL_HOME_ANALYTICS_ENABLED` is the Home
Analytics view gate; `policy.ts:44` is split so the domain gate accepts either flag.

### 3.4 D-R03 · The provider flags are enablement flags that function as kill switches

They are named `..._ENABLED` and default **off**, per the brief. Two consequences, stated so
nobody is surprised by them in an incident:

1. **Unset does not mean on.** An operator who assumes a kill switch is "on unless killed" will
   read this matrix backwards. The name carries the semantics: `ENABLED`, default off.
2. **Umbrella on with no providers enabled is a real, reachable state**, and it is the correct
   fail-closed one: Home renders every source as `unavailable` with its coverage. It must
   **never** render "nothing to do", "you're all clear", or an empty Today. Staged rollout is
   therefore provider-by-provider by construction, which is what we want.

### 3.5 D-R04 · The `HOME_` prefix is adopted, with one hazard recorded

The brief names `HOME_OPERATING_LAYER_ENABLED` and `HOME_MUTATIONS_ENABLED`; the repository
convention for feature flags is `SIGNAL_*` (`flags.ts:11-18`, `feature-flag.ts:12`), and
`docs/wave/DECISIONS.md` D-011 has already fixed `SIGNAL_HOME_ANALYTICS_ENABLED`. The brief's
names win (Charter authority order, source 1 over source 5), and D-011's name is not renamed
because renaming a ratified decision to satisfy a prefix is not a reason.

**Hazard recorded.** `<MODULE>_DATABASE_URL` / `<MODULE>_AUTH_TOKEN` is the one database
credential convention (`scripts/db/backup-all.mjs:43-52`), and the module list is
`tasks, notes, timeline, signal, entitlements, studio` (`scripts/db/backup.mjs:42-49`). A
`HOME_` prefix could invite someone to create `HOME_DATABASE_URL` believing Home is a module.
**Home is not a module and has no database of its own.** Its briefing data lives in the
`SIGNAL_*` database (`src/env.ts:42`), and the backup tooling would silently skip a `HOME_`
database because `home` is not in `KNOWN_MODULES`. No `HOME_*_DATABASE_URL` or `HOME_*_AUTH_TOKEN`
variable may ever be introduced.

---

## 4. Off-path behaviour when `HOME_OPERATING_LAYER_ENABLED` is false

This is the contract's most load-bearing paragraph, because it is what every rollback lands on.

**The current behaviour remains, exactly.**

- **`/app/home`** renders precisely what it renders today: `HomePage` calls `loadHomeData`
  (`src/app/app/home/page.tsx:23`), which calls `buildBriefingForUser`
  (`src/app/app/home/home-data.ts:101-107`), returning `HomeNewUser` or `HomeView`
  (`page.tsx:24-25`). No new shell, no new navigation, no scope control, no Home-local chrome.
- **`/app/home/briefing`** renders the legacy briefing. `SignalBriefPage` returns
  `SignalLegacyBriefing` while `SIGNAL_ANALYTICS_V1_ENABLED` is off
  (`src/modules/signal/app/signal-brief-page.tsx:37-39`). Unchanged.
- **`/app/home/inbox`, `/app/home/my-work`, `/app/home/analytics` are absent or 404.** Not a
  placeholder, not "coming soon", not an empty shell, not a redirect into a product. A route
  that exists and renders nothing is a worse answer than a route that does not exist: it
  teaches the user a surface exists and then fails to be it.
- **No navigation renders a link to them.** A visible link to a 404 is the same defect one
  layer up.
- **The legacy surfaces stay where they are.** `/app/inbox` and `/app/my-tasks` continue to
  work. Both are pinned by `scripts/check-route-manifest.mjs:41-42` as directories that must not
  disappear, and that gate runs inside `pnpm test`. Wave 9's decomposition must update the
  manifest in the same change or the test suite fails — recorded here so it is not discovered
  late.
- **That gate is one-directional**: it catches removals only, and new routes are explicitly not
  an error (`check-route-manifest.mjs:13-16`). `app/home` is not in the manifest today, so the
  gate will not complain about the new Home routes — and will not protect them either. Adding
  them is what makes them equally guarded against silent deletion.

**Nested gates do not leak.** `SIGNAL_HOME_ANALYTICS_ENABLED` on while the umbrella is off does
**not** expose `/app/home/analytics`. The umbrella is checked first and independently; the
nested flag can only narrow. A flag that can be bypassed by another flag is not a gate.

**No data is written on the off path.** With the umbrella off, no Home code writes anything to
any database — no read-state row, no event, no snapshot, no telemetry. This is what makes the
off path a genuine rollback target rather than a degraded mode.

---

## 5. Suspected corruption

Corruption means: rows that should not exist, rows missing that should exist, counts that
cannot be reconciled with their source, or a schema that does not match the ledger. It is
distinct from "a surface looks wrong", which is boundaries 1–5.

**The order is fixed. Stopping writes comes first, and restoring never touches the live
database.**

1. **Stop writes.** Set `HOME_MUTATIONS_ENABLED=false` and `SIGNAL_ANALYTICS_JOBS_ENABLED=false`.
   Kill the affected providers. Do not deploy anything yet — a deploy under incident pressure
   changes two variables at once.
2. **Freeze the evidence.** Record the current flag matrix, the live deployment id, and the
   ledger status (`pnpm db:status -- --environment=production --confirm-production=tasks`)
   before anything changes.
3. **Take a fresh backup** of every affected database — `node scripts/db/backup-all.mjs
   --modules=<list> --verify` (`scripts/db/backup-all.mjs:25-29`). This captures the corrupted
   state, which is evidence. It does not replace the last known-good backup.
4. **Restore the known-good backup into an isolated database.** Never over the live one.
   `scripts/db/restore-verify.mjs` already provides exactly this: `restoreInto(targetUrl, body)`
   (`:45`), `measure(client, tables)` (`:93`), `compare(manifest, measured)` (`:123`) and
   `compareDdl(client, manifest)` (`:178`). Run `node scripts/db/integrity-check.mjs`
   (`:228-262`) against the isolated copy.
5. **Diagnose against the isolated copy**, read-only, until the corrupting write path is
   identified. A restore that happens before the cause is known will be repeated.
6. **Controlled cutover, or forward-fix.** Cutover means pointing the module's
   `<MODULE>_DATABASE_URL` at the verified isolated database, in one deliberate act, with the
   flag matrix still closed, then re-opening boundaries one at a time.
7. **Do not drop columns or tables under incident pressure.** Stated in the repository already
   for the planning rollout (`docs/planning-periods.md:190-193`) and re-sealed here for Home.

**Two limits stated rather than assumed.**

- **The Signal / Home database has no ledger and no drift alarm** (`MIGRATION_MAP.md` §3), so
  "the schema does not match the ledger" is not a detectable class of corruption there until
  gate G-DB1 closes.
- **Nothing takes a backup on a schedule.** `scripts/db/backup-all.mjs:20-24` records that
  scheduling a production dump into Actions artifact storage is a data-handling decision the
  founder has not taken. Step 4 depends on a backup someone remembered to run. This is an open
  item (§9), not a solved problem.

---

## 6. The observation window, and legacy read compatibility

**Length, derived rather than invented.** The minimum observation window is **two consecutive
daily cycles**. The digest cron runs `0 9 * * *` (`vercel.json:3-8`) and snapshot capture is
once per Project per UTC day (`src/modules/signal/server/analytics/snapshots.ts:243`). One
cycle proves the path produces; the second proves the re-run is a no-op rather than a
duplicate. A window shorter than two cycles cannot distinguish those two outcomes.

**What is retained through the window.**

| Legacy read | Retained until | Why |
|---|---|---|
| `notifications` table reads for the Inbox | Wave 9 convergence, at the earliest | A rollback inside the window must land on code that can still read everything present (`MIGRATION_MAP.md` §5.1). |
| `notifications.read_at` untouched | Indefinitely in this programme | It has no writer today and this programme adds none. Leaving it untouched means a rollback finds it exactly as it was. |
| Client `localStorage` Inbox read state | Read-only through the window | Per-device and unauthenticated; read for continuity, never written by new code, never imported into the server store. |
| `tasks.assignees` JSON column | Beyond this programme | Dual-written throughout. Dropping it needs its own founder decision (`MIGRATION_MAP.md` §5.2). |
| `/app/inbox`, `/app/my-tasks` | Wave 9 | Also pinned by `scripts/check-route-manifest.mjs:41-42`. |
| The legacy briefing at `/app/home/briefing` | Beyond this programme | It is the off-path target of §4. It cannot be retired while it is the rollback destination. |

**The repository's own precedent for this pattern**, and the reason it is written this way:
`drizzle/MIGRATIONS.md:30-32` retains the v1 notes-extract receiver as *"the zero-downtime and
rollback seam"* and specifies the reverse order for the rollback — disable the sender first,
confirm sends use v1, and only then roll back the receiver. Home's dual-read window is the same
shape: **the reader is retired last.**

---

## 7. The staged enablement order

Each step is reversible by its own boundary, and no step is taken while the previous one is
unproven.

| Step | Action | Reversed by | Proof required before the next step |
|---|---|---|---|
| 0 | Deploy with every flag off | boundary 5 | `/app/home` and `/app/home/briefing` render current behaviour (§4); the new routes 404 |
| 1 | `HOME_REVIEW_LAB_ENABLED=true` with a reviewer list | boundary — flag | `R-H10` closed **on a merged base** — see §7.1. The lab is unreachable without an allowlisted verified identity, and a refused request 404s rather than redirecting to sign-in |
| 2 | `HOME_OPERATING_LAYER_ENABLED` for the operator only | boundary 2 | Every Home surface renders honestly with **zero** providers enabled — every source `unavailable`, nothing claiming all clear (§3.4) |
| 3 | One provider at a time | boundary 1 | Each source's coverage is correct, and turning it back off returns to the state proved in step 2 |
| 4 | `SIGNAL_HOME_ANALYTICS_ENABLED` | boundary 2 (nested) | History renders `insufficient_history`, not zero, before any job runs |
| 5 | `SIGNAL_ANALYTICS_JOBS_ENABLED` | boundary 3 | Gate G-DB1 closed. Two capture cycles, second-run idempotent (§6) |
| 6 | `HOME_MUTATIONS_ENABLED` | boundary 4 | Every Home write takes an explicit `ProjectId` (`PROJECT_SCOPE.md` §9); a refusal is detectable and is not a silent no-op |

Step 6 is last deliberately. It is the only step that changes data a user cannot undo, and it
is gated on the largest hidden cost in the programme (`R-H11`).

### 7.1 R-H10 · what changed under this contract's feet, stated exactly

`RISK_REGISTER.md` R-H10 records that `/lab` had **no authentication guard at all** — outside
the Clerk proxy matcher, no guard in any lab page, no layout, and `GET /lab/timeline-a`
returning 200. That was true at the risk register's base.

**It is no longer true in this worktree, and it is not yet true on `origin/main`.** A parallel
Wave 1 lane has, uncommitted, at the time of writing:

- modified `src/proxy.ts` so `/lab/:path*` is in the Clerk matcher (`src/proxy.ts:317`) —
  included *only* so a server component under `/lab` can read a real session — while `/lab` and
  `/lab/(.*)` are listed as public routes (`:189-190`) so `auth.protect()` never fires and the
  six pre-existing lab mockups keep serving anonymously;
- added `src/lib/home-layer/lab/policy.ts` — the whole access rule as pure functions, fail-closed
  on every unknown: unset flag, unparseable value, no email, unverified email, absent from the
  reviewer list, and seed-data posture all refuse (`policy.ts:32-38`);
- added `src/lib/home-layer/lab/guard.ts`, the server wrapper that turns a refusal into
  `notFound()` rather than a sign-in redirect — because a redirect confirms the route exists
  (`src/proxy.ts:183-185`).

**How this contract treats it.** The mechanism is present and reads correctly, and it is
**unmerged and not runtime-verified**. Under this programme's own rule, that is Open, not Done.
Step 1 of §7 is gated on R-H10 being closed **on a merged base with a live check**, not on the
existence of the files. Until then `ROLLBACK.md` cites R-H10 as open (§10 item 4).

---

## 8. Decisions taken in this contract

| Id | Decision | Rationale in short | Consequence |
|---|---|---|---|
| **D-R01** | Every Home flag follows the fail-closed convention (`feature-flag.ts`), with the injectable env signature borrowed from `flags.ts`. Unrecognised values resolve to **off**. | The `flags.ts` convention is on in dev **and test** and off in production, so tests would exercise a path the evidence harness does not render. The brief requires default-off and fail-closed. | One convention across the matrix. `resolveHomeFlags(env = process.env)` is unit-testable without mutating `process.env`. |
| **D-R02** | `SIGNAL_ANALYTICS_V1_ENABLED` is never reused as the Home Analytics view gate. | It is a briefing-engine switch with two consumers (`signal-brief-page.tsx:38`, `policy.ts:44`); turning it on replaces a shipped surface. | Adopts `docs/wave/DECISIONS.md` D-011 unamended. `SIGNAL_HOME_ANALYTICS_ENABLED` is the view gate. |
| **D-R03** | Provider flags are `..._ENABLED`, default off, and "umbrella on, no providers" is a valid state that renders every source `unavailable`. | The brief requires default-off. Naming carries the semantics so an operator does not read the matrix backwards. | Staged rollout is provider-by-provider by construction. Home must never render an empty Today as "all clear". |
| **D-R04** | Adopt the brief's `HOME_` prefix; record the module-credential collision hazard. | Charter authority order puts the brief above repo convention; D-011's name is already ratified and is not renamed. | No `HOME_*_DATABASE_URL` may ever exist. Home is not a module. |
| **D-R05** | Deployment rollback is treated as **not** restoring environment variables, and the matrix is re-asserted after every rollback. | Vercel's behaviour is not determinable from this repository — `deploy.yml` is a no-op stub. Guessing either way would be a fabricated fact. | The runbook ends in a known state whichever the platform does. Flag state is recorded separately from deployment identity. |
| **D-R06** | Rollback is application-first: flags before deployments; no schema downgrade, ever. | A flag change is seconds and reversible; a deployment promotion changes code under in-flight requests. `docs/planning-periods.md:188-193` sets the precedent. | Boundary 5 is the last resort, not the first move. `MIGRATION_MAP.md` D-M03 keeps it safe by shipping no contract phase. |
| **D-R07** | The observation window is a minimum of two consecutive daily cycles, and the legacy **reader** is retired last. | The digest cron is daily (`vercel.json:3-8`) and capture is once per UTC day (`snapshots.ts:243`); one cycle cannot distinguish "produced" from "duplicated". `MIGRATIONS.md:30-32` sets the retire-the-reader-last precedent. | A rollback inside the window always lands on code that can read everything present. |

---

## 9. Executable assertions

**Specified, not written as test files this wave**, for the reason recorded at
`MIGRATION_MAP.md` §10 and `DECISIONS.md` D-H13: every natural home for these sits in
`package.json`, `src/app/app/home/**` or `src/proxy.ts`, all of which are foreign-owned or
contended at this base (`COLLISION_REGISTER.md` §1b, §1c). Each names what makes it fail today.

| # | Assertion | Must fail today because |
|---|---|---|
| R1 | `resolveHomeFlags({})` returns every flag `false` | no such function exists |
| R2 | `resolveHomeFlags({ HOME_MUTATIONS_ENABLED: "yes" })` returns `false` | no such function exists; `flags.ts:22` would return `true` for `yes` |
| R3 | No Home flag reads `NODE_ENV` to compute its default | no Home flag exists; `flags.ts:33` is the pattern being rejected |
| R4 | With the umbrella off, `/app/home` renders the current `loadHomeData` output | no umbrella flag exists |
| R5 | With the umbrella off, `/app/home/inbox`, `/app/home/my-work`, `/app/home/analytics` all 404 | none of the three routes exists at all |
| R6 | `SIGNAL_HOME_ANALYTICS_ENABLED=true` with the umbrella off still 404s `/app/home/analytics` | neither flag exists |
| R7 | No Home surface renders a link to a route whose flag is off | no Home navigation exists |
| R8 | A Home write with `HOME_MUTATIONS_ENABLED=false` returns a refusal distinguishable from success | no Home mutation exists; the incumbent pattern returns `{ ok: true }` on refusal (`cross-workspace.ts:191`) |
| R9 | A killed provider renders `unavailable`, and no Home count reads zero because of it | no provider kill switch exists |
| R10 | The Home lab route family is unreachable without an allowlisted verified identity, and refuses with 404 rather than a sign-in redirect | on `origin/main` at this base, `/lab` is outside the Clerk proxy matcher and unguarded (`R-H10`). The in-worktree fix (§7.1) is unmerged and unverified against a running server |
| R11 | The release record contains a deployment id, a flag matrix and a ledger hash | no release record format exists |
| R12 | With the umbrella off, no Home code path performs a database write | no Home write path exists |

---

## 10. Open, and owned elsewhere

1. **Whether a Vercel deployment rollback restores that deployment's environment snapshot** is
   unknown and is treated as "no" (D-R05). Establishing it would simplify the runbook; it does
   not change its safety. Owner: lead.
2. **Nothing takes a backup on a schedule.** The founder decision recorded at
   `scripts/db/backup-all.mjs:20-24` is untaken, and §5 step 4 depends on it. Owner: Ethan.
3. **G-DB1 is open** — the Signal / Home database is unprotected (`MIGRATION_MAP.md` §3.2), so
   corruption of Home's briefing data is not detectable by any gate. Owner: lead.
4. **`R-H10` is open on `origin/main`.** The guard exists in this worktree, uncommitted and not
   runtime-verified (§7.1). It closes when it lands on a merged base and a live check confirms
   a non-reviewer gets 404. Owner: lead, Wave 2.
5. **Field performance is unmeasurable** (`R-H05`): no RUM provider is wired anywhere. Rollout
   proceeds with field performance explicitly recorded as unproven, or a provider is wired
   first. Owner: Ethan, before the first external cohort.
6. **The 9.5 council cannot certify anything** (`R-H08`) and the gate runs `continue-on-error`
   in CI (`design-quality.yml:105` at this base; `:98` at the audit's base — the line moved,
   the behaviour did not). "Certified" is unavailable as a release outcome until the
   founder decision at `studio/content/hq/operator-todos/rule-on-95-gate-scope.md` is taken.
   Owner: Ethan.

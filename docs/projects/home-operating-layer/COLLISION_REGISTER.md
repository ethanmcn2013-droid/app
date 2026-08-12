# Collision register — in-flight work this programme must not disturb

**Cut taken:** 2026-08-12 20:17 BST
**Programme base:** `a849fc40e46787a39e499fc94b171a5dfb898821` (`origin/main`, "the Planning count carries its noun (#124)", 2026-08-12 19:28 BST)
**Programme worktree:** `_wt-home-layer` on `feat/home-operating-layer`

This register exists because other sessions are running against this repository right
now. It is re-taken at every wave boundary. Nothing in this programme may write to a
path or branch listed as FOREIGN until its owning lane has landed on `origin/main`.

## 1. Live lanes — do not touch

| Worktree | Branch | HEAD | Last activity | Status |
|---|---|---|---|---|
| `app/` (root checkout) | `main` | `438b572` | 170 dirty files, 138 behind `origin/main` | **FORBIDDEN.** Never read as authority, never edit, never clean, never branch from. |
| `_wt-project-truth` | `feat/project-truth-wave` | `d4d9295` | 2026-08-12 20:11 | **LIVE.** Open PR [#125](https://github.com/ethanmcn2013-droid/app/pull/125), updated 19:13 today. |
| `_wt-wp1-safety` | `lane/wp1-timeline-safety` | `9aae0ae` | 2026-08-12 20:00 | **LIVE.** Four Timeline-safety commits on top of WP0. |
| `_wt-wp2-platform` | `lane/wp2-project-platform` | `c598bd0` + 2 dirty | 2026-08-12 20:04 | **LIVE and uncommitted.** Actively authoring `src/lib/projects/`. |
| `_wt-design-audit` | `agent/header-planning-noun` | `0f67dd9` | 2026-08-12 18:59 | Landed as #124 (= our base). Treat as recently active; do not reuse. |

### 1b. Two further live sessions opened 2026-08-12 ~20:50

Both were raised by this programme as out-of-scope defects and are now being fixed
independently. Their paths become foreign-owned for the duration.

| Session | Owns (do not write) | Why it collides |
|---|---|---|
| `task_73a84b31` — daily-digest cross-tenant fix | `src/server/db/daily-digest.ts`, `src/server/tenant-scope-rules.mjs`, `src/app/app/inbox/page.tsx`, `src/app/api/cron/digest/route.ts`, `src/server/cross-tenant-*.test.*` | `/app/inbox` is the legacy Inbox this programme migrates. Their fix must land first. |
| `task_1bf52417` — Home `/waitlist` access-gate fix | **`src/app/app/home/page.tsx`**, `src/app/app/home/briefing/page.tsx`, `src/app/app/notes/page.tsx`, `src/app/app/timeline/page.tsx`, `src/server/require-app-access.ts`, `src/server/app-access.ts`, `src/app/app/layout.tsx` | **Highest-risk overlap in the programme.** `home/page.tsx` and the `/app` layout are exactly what Wave 4 restructures. |

**Consequence for Wave 4.** The Home route family cannot be authored until
`task_1bf52417` lands on `origin/main`. Wave 4 then builds on their corrected gate rather
than reintroducing the narrow one. This is a sequencing constraint, not a blocker — Waves 1
to 3 write contracts, fixtures and lab code only, none of which touch those files.

### 1c. Open PRs at 2026-08-12 21:20 — three lanes contending on `package.json`

| PR | Branch | State | Owns | Effect on us |
|---|---|---|---|---|
| **#129** | `lane/wp0-truth-fixtures` | MERGEABLE | `src/lib/project-truth-fixture.ts`, `experience/feature-tests/project-switch-journeys.spec.ts`, `experience/project-switch.playwright.config.ts` | **Direct Wave 2 overlap.** A multi-Project fixture universe plus Playwright journeys — the same shape as our Wave 2, one wave earlier. Coordination message sent: theirs is canonical for Project identity and multi-Project shape; our Home scenario layer builds **on top of** it, not beside it. |
| **#128** | `fix/digest-workspace-scope` | MERGEABLE | `src/server/db/daily-digest.ts`, new `src/server/db/digest-mentions.ts`, `src/server/tenant-scope-rules.mjs` + test, `CHANGELOG.md` | Our Wave 0 finding, being fixed. Also tightens the detector rule that missed it. Unblocks nothing of ours; do not touch those files. |
| **#126** | `lane/wp1-timeline-safety` | **CONFLICTING** | `src/modules/timeline/**`, `src/modules/notes/server/tasks-personalization.*`, `src/server/suite-context-contract.test.mjs`, `src/server/operational-log-contract.test.mjs` | Theirs to resolve. Confirms those paths stay foreign for now. |

**`package.json` is being edited by #126, #128 and #129 simultaneously.** It is the
integration-junction file this register already flags. This programme must not add a script to
it without checking the merge order first, and never concurrently.

All other `_wt-*` worktrees were last touched on or before 2026-08-06 and are treated as
dormant history. They are still never reused as a base — this programme branches only
from a proven `origin/main` SHA.

## 2. Foreign-owned paths

These paths belong to the live Project Truth lanes. This programme **reads** them as
evidence and **never writes** them until the owning lane merges.

| Path | Foreign owner | Why it collides with us |
|---|---|---|
| `src/lib/projects/**` | `lane/wp2-project-platform` (untracked, being written now) | This is exactly the ProjectScope foundation our Wave 1 §10.2 would otherwise create. We must consume theirs, not build a second one. |
| `src/lib/product-urls.ts` | `lane/wp2-project-platform` (modified, uncommitted) | Our Wave 1 typed URL builder and Wave 4 route family both extend this file. |
| `src/modules/timeline/**` (lib, server, sync) | `lane/wp1-timeline-safety` | Exact-Project Timeline resolution, milestone reconciliation, provisioning. Our Analytics Project identity work depends on the outcome. |
| `src/modules/notes/server/tasks-personalization.*` | `lane/wp1-timeline-safety` | Notes→Tasks personalisation seam our My work coverage question touches. |
| `src/server/suite-context-contract.test.mjs` | `lane/wp1-timeline-safety` | A required contract test our shell work would otherwise edit. |
| `src/server/operational-log-contract.test.mjs` | `lane/wp1-timeline-safety` | Same. |
| `docs/adr/0001-canonical-project-identity.md` | `feat/project-truth-wave` | The canonical Project ADR. We adopt it; we do not author it. |
| `docs/wave/**` | `feat/project-truth-wave` | Their programme ledger. Ours lives at `docs/projects/home-operating-layer/**`. |
| `scripts/wave-baseline.mjs` | `feat/project-truth-wave` | Their baseline tool. Ours writes to `docs/projects/home-operating-layer/verification/`. |
| `.github/workflows/design-quality.yml` | `feat/project-truth-wave` (`d4d9295`) | They are mid-fix on docs-only PR reporting. Do not touch concurrently. |
| `package.json` | `lane/wp1-timeline-safety` | Integration-junction file. Lead-owned here; coordinate, never concurrent-edit. |

## 3. Recorded drift inside the foreign programme

Their WP0 commit exists at **two different SHAs** with the same message
("WP0: freeze the Project contract, and record what the audits actually found"):

- `9880694` — the base `lane/wp1-timeline-safety` is built on
- `c598bd0` — the rebased version now on `feat/project-truth-wave` and `lane/wp2-project-platform`

The master brief for this programme cites `9880694`. That SHA is **stale**; the branch has
moved to `d4d9295`. This is their internal drift to resolve, not ours.

**Consequence for us:** Wave 1 must port the revalidated Project contract from the version
that actually lands on `origin/main` via PR #125 — never by cherry-picking either lane SHA,
and never by merging `feat/project-truth-wave` wholesale.

## 4. Standing rules for every agent in this programme

0. **Never `cd` into a forbidden checkout, not even for a read-only command.** The shell's
   working directory **persists between tool calls**. A `cd .../app` for one `gh pr list`
   left the next `git add` pointing at the dirty root. It failed harmlessly — a
   non-matching pathspec stages nothing — but the only thing standing between that and a
   write was luck. Use `git -C <path>` and `gh -R <repo>` instead of `cd`, always. If a
   `cd` is unavoidable, `cd` back in the same command.

   *Verification after that near-miss:* the dirty root is byte-identical to the 20:17 cut —
   `main @438b572`, porcelain count still exactly 170, no programme path staged, and
   `.git/index` last written **2026-08-04 10:15**, eight days before this session opened.
   The 41 staged files there are pre-existing and belong to someone else's work.

1. Read-only outside `_wt-home-layer`. No exceptions.
2. No state-mutating git command anywhere: no `checkout`, `switch`, `stash`, `reset`,
   `clean`, `restore`, `rebase`, `merge`, `pull`, `push`, `worktree add/remove/prune`,
   `branch -D`, `gc`. Read-only git inside `_wt-home-layer` only.
3. Never set `CI=true` in a lane worktree — pnpm purges `node_modules` junctions.
   (`_wt-home-layer` has a real `node_modules`, so this is a rule for anything we hand off.)
4. No production migration, job, deploy, merge or flag enablement in Waves 0–3.
5. At every wave boundary: re-fetch `origin`, re-take this register, and if `origin/main`
   moved, stop spawning writers and integrate the new base in one lead-owned operation.

## 5. Actions already taken that touched shared state

| Action | Effect on other sessions |
|---|---|
| `git fetch origin --prune` | None. Updates remote-tracking refs only; no local branch, worktree or working file is altered. |
| `git worktree add -b feat/home-operating-layer ../_wt-home-layer a849fc4` | Additive. Creates a new branch and directory; no existing worktree or branch is modified. |
| `pnpm install --frozen-lockfile` in `_wt-home-layer` | Writes only into `_wt-home-layer/node_modules` and the shared content-addressable pnpm store (lock-safe). `--frozen-lockfile` guarantees `pnpm-lock.yaml` is not rewritten. |

No other session's files, branches, indexes or working trees have been read for authority
or written to.

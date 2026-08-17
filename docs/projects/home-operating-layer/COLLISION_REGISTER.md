# Collision register — in-flight work this programme must not disturb

**Cut taken:** 2026-08-17 17:45 BST — supersedes the 2026-08-12 20:17 cut entirely
**Programme base:** `a849fc40e46787a39e499fc94b171a5dfb898821`
**Current `origin/main`:** `9271781` ("Run the design-quality checks when .gitattributes changes (#140)", 2026-08-13 03:34 BST)
**Programme worktree:** `_wt-home-layer` on `feat/home-operating-layer` (now pushed)

This register exists because other sessions run against this repository. It is re-taken at
every wave boundary. Nothing in this programme may write to a path or branch listed as
FOREIGN until its owning lane has landed on `origin/main`.

**What changed since the last cut, in one line:** the Project Truth programme's entire
Wave 0–4 body of work **landed**. Every path this register previously fenced as
foreign-and-in-flight is now merged into `origin/main` and is consumed from there.

---

## 1. Live lanes

| Worktree | Branch | HEAD | Last activity | Status |
|---|---|---|---|---|
| `app/` (root checkout) | `main` | `438b572` | 170 dirty files, 155 behind `origin/main` | **FORBIDDEN.** Never read as authority, never edit, never clean, never branch from. Index last written 2026-08-04; it is abandoned working state, not a session. |
| `_wt-project-truth` | `wave5/founder-selection` | `c78a73e` | 2026-08-17 17:34 | **LIVE — same operator as this programme.** Open PR #141. |
| `_wt-lab-active-project` | `lab/lab-active-project` | `bbcc7b7` | 2026-08-17 17:38 | **LIVE — same operator.** Open PR #142. |
| `_wt-lab-analytics` | `lab/lab-analytics` | `2b815d7` | 2026-08-13 03:32 | **LIVE — same operator.** Open PR #143. |
| `_wt-wp0-fixtures` … `_wt-wp4-timeline` (8 lane worktrees) | `lane/*` | various | 2026-08-12 → 2026-08-13 | **DORMANT.** All clean, all their PRs (#126–#140) merged. Squash-merged, so branch tips are not ancestors of `main` — that is expected and is not evidence of unmerged work. Never reused as a base. |
| `_wt-design-audit` | `agent/header-planning-noun` | `0f67dd9` | 2026-08-12 18:57 | Landed as #124. Dormant. |

**Every lane worktree above is clean** — porcelain count zero, verified at this cut. The
two sessions flagged in the previous cut as live (`task_73a84b31` daily-digest,
`task_1bf52417` Home access gate) have both landed; `src/app/app/home/page.tsx` and the
`/app` layout carry their corrected gate on `main` now, which is the base Wave 4 was told
to wait for.

### 1b. Open pull requests at this cut

All three belong to this operator. There is no third-party contention.

| PR | Branch | Mergeable | Owns |
|---|---|---|---|
| #141 | `wave5/founder-selection` | MERGEABLE | `docs/wave/DECISIONS.md`, `docs/wave/PROGRAMME.md`. Docs only. |
| #142 | `lab/lab-active-project` | MERGEABLE | `src/app/lab/active-project*`, `src/components/lab/active-project/**`, `experience/registry.json` (+5 entries). |
| #143 | `lab/lab-analytics` | MERGEABLE | `src/app/lab/signal-analytics*`, `src/lib/analytics-lab/**`, `experience/registry.json`, `package.json`. |

**`package.json` and `experience/registry.json` are contended between #142 and #143.**
Both add to them. #143's `package.json` conflict against `main` was already resolved by
keeping both sides' tests rather than taking a side. Whichever merges second rebases; do
not merge them concurrently.

---

## 2. Foreign-owned paths

**The previous foreign list is retired.** `src/lib/projects/**`, `src/lib/product-urls.ts`,
`src/modules/timeline/**`, `src/modules/notes/server/tasks-personalization.*`, the two
contract tests, the canonical Project ADR and `.github/workflows/design-quality.yml` have
all merged. They are consumed from `origin/main` as ordinary dependencies, not fenced.

What remains fenced, and what is newly fenced:

| Path | Foreign owner | Why it collides |
|---|---|---|
| `docs/wave/**` | Project Truth programme ledger | Theirs. Ours lives at `docs/projects/home-operating-layer/**`. Read for authority, never author. |
| `scripts/wave-baseline.mjs` | Project Truth | Their baseline tool. Ours writes to our own `verification/`. |
| `src/modules/signal/server/analytics/**` | **Project Truth Wave 6, starting now** | `D-027` gives them the analytics **read**. We do not author providers, the metric registry or truth classes. |
| `src/lib/analytics-lab/**`, `src/app/lab/signal-analytics*` | Project Truth (#143) | The selected Plan Trace composition originates here. |
| `src/app/lab/active-project*`, `src/components/lab/active-project/**` | Project Truth (#142) | The selected Studio Bar anchor originates here. |
| Timeline milestone mutation path, `captureWorkspaceSnapshots`, `vercel.json` crons | **Project Truth Stage 1, starting now** | The two analytics writers the founder authorized on 17 Aug. Do not touch concurrently. |
| `package.json` | Integration junction | Lead-owned. Coordinate, never concurrent-edit. Three PRs contended on it last week and it is the single most reliable source of rebase conflicts in this repository. |

### 2b. The one genuinely two-sided boundary — `D-027`

Both programmes build Home. The split, ratified by the founder's approval of the
completion plan on 17 August 2026 and recorded as `D-027` there and `D-H14` here:

| Owns | Programme |
|---|---|
| The analytics **read** — providers, metric registry, truth classes, Plan Trace as a content component | Project Truth |
| The Home **shell** — routes, modes, navigation, chrome, the boundary contract | This programme |

**The binding consequence for us:** we do not build an analytics view. We build the shell
it renders inside, and we consume Plan Trace as a component. **The binding consequence for
them:** Plan Trace is built shell-agnostic, inheriting its host's tokens, never as a page.

A fitting pass is expected once this programme's shell exists. That is bounded work, and
only if the component was built shell-agnostic from the start.

---

## 3. Drift, resolved

The previous cut recorded that the Project Truth WP0 commit existed at two SHAs (`9880694`
and `c598bd0`) and that this programme's master brief cited the stale one. **That is now
moot.** The whole programme squash-merged to `origin/main` through PRs #126–#140. Wave 1
ports from `origin/main` @ `9271781`, which is the only correct source and always was the
instruction.

**New drift to watch:** this programme's own base is `a849fc40`, and `origin/main` has
moved **26 commits** ahead of it. `feat/home-operating-layer` is 27 ahead / 6 behind. A
rebase onto current `main` is due before Wave 4 writes any route, and it must be one
lead-owned operation, not a lane's problem.

---

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
   Re-verified at this cut: still `438b572`, still 170.

1. Read-only outside `_wt-home-layer`. No exceptions.
2. No state-mutating git command outside `_wt-home-layer`: no `checkout`, `switch`,
   `stash`, `reset`, `clean`, `restore`, `rebase`, `merge`, `pull`, `push`,
   `worktree add/remove/prune`, `branch -D`, `gc`.

   **Amended 2026-08-17.** Rule 2 previously forbade state-mutating git *anywhere*,
   including inside `_wt-home-layer`. That was correct while the programme held only
   uncommitted lab work and other sessions were live. It is now superseded by the founder's
   direct instruction of 17 August to preserve and execute: commit, branch and push inside
   `_wt-home-layer` are permitted to the lead. Everything outside it stays read-only.
3. Never set `CI=true` in a lane worktree — pnpm purges `node_modules` junctions.
   (`_wt-home-layer` has a real `node_modules`, so this is a rule for anything we hand off.)
4. No production migration, job, deploy, merge or flag enablement before the founder's
   visual-direction selection. **Still in force** — the founder chose Option A on
   17 August, meaning round 5 runs before selection, so this programme remains in W3.
5. At every wave boundary: re-fetch `origin`, re-take this register, and if `origin/main`
   moved, stop spawning writers and integrate the new base in one lead-owned operation.

---

## 5. Actions taken that touched shared state

| Action | Date | Effect on other sessions |
|---|---|---|
| `git fetch origin --prune` | 08-12 | None. Updates remote-tracking refs only. |
| `git worktree add -b feat/home-operating-layer ../_wt-home-layer a849fc4` | 08-12 | Additive. New branch and directory; nothing existing modified. |
| `pnpm install --frozen-lockfile` in `_wt-home-layer` | 08-12 | Writes only into `_wt-home-layer/node_modules` and the shared pnpm store. `--frozen-lockfile` guarantees the lockfile is not rewritten. |
| Re-ran `scripts/home-layer/render-directions.mjs` | 08-17 | Regenerated 40 HTML renders and 160 screenshots **inside this programme's own evidence directory only**. The desk renders on disk were older than desk's own source, so the directory was showing something the code no longer produced. |
| Committed the uncommitted round-5 work (`c937960`) | 08-17 | Confined to `docs/projects/home-operating-layer/**` and `src/app/lab/home-operating-layer/candidates/**`, both owned by this programme. Typecheck exit 0 was the only claim made. |
| `git push -u origin feat/home-operating-layer` | 08-17 | Additive. Creates a new remote branch; no existing remote ref moved. 27 commits that existed on one machine now exist in two places. |

No other session's files, branches, indexes or working trees have been read for authority
or written to.

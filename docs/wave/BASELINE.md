# Untouched-baseline check results

**Commit:** `3682bf75180ac6c575133cb2008f6d4ddf8e3aee` (`origin/main`, merge of PR #123)
**Recorded:** 2026-08-12, clean worktree `_wt-project-truth`, zero dirty files
**Raw data:** `docs/wave/BASELINE.json` · **Runner:** `scripts/wave-baseline.mjs`

**Any check listed as failing here is PRE-EXISTING and may never be attributed to this
wave.** Equally, any check listed as passing here that later fails *is* this wave's
responsibility. That is the whole point of the record.

## Result: 15 of 19 pass

| Check | Result | Notes |
|---|---|---|
| `build` | **PASS** | 48s |
| `typecheck` | **PASS** | 32s |
| `lint` | **PASS** | 41s |
| `test` | **PASS** | 35s |
| `test:suite-url-and-switcher` | **PASS** | |
| `test:timeline-owner` | **PASS** | |
| `test:truth` | **PASS** | |
| `test:smoke` | **FAIL (1)** | environmental — see E1 |
| `db:check` | **PASS** | |
| `db:contract` | **PASS** | |
| `db:integrity` | **FAIL (1)** | environmental — see E2 |
| `ds:check` | **PASS** | |
| `first-contact:language` | **PASS** | |
| `journey:coverage` | **PASS** | |
| `perf:budgets` | **PASS** | passes when run after `build` — see C1 |
| `experience:fixtures` | **FAIL (1)** | genuine — see R1 |
| `experience:validate` | **PASS** | |
| `experience:test` | **PASS** | 451s, full Playwright suite |
| `experience:quality` | **FAIL (1)** | same root cause as R1 |

## Correction C1 — `perf:budgets` is not a baseline failure

The first run recorded exit 3:

```
performance-budgets: no production build found (.next/build-manifest.json).
Run `pnpm build` first. Refusing to report a measurement of zero.
```

That was **the runner's fault, not the repository's** — `build` was ordered last.
Re-run after a build, it exits 0 (`performance-budgets: ok`). `scripts/wave-baseline.mjs`
now runs `build` first. Recorded rather than quietly deleted, because a wave that
later reports "perf:budgets fixed" would otherwise be claiming credit for nothing.

Worth noting for WP11: the script passes by *declaring* its unmeasurable budgets
(`lcp_p75_ms`, `inp_p75_ms`, `cls_p75`, `server_p75_ms`, `per_route_first_load_js`)
with explicit reasons — no RUM provider is wired, and Next 16 + Turbopack no longer
emits per-route First Load JS. The plan's §13.6 performance budgets therefore cannot
be evidenced by this script alone; `shared_runtime` is the only measurable floor.
**This is a real gap in the plan's verification matrix**, not a failure.

## Environmental E1 — `test:smoke`

Every assertion fails with `fetch failed`. It is an HTTP smoke test against a running
origin; there is none in this worktree. Not a code defect. Re-evidence against a
preview deployment at each wave's deploy step.

## Environmental E2 — `db:integrity`

```
db:integrity: SQLITE_ERROR: no such table: workspaces
```

Requires a provisioned local Tasks database. Not a code defect. Becomes a genuine
required check once the WP4 two-database harness exists (D-009) — at which point it
must pass.

## Genuine R1 — stale registry materiality hashes on clean `main`

```
experience:critical-fixtures: registry coverage or materiality hashes are stale;
run with --write
```

`experience:quality` fails only because it chains `experience:fixtures`; one root
cause, two red checks.

**`main` is already carrying stale materiality hashes.** This is the D-008 cascade,
present *before* this wave touches anything. It is not fixed here: running `--write`
would rebind 78 hashes in the same commit as an unrelated contract freeze, destroying
the ability to tell which rebind belonged to which change.

**Decision:** rebinding is a Wave 8 work item with a scripted, reviewable procedure
(D-008). Until then `experience:fixtures` and `experience:quality` stay red for a
reason recorded here, and their redness proves nothing about this wave's work.

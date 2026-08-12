# Wave 0 baseline receipt

**Base SHA:** `a849fc40e46787a39e499fc94b171a5dfb898821` (`origin/main`)
**Worktree:** `_wt-home-layer`, clean at time of run
**Run:** 2026-08-12 20:20–20:24 BST · Node v24.14.1 · pnpm 11.9.0 · Next 16.2.4 · React 19.2.4
**Machine receipt:** `BASELINE.json` · **Raw logs:** `baseline-logs/`

This exists for one reason: so that no failure later in this programme can be argued about.
Anything red below was **already red before this programme touched anything**.

## Result

| Command | Exit | Time | Verdict |
|---|---|---|---|
| `db:contract` | 0 | 3s | pass |
| `typecheck` | 0 | 24s | pass |
| `lint` | 0 | 40s | pass |
| `ds:check` | 0 | 1s | pass |
| `first-contact:language` | 0 | 1s | pass |
| `check:suite-switcher` | 0 | 1s | pass |
| `check:loading` | 0 | 1s | pass |
| `check:tap-targets` | 0 | 1s | pass |
| `check:contrast` | 1 | 17s | **environment** — needs a running server, see below |
| `journey:coverage` | 0 | 1s | pass |
| `perf:budgets` | 3 → **0** | 1s | **pass on re-run after `build`** — see below |
| `test:signal-ledger` | 0 | 2s | pass |
| `test:suite-url-and-switcher` | 0 | 2s | pass |
| `test` | 0 | 47s | pass |
| `experience:self-test` | 0 | 1s | pass |
| `experience:fixtures` | 1 | 2s | **pre-existing failure**, confirmed on a pristine checkout |
| `experience:validate` | 0 | 1s | pass |
| `build` | 0 | 61s | pass |

**15 pass · 1 pre-existing failure · 2 ordering artifacts of this script.**

## The three non-zero exits, honestly

### `perf:budgets` — exit 3, then 0

First run exited 3 with `no production build found (.next/build-manifest.json) … Refusing to
report a measurement of zero.` My runner ordered `build` last. Re-run after the build:
**exit 0**. Result:

```
budget            measured        over  ceiling         target          state
shared_runtime    246.1 KB gzip   11    247 KB gzip     170 KB gzip     over-budget (ratcheted)
total_client_js   898.8 KB gzip   84    940 KB gzip     936 KB gzip     ok
largest_chunk      62.5 KB gzip   84     63 KB gzip      63 KB gzip     ok
repo_images            0 KB        0    200 KB          200 KB          no data (declared)
```

**Headroom for this entire programme: 0.9 KB of shared runtime and 0.5 KB of largest chunk.**
Recorded as `R-H01` (P0) in the risk register. This is a binding constraint on the Wave 3 lab,
not just on Wave 4 implementation.

The same output declares six things it does **not** measure and does not claim to pass —
`lcp_p75_ms`, `inp_p75_ms`, `cls_p75`, `server_p75_ms`, `per_route_first_load_js`,
`uploaded_image_delivery` — with the reason for each. No RUM provider is wired anywhere in
either repository. Recorded as `R-H05`.

### `check:contrast` — exit 1

Six surface/theme combinations reported `ERR_CONNECTION_REFUSED at http://localhost:3499`,
summarised as `0 contrast failure(s), 0 unparseable colour(s), 6 unmeasurable surface(s)`.
The gate needs an orchestrated server; my runner did not start one.

This is **correct harness behaviour**, not a defect: it refuses to report a pass on an empty
population. Recorded as `R-H04`, with the consequence that every contrast claim in Waves 3
and 10 must budget for a running server.

### `experience:fixtures` — exit 1, genuinely pre-existing

```
experience:critical-fixtures: registry coverage or materiality hashes are stale; run with --write
```

Reproduced on a **pristine detached checkout of `a849fc4`** with none of this programme's
files present. It is not caused by the programme records added on this branch. Recorded as
`R-H03` (P1): it must be resolved on a merged base before Wave 10, and never by a blanket
`--write` without inspecting every material diff.

## What this baseline does not prove

- No browser evidence. The Playwright experience suite (`experience:test`) was not run; it
  needs a server and produces its own attestation.
- No accessibility evidence. Axe runs inside the experience suite.
- No live-provider, cross-tenant, migration or rollback evidence.
- No field performance. Structurally unavailable — see `R-H05`.
- `check:contrast` measured nothing at all, and says so.

Re-run at every wave boundary. Evidence is valid only for the SHA it was taken at.

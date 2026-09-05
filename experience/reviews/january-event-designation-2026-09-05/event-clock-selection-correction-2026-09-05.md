# EV-TEST-02 — exact selected-test guard

2026-09-05. **Bounded guard correction implemented; independent acceptance pending.** Commit **80f3837b1b62341ae8a71e398b4befb7dc0f735d**, parent **93be31191b5bc4591d94225b27d2158116bb4f2f**, pushed to **feat/january-event-designation**.

Only the clock regression and its milestone documentation change. All **2467** other tree entries are identical, including the AFTER-relative test, real SQLite fixture, runtime, schema, migrations, policy, package and CI. User hooks remain intact and untracked.

The guard now requires both the exact named `# Subtest:` line and successful `ok 1 - <full case name>` record from child stdout, in addition to successful process exit and one-test passing totals. Exact matching rejects file wrappers, another selected case, and SKIP/TODO suffixed records. Stderr is retained for diagnostics, not used as execution proof.

Three committed executable cases run the same guard against actual Node child processes: the intended SQLite test under January21,2027; a nonexistent selection that Node22 counts as one passing file wrapper; and a different passing SQLite test. Both negative cases require the exact guard to throw for missing named execution. They do not waive child failures.

## Evidence

| Command/control | Actual result |
| --- | --- |
| New negative controls with the original totals-only guard | 1/3 passed,2/3 failed, exit1: both required refusals were missing. Retained in original-guard-negative-controls.json/.log with its exact source copy. |
| Corrected clock command | 3/3 passed, exit0: named test accepted; empty and wrong selections rejected. |
| Original two-file36-test command, first attempt | Gate failed, exit1. All36 test cases passed, but the unchanged webhook child also reported native exit3221225477 after its case; Node totals37/36/1 include that process failure. Receipt remains failed. |
| Exact same36-test command, one rerun | 36/36 passed, exit0. No source or invocation change between attempts. This does not explain or erase the first native failure. |
| Owning typecheck | tsc --noEmit --incremental false, exit0. |
| Focused lint | ESLint on the clock test, exit0. |

Poincare's original93be report and empty-selection receipts are preserved byte-for-byte in preserved-93be/. Its empty-selection-red receipt actually exited0: that is the reproduced defect, not a successful refusal. All earlier a59/93be evidence remains unchanged.

[verification.json](verification.json) indexes exact command arrays, cwd, timestamps, exits, tested-input hashes and logs. [source-inventory.json](source-inventory.json), [patch.diff](patch.diff) and source-tree/ pin the immutable correction and preserved source/evidence.

## Commands and remaining boundary

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/db/event-designation.test.ts src/server/db/event-designation-webhook.test.ts
node --test src/server/db/event-designation-clock.test.mjs
```

Principal's existing clock command is unchanged and now executes three cases. No package/registration edit was made here.

Windows Node22.23.2 and disposable SQLite only. No provider, production, browser, Linux/receiving or new independent acceptance claim. The Windows native teardown failure remains unexplained and fully retained; the final rerun is reported separately, with no waiver. Billing/migration suites were not repeated for this test-only delta.

No recovery/export/adapters or sales changes. Recovery remains next only after this scoped guard correction is accepted. Poincare will receive this exact commit and packet for independent inspection.

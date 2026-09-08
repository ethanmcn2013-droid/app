# Event selected-test guard — independent correction verification

**Scoped PASS: EV-TEST-02 is corrected at80f3837b1b62341ae8a71e398b4befb7dc0f735d.** Reviewed against93be31191b5bc4591d94225b27d2158116bb4f2f on2026-09-05, Windows/Node22.23.2, using fresh Git-source copies and disposable actual SQLite fixtures. No remaining actionable defect reproduced within this guard correction.

Only `src/server/db/event-designation-clock.test.mjs` and `docs/execution/january-2027/EVENT-DESIGNATION-MILESTONE.md` change. All **2,467 other Git entries are identical**, including the AFTER-relative test, fixture, runtime, schema, migrations/receipts, policy, package and CI. EV-TEST-01's previously verified date correction remains unchanged.

## Focused results

| Receipt | Actual result and interpretation |
|---|---|
| `candidate-clock` | **3/3 pass, exit0.** The exact named SQLite case passes under the January21,2027 child clock; the same guard rejects the actual nonexistent selection and a different passing SQLite case. |
| `empty-selection-refused` | **2pass/1fail, exit1 — expected independent countercontrol.** In a separate candidate copy, only the positive call's selection was replaced with the nonexistent name. The untouched guard rejected its `1..0`/passing file-wrapper output with “Expected successful TAP record…”, despite `tests1/pass1/fail0`. Both retained refusal cases still passed. |
| `totals-only-counterexample` | **1pass/2fail, exit1 — expected independent counterexample.** Removing only the named-record assertion restores the prior totals-only mechanism while retaining the three cases. Both negative controls fail with “Missing expected exception.” The positive SQLite case still passes. |

These failures are retained as failures, not translated into successful test commands. Together they show both that the new guard rejects empty selection and that the retained controls detect removal of the repair. No retry or unexpected/native process failure occurred in these three independent runs.

## Source reasoning

`event-designation-clock.test.mjs:40–54` checks successful process exit, then requires both the exact named `# Subtest:` line and exact `ok 1 - <selected name>` line from **stdout**, followed by the original passing totals. A file wrapper and another test's successful record cannot satisfy those exact lines. SKIP/TODO suffixes also fail exact matching; that statement is source analysis, not a separate executed SKIP/TODO control. Stderr remains diagnostics rather than execution proof.

The clock is still installed before fixture import, and real writer/evaluator/SQLite code remains in the selected test. Child environment filtering, timeout, and the existing fixture's fetch denial remain. The new negative controls explicitly require successful child execution before checking the named-case refusal; a crash does not masquerade as the intended rejection.

## Exact reproduction

Node executable: `C:/Users/ethan/AppData/Local/Programs/nodejs-v22/node-v22.23.2-win-x64/node.exe`.

The same command ran once in each of the three roots identified in `source.json` and each command receipt:

```sh
node --import ../deny-network.mjs --test src/server/db/event-designation-clock.test.mjs
```

Roots are `work/event-80f-review/source`, `empty-control`, and `old-guard-control`. `reproduction/prepare.py` recreates their exact differences from immutable Git; `reproduction/run.py` records command arrays, cwd, UTC times, actual child exit and logSHA. The launcher prints a receipt even for a failing child; its JSON `exitCode` is authoritative. Controls and the exact candidate test are retained under `reproduction/`.

`source.json`, `patch.diff`, and `verification.json` bind the source and results. All **55 files** in the original a59 and93be review directories were checked byte-for-byte unchanged before and after this work, including both original counterexamples. No author/principal source or hooks were modified. No dependency install or environment/provider configuration copy occurred.

## Limits

Acceptance is only for this test guard and its truthful documentation. No repeat foundation, billing, migration, full36-test, typecheck/lint, browser, provider, network, Linux/receiving, security, workbench, Atlas or RC3 work was performed. The author's separately reported full36-test first-attempt native failure remains unexplained and is not waived by this focused PASS; its later successful rerun is separate evidence. Recovery/export/adapters, enforcement and sales boundaries remain unchanged. Principal owns integration and next-milestone authorization.

# Event clock correction — independent focused review

Reviewed **93be31191b5bc4591d94225b27d2158116bb4f2f** against **a59dbd3e5a2f6fb8badb3a6de8a3c40cc6f7ffec**, 2026-09-05, Windows / Node22.23.2. Read-only Git source extraction and disposable SQLite only.

**The AFTER-relative date correction is verified. One P2 test defect remains in the new empty-selection guard; the complete correction is not yet accepted.** No runtime/schema change or runtime defect is attributed to this follow-up. This is not a repeat foundation, security, RC3 or receiving review.

## EV-TEST-02 — empty filtered run passes the claimed guard

`src/server/db/event-designation-clock.test.mjs:40–43` checks only TAP totals `tests 1`, `pass 1`, `fail 0`. Under the actual Node22.23.2 runtime, a name filter matching no test emits a passing **file-level** subtest with those same totals. Consequently, renaming/removing the targeted case can silently pass this regression without executing its SQLite assertions.

The review-only `empty-control/` copy changes only the wrapper's name filter to `INDEPENDENT_NONEXISTENT_TEST_CONTROL`. The unchanged guard unexpectedly passes1/1, exit0 (`empty-selection-red.json/.log`). That label records the intended red control; its actual receipt remains exit0 and is not treated as successful rejection. The separate direct child execution against the untouched candidate test confirms:

```text
1..0
# Subtest: src\\server\\db\\event-designation.test.ts
ok 1 - src\\server\\db\\event-designation.test.ts
...
# tests 1
# pass 1
# fail 0
```

See `empty-selected-child.json/.log`. This contradicts the new milestone statement that an empty name-filter result fails. Smallest correction: require the actual expected named test's successful TAP record (or equivalent structured evidence of that exact case) as well as the totals, and retain an executable nonexistent/renamed-selection negative control. No production change is needed.

## Verified positives

- The only changed Git entries are the corrected test, new clock test, and milestone document. **All other2,466 entries are identical**, including writer, evaluator, fixture, schema, migrations/receipts, entitlement policy, package and CI. Exact delta and inventory are in `patch.diff` and `source.json`.
- The future grant now starts at `AFTER.getTime() + 86_400_000`, after the actual evaluation instant. The new committed clock regression passes1/1, exit0 (`candidate-clock`).
- The reviewer's original, unchanged2027 clock and network-denial preloads independently run the corrected actual SQLite case:1/1, exit0 (`independent-2027`).
- In a separate copy, restoring only the a59 target test makes the exact new wrapper fail0/1, exit1, retaining actual `editable` versus expected `read_only` (`parent-red`). This remains a test-date defect, not a runtime overgrant.
- Every file in the original a59 review, including its original failing counterexample, was hash-checked unchanged before and after this work. Nothing in the author/principal tree was edited.

## Reproduction and receipts

`reproduction/prepare.py` creates exact candidate, parent-control and empty-control copies from Git. `reproduction/run.py` records the exact Node executable, arguments, cwd, UTC times, child exit and logSHA in each JSON receipt. Original preloads are copied verbatim in `reproduction/`. A runner itself printing a receipt is not the child test's exit; use its recorded `exitCode`.

From each receipt's indicated scratch root, the substantive commands were:

```sh
node --import ../deny-network.mjs --test src/server/db/event-designation-clock.test.mjs
node --import ../deny-network.mjs --import ../clock-2027.mjs --import tsx --import ./src/test/register-server-only.mjs --test "--test-name-pattern=expired/revoked/future independent grants" src/server/db/event-designation.test.ts
node --import ../deny-network.mjs --import ../clock-2027.mjs --import tsx --import ./src/test/register-server-only.mjs --test --test-reporter=tap "--test-name-pattern=INDEPENDENT_NONEXISTENT_TEST_CONTROL" src/server/db/event-designation.test.ts
```

The first command ran independently in all three roots; the other commands used untouched candidate source. Top-level processes use OS-only plus review/preview and task-local temp directories. The authored wrapper keeps its authored credential-free child environment and existing fixture fetch denial. No provider/network/browser/server actions were performed.

## Boundary

No full36-test repeat, billing/migration rerun, typecheck, lint, Linux or receiving claim. The author reports those broader fix checks separately. No new export/recovery/enforcement adapter or sales reopening is evaluated or authorized here. The original milestone's implementation and unimplemented boundaries stand. Fix EV-TEST-02 narrowly and recheck the real named case plus empty selection.

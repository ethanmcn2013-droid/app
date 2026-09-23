# EV-TEST-01 — bounded clock correction

2026-09-05. **Author correction complete; scoped receiving verification remains principal-owned.**

Commit **93be31191b5bc4591d94225b27d2158116bb4f2f**, parent **a59dbd3e5a2f6fb8badb3a6de8a3c40cc6f7ffec**, pushed to **feat/january-event-designation**. Three files changed; all other original milestone inputs have identical Git blobs. No runtime, schema, evaluator, erasure, entitlement policy, sales availability, package or CI change. Existing user hooks remain intact and untracked.

The future independent grant now starts at `AFTER.getTime() + 86_400_000`, one day after the actual evaluation instant. A separate committed Node regression runs the actual SQLite test with January21,2027 set before fixture import, retaining real writer/evaluator/persistence. It requires one passing case; a missing/renamed filtered test cannot silently pass. Child execution uses OS-only environment entries, without inherited credentials or test-worker context; the actual fixture blocks fetch.

## Red/green evidence

- Poincare's original a59 counterexample, review-only control, report and exact clock/network preloads are copied byte-for-byte under **preserved-a59/**; original outputs remain unchanged.
- **launch-regression-original-red**: the new committed regression against unchanged a59 test source fails0/1, exit1, with actual `editable` versus expected `read_only`. This is retained failure evidence, not an entitlement overgrant.
- **event-suite-fixed**: exact original two-file serial command passes36/36, exit0.
- **launch-regression-fixed**: the identical committed clock regression passes1/1, exit0.
- **reviewer-clock-fixed**: Poincare's unchanged January2027 clock and network-denial preload run the actual corrected case;1/1, exit0.
- **focused-lint**: ESLint on both test files passes. **typecheck**: owning `tsc --noEmit --incremental false` passes.

Exact executable/argument arrays, cwd, timestamps, exits and log hashes are retained in each JSON receipt and indexed in [verification.json](verification.json). [source-inventory.json](source-inventory.json) records immutable file/blob hashes, unchanged original milestone inputs and preserved evidence hashes. [patch.diff](patch.diff) and source-tree/ contain the exact fix.

## Mandatory registration

Principal retains package/default integration ownership. Keep the original36-test command and append the clock regression:

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/server/db/event-designation.test.ts src/server/db/event-designation-webhook.test.ts
node --test src/server/db/event-designation-clock.test.mjs
```

The new test can also be added as a third file to a serial Node gate; the unchanged36-test command and standalone regression were the commands executed here.

## Limits and next decision

Only EV-TEST-01 is corrected. Windows/Node22.23.2 local isolated SQLite evidence; no new Linux/receiving, provider, browser, human or council claim. Billing/migration gates were not rerun for this test-only delta; prior evidence is retained, and their source is unchanged. No remaining failure on the corrected commands. The old red receipt retains its failed status.

The accepted read-only recovery sequencing remains planning only. Export/recovery/adapters are not implemented, Event sales remain held, and the first milestone does not establish complete Event closure. Await this scoped correction's acceptance before further implementation.

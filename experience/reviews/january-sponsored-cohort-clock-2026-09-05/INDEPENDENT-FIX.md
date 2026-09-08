# Sponsored acceptance clock correction — independent verification

**Scoped PASS for6d49de5490878e6d6cfc275c659cf8671fc8f62b**, parenta8c225c7fadcdfc2ef0521f4de36c481185817fc, paired Studio4ed9be64be4f351c5a3e7aa2b396e92d9be570bf. No actionable defect reproduced in this fixture correction or mandatory clock wrapper. Verification date2026-09-05; Windows/Node22.23.2; independent Git-source copies and the actual isolated paired SQLite/action/route acceptance.

## Results

| Receipt | Actual result |
|---|---|
| `candidate-four-clocks` | **Exit0; four completed nine-check reports.** September5 at08Z,15Z,21Z and January21,2027 at21Z all pass. Each report contains the same nine check names as the original acceptance story, including both privacy thresholds, authenticated exports, erasure and retention. |
| `original-mutable-terms` | **Expected exit1.** Only the quiet-grant expressions are restored to mutable `now`. The08Z story passes; the15Z story fails the added real-cohort assertion with actual2 versus expected3. The unchanged wrapper rejects the failed child and stops. |
| `empty-report-and-network-probe` | **Expected exit1.** A replacement test-only child validates the wrapper's clock, environment filtering and network-denial functions, then exits0 without a completion report. The wrapper rejects it with `Require one completed actual acceptance report`. No acceptance story is claimed for this probe. |
| `failed-child-with-report` | **Expected exit1.** A replacement test-only child prints a synthetic report with the expected nine-count shape but exits7. The wrapper rejects the nonzero child exit before accepting that report. No acceptance story is claimed for this probe. |

The denial probe checks the actual installed function identities/source before invoking the known throwing stubs, with no destination or socket arguments. Fetch rejects; HTTP/HTTPS request/get and net connect/createConnection throw the intended denial. It also confirms three synthetic parent sentinel variables are absent from the child, `NODE_ENV=test`, and the initial08Z clock is installed. No network connection was attempted by this probe.

## Source review

The exact diff contains only `package.json`, `scripts/sponsored-use/acceptance.cjs`, and new `scripts/sponsored-use/acceptance-clocks.mjs`. **All2,562 other Git entries are identical**, including every runtime, schema, migration, privacy rule and lockfile.

The acceptance change anchors quiet grant start/expiry to immutable `app.now`; it retains the advancing maintenance/retention clock. The new assertion checks one actual persisted daily row with three eligible Projects before the original threshold3 projection/export checks. All original check bodies remain, with only this fixture term correction and additional cohort assertion.

`package.json` changes only the mandatory `test:sponsored-use:paired` script to the wrapper. The wrapper resolves the supplied paired checkout and invokes the original `acceptance.cjs --studio-root ...` CLI in each fresh child. Its OS-variable allowlist excludes provider/store settings and inherited `NODE_OPTIONS`; each child receives the authored network-denial and clock preload. It requires no spawn error/signal, exit0, exactly one stdout completion report, nine passing/check entries, `providers:false`, and `network:"local Request only"`. Stderr is retained for diagnostics, not parsed as completion evidence. The independent controls exercise empty completion and nonzero-exit rejection directly.

No threshold or production behavior changed. The prior diagnosis and all32 files in its output packet remain byte-for-byte unchanged.

## Reproduction

Exact Node executable: `C:/Users/ethan/AppData/Local/Programs/nodejs-v22/node-v22.23.2-win-x64/node.exe`.

```sh
node scripts/sponsored-use/acceptance-clocks.mjs --studio-root <isolated-Studio-4ed-root>
```

The same command ran in `work/sponsored-6d49-review/app`, `mutable-control`, `empty-control`, and `exit-control`. `source.json` defines the deliberate scratch-only differences. `reproduction/prepare.py` recreates them from immutable Git, and `reproduction/run.py` captures each exact executable/argument array, cwd, time, exit and logSHA. Countercontrol scripts are preserved alongside the exact candidate wrapper/acceptance source. The launcher prints receipts even when a child fails; each receipt's `exitCode` is authoritative.

`verification.json` records source integrity, four exact completed story reports, original-name parity and preserved diagnosis hashes. `patch.diff` is the reviewed immutable delta. Existing dependencies were used read-only; no environment file/provider configuration was copied. Raw synthetic databases remain in scratch.

## Boundary

This is the requested fixture/wrapper verification before push. No broader service/security audit, provider, browser, build, runtime repair, schema edit, RC3/Atlas/workbench, Linux rerun or receiving acceptance. Principal's focused lint is separate author evidence and was not rerun here. The original Linux failures and diagnosis remain preserved; this scoped PASS does not relabel them. Principal retains push/integration ownership.

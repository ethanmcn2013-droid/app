# Independent review: grouped A3 recovery and gated workflow

Reviewer: Codex independent reviewer (`/root/r2_independent_review`)  
Review date: 21 October 2026  
Scope: frozen A3 recovery runner/helper/tests, workflow, setup script. Read-only review. No key file was opened; no provider requests or GitHub mutations were made.

## Decision

**Code review: no blocking defect found in the frozen recovery path.** The continuation now carries all six ordered A cases, while dispatch is limited to A4â€“A6. A3 is recorded as a provider-side HTTP 499 with no model answer and zero quality credit; its 19,049 input tokens and $0.038098 are explicitly represented as observed input usage and estimated cost, not a verified invoice. The original two-call report and database remain hash-pinned and untouched.

The runner checks scope, source snapshot, report, backup DB, provider observation and independent review; verifies the cloned pending reservation and absence of task effects; then records A3 failure via the canonical store and verifies the resulting row and unchanged task digest. It reads the API-key file only after reconciliation and source/context checks. The recovery claim is a fixed `OUTPUT_ROOT` path keyed by original report SHA and A3 run ID; dry-run does not claim. The clone uses exclusive creation. A failed or interrupted claimed recovery intentionally cannot be retried under a new output path.

The workflow is currently inert because its live job condition begins with `false &&`. Its provider-free job is restricted to the named repository/branch and uses pinned action SHAs. In the live job, the reviewed source/workflow/template checks, provider-free action check, seed checksum and bounded extraction all precede the two A3 clone/reconciliation dry-runs; those run before the API-key secret is passed to the execution step. No purchase, production data or delivery path is enabled. The separate setup script sends the existing key and synthetic seed to encrypted GitHub environment secrets through stdin and does not print their values. I did not inspect its sibling key file. Existing key scope/expiry was confirmed separately by the run owner, not by this script review.

**Evidence limitation:** the workflow's final artifact glob preserves `approved-...*.json` results but excludes the `ci-...-action-check.json` receipt and `$RUNNER_TEMP/ping-r2-recovery-approval.json` whose hash is carried in A's lineage. Preserve those two proof inputs in the run artifact (never the API key) so a later reviewer can reproduce the lineage check. This is a custody improvement, not a code-safety blocker to the planned run.

The planned Linux same-job `--resume-a3 --dry-run` should still pass against the decoded seed before the secret-bearing execution step. Parent-reported guard tests, scoped lint, YAML parse and full TypeScript check passed; I did not independently rerun them. **This verdict is not a model-quality score, a production acceptance, or permission to call the provider.**

## Reviewed frozen-input hashes

The product/recovery files below were read in the worktree at base commit `5e0f0fa3205b5aa549d5cb8396581918a4f76fce`; hashes are SHA-256 of the exact working-tree bytes. The workflow and setup script are separately listed because the workflow was still untracked at review time.

| File | SHA-256 |
|---|---|
| `experience/ping-assistant/release2-model-eval.ts` | `87b23d0c719bb51f2f81ab5f7e22499ba17da5c02916e4f5a6b49b24c018224b` |
| `experience/ping-assistant/release2-partial-recovery.ts` | `64dc113319600c99c7ab3c647ec94a8ce6bda199f855cfda09ed2380cdc5b5a8` |
| `experience/ping-assistant/release2-partial-recovery.test.ts` | `7d55c9f3a7329693816e08fd1d255cd6047ca6013105b3dd0dda50732869b9f9` |
| `experience/ping-assistant/release2-recovery-approval.template.json` | `b542bca76335dbc243cb3f02cc1d7a1f0aa3a06d1628df2623f4fbdc9392ba5e` |
| `experience/ping-assistant/README-R2-EVAL.md` | `885fbd329b9dddd314bbcb7553a6c039b939bfa17165b35922d6d93fa60b6780` |
| `.github/workflows/ping-release2-synthetic-eval.yml` | `df43c3aff404aaadfe521db02659e8e01452bfa1a9c384330b5d6f259488ac85` |
| `D:/Codex-scratch/project-ping/release2-private-oct21/setup-linux-eval.py` | `b740f486b329ab2e94bb8f84220f70e04bc2f92f483756e267c74ac8eacecc72` |

## Workflow addendum — final pinned candidate

Reviewed after the recovery source commit `1658de713f1d059984a4f01ae7652b3b7e4b9273`. The final workflow candidate SHA-256 is `696b3ee7ea272db2892433738dc8a2dab5e0cb333a78496f94e93e4bed87b881`.

The live job is no longer hardcoded false, but remains gated on the exact repository, actor, branch, approved source SHA, matching workflow SHA, approved template SHA, first run attempt, and dedicated environment. Provider-free checks and the A3 clone/reconciliation dry-run happen before the step that receives the environment key. The final artifact glob now includes the generated recovery approval and provider-free action-check receipt, closing the evidence-custody gap noted above. **No workflow blocker found.** The setup script was not executed and no key, environment, repository variable, or secret was read or changed by this reviewer.

The owner separately reported a provider-free canonical accounting proof (`offline-a3-canonical-accounting-proof-2026-10-21-02.json`) showing the cloned canonical row reconciled to failed/usage-observed at 19,049 input, zero output, and estimated 38,098 micro-USD, with all 17 task rows unchanged and no external calls. This is owner-reported evidence; I did not independently inspect that proof file. The planned same-job Linux pre-key dry-run remains required before any provider call. This does not constitute a model score or production acceptance.

## Line-ending normalization note

The earlier workflow hash `696b3ee7ea272db2892433738dc8a2dab5e0cb333a78496f94e93e4bed87b881` identifies the raw working copy. Converting only CRLF to LF gives the Git-stable workflow hash `f6661a898a1c21f68dcf580e624dbcf48ad8eec6b1f25008a8c6ac3b5ccb9959`. The reviewer confirmed this formatting change does not alter workflow logic.


## Seed-pin correction addendum — 21 October 2026

Reviewed the corrected pin-only recovery delta at source commit 75088b0f43c1fe016250d8cf54f16681b0d0cff1. The Git-stable workflow candidate SHA-256 is 48a490df4d1219f1c91649aea7fe5f7b2ff9b193448e5ac9327e2629e6c7bb76. The prior failed Linux run 39630428565 is retained as failed; the owner reports it stopped at seed verification before the key-bearing step, with zero provider calls. It is not relabeled or counted as a model attempt.

The prior seed bundle SHA remains 20f6f722e427e398e5f09b26369f54b25a53971dfb8ba387efcc18d474e45da3. I independently hashed the embedded provider-review.md entry: 1,990 bytes, SHA-256 c696caaed356820792cceb6d412b677d71a5f745f44ef8e3b1aed5c7df9e05f8. The corrected approval template hashes to 9f6619d1946c8a23de8ecd3461186c3cac9f032bd03d67231847f2d5b3852073; both match the updated bindings. Guard tests now reject malformed SHA lengths and assert the actual template/review bytes. No seed, review, report, database, source, or fixture evidence was rewritten. The original three physical attempts and estimated $0.118528 remain unchanged.

The scoped source comparison from 1658de713f1d059984a4f01ae7652b3b7e4b9273 to 75088b0f43c1fe016250d8cf54f16681b0d0cff1 shows no diff in Ping server/client, conversations, app/messages, package or lockfile inputs. Removing only the duplicate Ping/conversation suites from this temporary provider-free workflow is acceptable against the reported passing Linux run for 1658; the recovery guard, dry-run/action checks, clone reconciliation, and normal merged-PR gates remain. No blocker found; workflow has not been executed by this reviewer and no key or provider call was used.


## Exact line-ending bridge and final workflow custody - 21 October 2026

Independent reviewer /root/r2_independent_review reviewed the source bridge committed as 3dfaee21820ab3a3edf245877e647924d325cdfa and found no blocker. It accepts only src/server/ping/assistant/task-context.ts, pinned historical raw SHA 8eaeb0c9de2c067f8897430d67bbd3f25b55901965174905fee21388fe0f0a94, and canonical LF SHA 54b351fa66f10a561d09bcc16b026ed7c5e9deae6fafdb1cc9bfeeafded89cfb. Ordinary expected-SHA equality remains the default. The migration is retained in recovery lineage without rewriting the historical source snapshot. Tests reject a wrong path and changed bytes. The reviewer independently verified that the canonical LF content equals the exact Git blob; only four CRLF line endings differ. This is a bounded byte-identity bridge, not a general source-drift waiver.

Root ran the recovery guard (1/1 pass), scoped ESLint (exit 0), and git diff --check (exit 0) against the bridge. The three prior Linux failures (39630428565, 39632115866, 39632593448) are preserved as pre-key setup failures with zero new provider calls. Original physical attempts remain 3 with estimated usage $0.118528.

The reviewer also accepted the two workflow source-pin replacements and checked the producer/consumer recovery-preflight filenames match. The final consumer now checks the same persisted fields as the producer instead of a recoveryChecked value that was only returned to the CLI. These checks run before writing the API-key file. The final workflow hash and final predicate verdict are recorded separately by the run owner after review.

Final predicate review: no blocker. The independent reviewer verified the exact checkout/head pins, matching preflight paths, zero calls/spend, carried three attempts and $0.118528, unchanged task digest, and A3 no-answer/no-quality-credit status; missing or malformed fields fail closed. Frozen workflow SHA-256: 61a5b5b1ab1cd4439a25870d3a6d61647b3e580021aca4a3929bbd7e44850e51. This review is not a model score or production acceptance.

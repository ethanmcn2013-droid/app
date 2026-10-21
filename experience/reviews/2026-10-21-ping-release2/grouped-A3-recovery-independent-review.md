# Independent review: grouped A3 recovery and gated workflow

Reviewer: Codex independent reviewer (`/root/r2_independent_review`)  
Review date: 21 October 2026  
Scope: frozen A3 recovery runner/helper/tests, workflow, setup script. Read-only review. No key file was opened; no provider requests or GitHub mutations were made.

## Decision

**Code review: no blocking defect found in the frozen recovery path.** The continuation now carries all six ordered A cases, while dispatch is limited to A4–A6. A3 is recorded as a provider-side HTTP 499 with no model answer and zero quality credit; its 19,049 input tokens and $0.038098 are explicitly represented as observed input usage and estimated cost, not a verified invoice. The original two-call report and database remain hash-pinned and untouched.

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

# Event designation milestone — ready for independent immutable verification

Commit **a59dbd3e5a2f6fb8badb3a6de8a3c40cc6f7ffec**, pushed to **feat/january-event-designation**. Base **8172364e3f7ba8332b4ce7a73ae4563a34b7867c**. Only the separate owned App writer changed. Principal evidence/Drive updates were not composed.

The 17-file milestone records fresh owner-at-checkout and owner-at-settlement designation, preserves the original positive term separately from monotone revocation, records paid-but-undesignated reconciliation, and supplies an explicit internal project-access result. Event sales remain held. **No enforcement adapter is wired.**

## Exact verification

| Gate | Result |
| --- | --- |
| New Event SQLite/action/signed-local-webhook suite | 36/36; exit 0 |
| Existing billing gate | 40/40; exit 0 |
| Database migration contract | 66/66; exit 0 |
| Existing actual account-erasure suite | 10/10; exit 0 |
| Tenant and billing source contracts | 28/28; exit 0 |
| Ambient lookup ratchet | Pass |
| Typecheck | Pass |
| Focused lint | Pass, no warnings |

Commands, exit statuses, log hashes and file receipts are in [verification.json](verification.json). Exact Git blobs plus raw and LF-normalized SHA256 hashes are in [source-inventory.json](source-inventory.json) and source-tree/. [IMPLEMENTATION.md](IMPLEMENTATION.md) describes lifecycle/precedence and registration.

## 0031 storage and erasure

Allocation **0031_event_purchase_designations.sql** is reserved by principal, not schema-accepted. Canonical LF SQL SHA256: **139892f27ff427e36ede52e470ec94f32eabfb7ad5308a0906e8c31f922c60d3**. One table, two indexes, three triggers and twelve receipt proofs. Its checked-in receipt permits local/CI rehearsal only. Apply the migration before this writer code; even legacy Event settlement reads the table.

The actual account eraser is tested after primary-owner transfer in four controls: **foreign keys ON/OFF × refunded/unrefunded**. It removes purchaser, payment reference, checkout identifier and authorization timestamps, rotates the private row identifier, and preserves only the surviving project's original term/designated state/sticky revocation. Pending/undesignated facts are removed. No shared-entitlement reader or erasure-orchestrator file changed. Explicit migration delete triggers also operate with FKs OFF. Actual project deletion removes remaining effects.

Retained positive evidence with erased payment provenance returns verification_unavailable, not fabricated cover/archive rights. Retained negatives cannot become positive or unmanaged. Stale orphaned mirrors cannot restore access. Independent current-owner/account or explicit project cover still applies. Direct SQL probes refuse re-identification, reference/project/term rebinding and refund reversal.

## Allocation and writer inventory

The initial inventory found clean `fix/january-event-post-window` at `027612d8677e9c60442a4e3fde1ea9e82d1b5098` (retained characterization) and `fix/january-event-availability` at `a10432ddabc73d968e0ecea833760a0f40b28dd1` (sales hold). Neither contained designation work to resume. The new branch/path were absent before creation. All live App worktrees had migrations only through 0030 before this lane; the final local inventory found 0031 only in this owned writer, matching the principal's explicit reservation. No other checkout was edited. The new worktree installed pinned dependencies offline with its own node_modules; package/lock and credentials were not copied or changed. User hooks remain intact and untracked.

## Retained failures and limits

No unresolved test failure remains. Draft type/tenant/rollback failures and two Windows monolithic native-exit failures are retained in retained-development-outputs/. The native failures occurred after all assertions passed, with exit status 3221225477; they are failed gates, not passes. Splitting the actual HTTP harness into its own test process retained the same real persistence assertions. The final two-file command passed 36/36 with exit 0. No native root-cause or Linux observation is claimed.

Principal must register the exact two-file Event command in the mandatory default gate; package/CI/experience registry were not edited. The migration test is already in db:contract. Poincare's independent business-rule/SQLite verification is the next gate; these are author-run receipts.

Remaining Event closure: recovery (including erased-purchaser verification and owner export/delete), export projection for these new private checkout facts, actual private/mutation/attachment/Timeline/public/metadata/cache adapters, honest rendered states, explicit-project checkout UI, operator historical evidence, provider rehearsal and receiving acceptance. Do not treat unknown history as historical designation or verification_unavailable as unmanaged access. No sales reopening, production migration, historical backfill, real provider observation, human comprehension or council certification is claimed.

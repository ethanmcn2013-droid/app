# Drive completion recovery — independent security verification

**Verdict: no validated security defect found in this bounded change.** Thirty-nine independently constructed behavioral checks passed, including competing remint/finalize, real SQLite rollback, membership/erasure changes and paginated marker ambiguity. This is a scoped result, not blanket security approval or live-provider acceptance.

Candidate: `3caf63566a69f7eae5ed16e67b384639848ccaa7`  
Exact parent: `6a8095dbe1307183c99b2c464a50284b37db3672`  
Integrated snapshot: `f5bc6f251646b41d4bcbc06f5ee911812ba80a53`

The candidate is an ancestor of that integrated snapshot. Every one of the 20 backend/helper modules loaded by the independent harness is byte-equivalent between these two snapshots, including `project-authz.ts`, capability rules, access service and deletion-fence code. All source execution used `git show` at the immutable candidate; no mutable worktree runtime files were executed. Core advanced to `4305beab94549e75ad45809852ceb8ddd21cc39d` during review, with other agents' uncommitted work also present. **Those later states, particularly future Event/project-authz changes, are outside this verdict.**

## Boundary assessed

The untrusted entry is `recoverDriveUploadAction(taskId, resourceId)`. Its sensitive operations are access to the storage owner's credential, inspection of a previously delegated upload, and adoption of provider completion into a Project resource.

The caller supplies neither a provider file ID nor a replacement session URL. The action derives the Project from the stored task, and the service independently binds the resource to that task, Project and original uploader. A board owner who did not upload the file cannot use recovery on the uploader's behalf. The new path shares existing receipt refresh and completion helpers; it does not call mint, quota fallback, deletion or erasure-repair APIs.

## Evidence and attempted refutations

All source locations below refer to the immutable candidate.

| Property | Concrete evidence and independent challenge |
| --- | --- |
| Original uploader and exact task/Project | `src/server/actions/drive-upload-recovery.ts:9` derives stored scope and freshly authorizes it. `src/server/connections/drive-uploads.ts:861` checks original uploader, stored task/Project and resource shape. Owner-not-uploader, another member, outsider, wrong task, moved task and missing/malformed resource IDs returned only `unavailable`, without provider calls. |
| Current authority before provider work and adoption | Recovery preflight at `drive-uploads.ts:886` checks archive, membership, Project deletion and both uploader/storage-owner lineages. Receipt refresh at `:817` and completion at `:598` repeat the relevant checks in the writer transaction. Pre-existing member removal, archive, owner demotion and actor/owner/Project fences caused zero provider calls. Changes during OAuth refresh prevented the status probe; member removal/archive/erasure during the probe prevented adoption. |
| Historical storage lineage | Access selects the exact stored generation; `project-drive-access.ts:271` restricts refreshed credentials to that generation's owner/provider-account lineage. A legitimate original uploader recovered a file in the historical folder without management authority or retargeting it to current storage. |
| Exact completion evidence | `drive-uploads.ts:334` checks the marker, sole original parent, MIME, exact size, non-trashed state and trusted Drive link. Wrong parent, trashed file, wrong MIME and external link were refused without adoption. Existing expected metadata also participates in the local completion CAS. |
| Global marker ambiguity and no mint | `drive-uploads.ts:573` searches without a parent restriction, follows pagination and rejects multiple matches/exhausted page bounds. An apparently valid first-page file followed by a second-page duplicate was refused. Wrong-folder matches and a ten-page unresolved search were refused. An expired session with no match stayed pending. Undelegated and incomplete claims never minted, sent bytes, deleted, checked quota or fell back. |
| CAS and partial database failure | Completion's predicates bind the resource, task/Project, generation, uploader, creation time, metadata, state, ciphertext and refresh stamp. Independent-connection changes to creation time, title, size, quota flag, ciphertext, refresh stamp, external ID or row existence all defeated stale adoption. A SQLite trigger rejecting completion left the pending ciphertext intact; removing the trigger allowed retry to complete the same row. The earlier receipt-refresh timestamp can legitimately remain committed. |
| Interaction with remint/finalize | A normal remint during recovery's status probe persisted its new capability; stale recovery returned `unavailable` and did not clear it. Recovery invoked while a remint was prepared returned pending, after which the mint persisted once. A normal finalize invoked during recovery retained the completed row while the stale recovery lost its CAS. No duplicate resource or lost completion appeared. |
| Response and locking | The actual action returned fixed strings only. A fabricated provider error containing private details did not escape. Demo/disabled branches performed no provider work. Async-context instrumentation checked every stubbed provider call for an enclosing write transaction, with violations recorded outside the action's catch so they could not be hidden by `unavailable`. No violation occurred. Recovery's preflight, refresh and completion used immediate transactions; the exercised shared remint/finalize interleavings completed without deadlock. |

The client wiring was also traced: `resources-section.tsx` filters saved pending rows by uploader, `use-drive-upload-recovery.ts` invokes the action, and `project-drive-upload-recovery.ts` accepts fixed recovery states then refreshes canonical Resources. The resource-list mapper converts stored `drive` to client `google_drive`. These client checks are convenience filtering; the security result rests on the server checks.

## Independent reproduction

Task scratch contains:

- `work/drive-recovery-security-review/proof.cjs`
- `work/drive-recovery-security-review/results.json`

Both are under:
`C:/Users/ethan/Documents/Codex/2026-09-04/here-are-6-prompts-i-have-2`.

Run the proof with bundled Node:
`C:/Users/ethan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.

The harness compiles immutable TypeScript modules in memory and runs their actual SQL against disposable file-backed libSQL databases, with a second connection for competing mutations. It uses fabricated keys and provider fixtures. The actual recovery action, authorization functions, access service, upload service, verifier and crypto routines execute; authentication/environment construction and provider transport are substituted. An unconfigured network call is rejected. Fixtures verify zero-byte status probes and reject unexpected provider operations.

**Result: 39/39 passed, exit 0.** The reported 81 UI/recovery and 85 upload/handover tests were not rerun or treated as proof of correctness in this verification.

## Findings and limits

No newly introduced or inherited exploitable defect was validated on the reviewed recovery path, so no severity-ranked finding is issued. This does not dismiss possible defects outside the exercised path.

The reviewed fences order local writes and reject stale authority at the checked boundaries. They do not promise cancellation of an already authorized, in-flight provider request. The completed-row fast path reports status without provider access or a new adoption; this review does not establish a broader read-revocation policy.

Remaining checks are specific: independent review of any later project-authz/Event composition; real Google and remote libSQL behavior under network/commit-acknowledgement failure; and full combined CI. The local locking tests demonstrate the selected interleavings, not every possible distributed schedule. General closed-tab byte resumption, browser/human comprehension and unrelated Drive policy were not assessed.

No repository/runtime edits, commits, providers, production access, pushes or merges were performed. Only this report and disposable task scratch were written.

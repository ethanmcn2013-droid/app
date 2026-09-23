# Completion recovery after closing a tab

Internal implementation, 4 September 2026. Branch `fix/january-drive-upload-recovery`
starts at January core `6a8095dbe1307183c99b2c464a50284b37db3672`, including the billing
merge after `66f10668`. Worktree:
`C:/Users/ethan/signal-studio-workspace/worktrees/app/fix-january-drive-upload-recovery`.
The lead owns integration and the Studio status update. Nothing is pushed, merged,
deployed or exercised against a real provider by this task.

## What changed

The original uploader can use **Check for updates** on the pending-upload notice
after reopening a task. It checks their saved, unmounted Drive claims and then
re-reads canonical Resources. A verified finished Google file becomes the same
resource, retaining its ID and storage generation. Another member, including a
board owner who did not upload that file, can refresh the saved list but cannot
probe that person's upload. An original uploader who is still a task-editing
member does not need board-management authority.

The new `recoverDriveUploadAction(taskId, resourceId)` derives authority from the
stored task. Its service method lives in the existing `drive-uploads.ts` closure
to reuse the ordinary generation-bound access, status probe, global marker lookup,
receipt refresh and exact-file completion writer. It does not use account-erasure
receipt authority or recovery methods.

Before credential/provider access, the service proves the original uploader,
stored task/Project, current task-edit capability, archive state, generation and
account/deletion fences. It re-proves task authority in the receipt refresh and
completion transactions. The completion CAS still binds the exact metadata,
uploader, generation, ciphertext and refresh timestamp; erasure, membership and
storage-owner checks share its writer transaction. A competing lease/session or
finalize can win, in which case recovery returns unavailable and the UI re-reads
the canonical row. Provider I/O is outside the writer transaction.

The shared receipt-refresh and completion helpers now use immediate transactions;
recovery adds a timestamp expectation and fresh task proof. Their existing upload
callers keep the same behavior. Recovery updates the existing activity timestamp
as part of that shared receipt protocol; it creates no separate lease or table.

A zero-byte status probe may return completion directly. An expired session uses
the existing marker search without a parent filter so ambiguous/wrong-folder
matches cannot be hidden. Adoption requires the exact marker, single original
parent, MIME, size, valid link and non-trashed file. Empty, incomplete, expired with
no matching file, or undelegated claims stay pending. Provider errors and stale
authority return a fixed unavailable state, without identifiers or error detail.

There is no recovery path to a replacement session, byte sending, reselecting a
file, content-digest schema, native fallback, quota cleanup or deletion. A closed
tab with an incomplete upload still cannot resume bytes. This supersedes only
the saved-list-only limitation in `UI-FOLLOW-UP.md`; broader upload/provider and
human acceptance gates remain open.

## Checks and evidence

- `node scripts/test-project-drive-ui.mjs`: **81 passed**, including the original
  38-test scope, 33 new backend recovery cases, nine controller cases and one new
  rendered notice case. Demo/flag-off import isolation now includes the recovery
  action.
- Existing `drive-uploads.test.ts`, `project-drive-storage-handover.test.ts` and
  `project-drive-hard-rules.test.ts`: **85 passed**. These ran after the shared
  transaction changes; the later timestamp expectation is recovery-only and is
  covered by the 81-test final run.
- `tsc --noEmit --incremental false`: passed after the final implementation.
- ESLint over the changed TS/TSX/MJS files: passed, zero warnings. An initial
  render-time ref assignment was corrected to an effect before this pass.
- Module boundaries, ambient-workspace ratchet and first-contact language: passed.
  Language scanned 350 TSX files with seven unchanged baseline occurrences.
- `git diff --check`: passed. The two Resources experience entries have scoped
  source/hash receipts, retain partial coverage, and claim no quality score or
  independent approval. Their inherited critical-fixture attestation is explicitly
  historical context, not a new critical-suite run.

The existing `DriveUploadReview` fixture was exercised in the actual App route
`http://127.0.0.1:3142/app/tasks?task=demo-t-01`: select **Pending after reload**, then
**Still incomplete**, **Finished in Google Drive**, or **Could not check**, and click
**Check for updates**. Desktop 1440×1000 covered incomplete/completed states; mobile
390×844 covered unavailable; tablet 768×1024 covered incomplete; wide 1920×1080
covered completed. No horizontal overflow was observed on mobile/tablet/wide.
The verified browser session had no warning/error console logs or framework overlay.
The fixture uses local state only; these screenshots do not prove live recovery.

Screenshots and their manifest are under `ui-evidence/upload-recovery/`. The preview
used `next dev --webpack --hostname 127.0.0.1 --port 3142` with review access mode,
preview deployment mode and the Drive UI flag enabled. No environment files were
copied. The initial shared dependency junction could not resolve packages in
webpack; it was replaced only in this task worktree using
`pnpm install --offline --frozen-lockfile --ignore-scripts` (748 cached packages,
zero downloads, no manifest/lockfile changes). Initial cold navigation timed out;
the recovered preview returned HTTP 200. The dev compiler emitted inherited
OpenTelemetry dynamic-require warnings. The preview is stopped after verification.

## Handoff boundaries

No live Google, production data, full application build/full suite, performance
gate, or independent security review of this new recovery code is claimed. Lead
should integrate the commit, run combined CI, and obtain the independent review
before provider acceptance. The prior clean Drive UI security report at `50f16575`
does not cover this new backend capability.

Studio owner should record: completion-only recovery is implemented and locally
tested; general closed-tab byte recovery remains unavailable; live provider
acceptance and January release gates remain open. No publication/outreach or
production change is authorized by these receipts.

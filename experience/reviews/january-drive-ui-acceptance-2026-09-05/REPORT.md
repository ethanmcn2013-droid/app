# Project Drive: bounded A Custodian UI milestone

Frozen runtime **8ae94ffb4e74bd21ba652f0117417afa03ed43a3**, branch **fix/january-drive-ui-acceptance**, base **6ebf71ef595ac2dd5f0c77ff0725758acc30f0fd**. Principal stayed read-only to this task; its docs/evidence-only ce81e066 follow-up has the same runtime source as6eb. This seals two small UI fixes and their local component evidence; **full Drive acceptance remains open**.

## What changed

- Connections now explains ownership, visibility and Google-space use before initial Connect and separate Use my Drive setup, when no owner is selected. Before: the disclosure was conditional on ownerName. Reproduce with not-connected or connected-no-folder fixture; old source fails the added assertion, fixed source passes. Connected-owner and separate-consent/setup copy remain intact.
- Keyboard cancel returns focus to Disconnect my Drive; Go back returns it to Review owner change or Continue saved change. Before: all three paths left focus on BODY at390/1440. Fixed actual React components restore visible focus, without changing permissions or handover choices.

Runtime commit changes only connections-view.tsx, drive-handover-view.tsx and the directly proportional project-drive-follow-up.test.tsx. The later sealing commit adds fixtures, this evidence and the owning STATUS checkpoint only. No package, CI, registry, principal or provider changes.

## Current coverage and retained evidence

| Area | Actual new local evidence | What remains outside it |
|---|---|---|
| Ownership before consent | Both initial states at390/1440; actual disclosure precedes action; old-source negative and fixed6/6 | No OAuth consent/provider action |
| Access/reauth | Connected, exact live-result labels, gaps, unavailable, refresh clearing old access, reconnect, loading/failure/retry | Live permissions are injected; no membership-as-permission claim |
| Disconnect/handover | Explicit confirmation, safe initial focus and return, unconfirmed action message, saved target, blocked/no eligible owner, archived/member | Persistent unconfirmed revocation after remount is NOT closed; see separate investigation below |
| Quota and fallback | Existing free/paid native display thresholds, Drive-full message, explicit native choice, uncertain native result | Existing fallback constants are not new commercial approval; no live quota read |
| Upload | Actual Resources/hooks/machine: confirmed50% progress, stop, same-resource-ID retry, uncertain create, finalize wait, success | Byte/action ports injected; no actual50MB/provider test |
| Recovery | Parent intake/drop blocked, original uploader probe vs other uploader list-only, completed adoption reloads resources, incomplete/unavailable/checking | Lost incomplete-tab bytes cannot resume; no new mint or provider adoption proof |
| Disabled/native | Actual flag-off and member restriction; native fixture dispatch without Drive create | UI flag is not backend kill switch; no native store contacted |
| Responsive/focus |76case matrix,92screenshots; plus14supplemental checks/screenshots;390/768/1440/1920, light/dark, no observed overflow, keyboard paths and settled resource geometry | Not every state at every width/theme; no human/screen-reader/council acceptance |

The original matrix has8/14 current source hashes; its changed-shell images remain historical context. The saved-upload recovery matrix has5/5 current source matches and remains valid for its declared synthetic notice behavior. New parent/controller evidence fills its missing intake/recovery interactions. General132 built cases do not substitute for these Drive states. COVERAGE-BEFORE.md retains the original gap map.

## Exact validation

All commands use Node22 v22.23.2 and existing dependencies read-only. Full commands/working directories/exits are in receipt.json and the archive.

- run.cjs focused baseline-focused:9declared files,81/81, exit0, isolated test SQLite/provider ports.
- verify-fix.mjs unit-baseline: same6tests with immutable6eb ConnectionsView,5pass/1expected fail, exit1. unit-fixed:6/6, exit0.
- verify-fix.mjs typecheck: strict changed3roots and transitive imports,0diagnostics, exit0; **not full App typecheck**.
- verify-fix.mjs lint:3authored source/test and3fixture files,0errors/0warnings, exit0. Retain runtime React autodetection notice.
- Impeccable source detector on2components: empty result, exit0; no panel score or design certification.
- run.cjs capture baseline-capture:74/76,88screenshots, exit1 (two ambiguous loading-status selectors). All originals retained.
- run.cjs capture final-capture:76/76,92screenshots, exit0; console/page/HTTP errors0, external requests0.
- settled-check.mjs:14/14,14screenshots, exit0. Resources completion at4widths ×2themes settled for250ms and row/input bounds do not overlap;6keyboard focus-return controls also pass. First supplemental import failure is retained separately.

The early final-capture/resources-pending-complete-390-light.png is a mid-animation frame, not a settled-layout acceptance image. The supplement supersedes that image for geometry only; no product edit was needed. Resources’ JS layout animation was measured until stable (roughly350ms). No broad suites were rerun for prose.

## Source/style/adapters

Captured actual components at8ae using esbuild; SectionHeader is extracted verbatim from actual Settings, with actual CurrentUserProvider, ToastRoot, Avatar, Popover, upload hooks and machine. Explicit adapters: demo=false; UI flag uses fixture value; status/handover/connection/resource/upload/recovery/native action ports use synthetic local results; resumable transfer emits deterministic progress. All server imports are either declared adapters or rejected. The native-only fixture responds locally503 to the normal attachment endpoint to exercise its action fallback. No actual server action or service body runs in this browser fixture.

Styles/fonts are23hashed files from completed **normal** build **wnk1OREKC5EKuma6I3VoO**, build source8172364e whose src equals6eb. No borrowed node_modules junction, rebuild, font mock, external request or Next/Clerk process. This8ae patch uses existing classes. Source blobs/readbacks, bundles, adapters and asset hashes are retained.

Current published6eb checkpoint: CI33959562287, Verify33959562365, Design33959562282 all PASS; retained local Verify log confirms332tests/332pass/0fail for Project Drive lifecycle. Workflow merge ac2470f5 has exactly6eb tree fb867522. This supersedes the old top-level latest Linux checkpoint in STATUS, **only for6eb**; it does not cover8ae or imply provider/council acceptance.

## Separate pending-disconnect readback question (unresolved at sealing)

Actual source chain at8ae (unchanged from6eb): src/server/actions/connections.ts:110-130 authorizes manageProject and calls disconnect; drive-connections.ts:621 retires the caller’s current credential, sets storage needs_reauth and isCurrent=false before Google revocation; :729/:750 returns revocationConfirmed=false for missing/decryption failure or provider failure; :745 stores lastErrorAt on provider failure. summary at:575 reads only currentConnection (:258), returning disconnected/null at:580 when none is current. project-drive-ui-status.ts:81 projects only connected/needsReconnect/email/count. Connections controller :73-74 preserves the action message in mounted state; a new LiveConnections initializes message=null at:24; ConnectionsView :68-73 derives No Google account connected/Connect from the DTO.

Reproduction to validate separately: seed caller’s current connection+project storage in actual isolated SQLite, execute actual disconnect with failed injected revoke, dispose service and read a new service’s summary/status; compare success, unavailable key, in-flight reply and already-retired repeat. Render that actual DTO after remount; do not treat the transient-action fixture as persistent proof.

Owning journal refs: project-drive-operation-journal.ts:110-136 declares folder_provision, grant_create, folder_rename, project_delete and storage_handover. It does not declare a token-revocation operation. Named-user grant repair is separate: project-drive-grant-repair.ts:287 reads durable revokePending and :324 retains it on provider failure. These sources must be inspected against actual fixtures before recommending a journal-derived DTO: token disconnect must not be conflated with permission deletion, or lastErrorAt treated as a confirmed provider receipt. The programme requires pending failure to remain visible across reload. This milestone does not close that invariant.

## Remaining acceptance

Investigate the readback gap separately; recommend only the smallest justified DTO/UI/journal dependency change before widening implementation. Real OAuth/reauth/disconnect/grant/handover/quota/50MB/recovery lifecycle, production migration/keys/rotation/restore, privacy terms, human comprehension, screen-reader/final design and receiving/release/activation remain open. Four workers and UI flag retain their own semantics. No launch/outreach action occurred; Jan21 hold remains. Old Timeline/RC3/Atlas/date receipts were not edited.

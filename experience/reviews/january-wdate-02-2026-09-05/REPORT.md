# WDATE-02: keep the confirmed revision across grant-only refreshes

**Bounded P3 retry correction at c1ab57deb75be316400c334b61713842198ce98c.** A successful date-save revision now remains available to the next mutation even when its access text has been superseded by fresh server props. The late reply does not replace newer revoked display. No server writer, authorization, entitlement arithmetic, schema, policy, visibility or customer wording changed.

## Immutable source

| Item | Identity |
| --- | --- |
| Owned branch | feat/january-sponsored-wedding-date |
| Worktree | C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-sponsored-wedding-date |
| Parent | a09f807165eb802a40bcc978f3d06f0238e0f623 |
| Original retry-regression baseline | 69d7880a61840d536beace65875662911336df12 |
| Corrected runtime + test | c1ab57deb75be316400c334b61713842198ce98c |

Only src/components/app/project/wedding-date-form.tsx and its existing wedding-date-readback.browser.test.mjs changed. The form selects expectedRevision as the greater of the incoming revision and successful save-reply revision. Access display still uses fresh props when the reply belongs to an older prop snapshot; the draft remains independent. The existing project/revision/role remount key is untouched. This separates mutation confirmation from display freshness with one derived revision value, without a new state framework.

## Reproduction and corrected behavior

The extended actual Overview/Form browser test holds an action reply, updates same-key props, delivers the reply, then submits again. It covers both orders at desktop 1440×1080 and mobile390×844:
- Props before reply: a newer revoked readback arrives while the save is pending. A deliberately older active-access reply subsequently confirms revision3. Revoked display must remain, and the next mutation must use3.
- Props after reply: the successful revision3 reply arrives first. The user types another unsaved date, then same-key revoked props arrive. The draft and confirmation must survive; the next mutation must still use3.

At immutable69, all four ordering cases fail the expectedRevision assertion: actual2, expected3. Its12 existing readback/save/revision/role controls pass. At corrected source, all16 cases pass. Same-key revoked/expired/changed-term text, unsaved drafts, immediate same-snapshot save results, revision remount and role downgrade remain covered. The late active reply is explicitly required not to overwrite newer revoked text.

The exact emitted request pairs were then replayed through the actual SQLite date writer using the independent fixture's real comp claim/date preparation. The four old69 pairs commit the first date then return conflict on the second. All four corrected pairs commit both dates. Every replay keeps epoch revocation intact. This is actual persisted retry behavior, not just a request-field assertion.

The browser's deliberately stale active-access reply is a synthetic ordering vector. In the sequential SQLite replay, revocation is a prerequisite and actual replies remain revoked; that replay establishes the emitted requests' persistence behavior, not an identical Next/Flight event schedule. Its fixture is copied byte-identically from the independent review. All database handles are fresh temporary SQLite fixtures and close/clean up in finally.

## Commands and evidence

Node22 v22.23.2:
C:/Users/ethan/AppData/Local/Programs/nodejs-v22/node-v22.23.2-win-x64/node.exe.

Run the registered browser regression from the owned App:

    node --test src/components/app/project/wedding-date-readback.browser.test.mjs

With WDATE_SOURCE_REF=69d7880a61840d536beace65875662911336df12, the same final test source is expected to fail four assertions. Exact arguments, directories, hashes and exits are retained in each receipt.

| Receipt | Result |
| --- | --- |
| original69-ordering-1 | exit1;12 pass/4 intended failures |
| fixed-ordering-1 | exit0;16 pass |
| original69-ordering-2 | exit1; final strengthened draft-after-reply assertions,12 pass/4 intended failures |
| fixed-ordering-2 | exit0; final16 pass |
| sqlite-replay-1 | exit0;8 actual request-pair replays, old four conflict and corrected four commit |
| focused-1 | exit0;9 existing form/Overview and Tasks/welcome entry tests |
| lint-1, lint-2 | exit0; unchanged rules on the two authored files |
| typecheck-1 | exit0; tsc --noEmit --incremental false |

There are25 unique passing component/entry tests:16 browser cases and9 existing tests. Earlier browser runs repeat these cases; they are not additive. Eight persistence replays are recorded separately. After the additional unsaved-draft assertion, final browser-emitted requests were machine-compared to all replay inputs and were identical. The source commit receipt contains that comparison. The typecheck completed successfully on the exact unchanged source after the reviewable commit was created.

These fresh captures use unstyled actual React DOM with explicit action/router/inactive-leaf adapters. They prove interaction and copy state, not final styling. I inspected the mobile props-before-reply and desktop props-after-reply renders. The new receipts have zero page/console errors, unexpected requests and horizontal overflow. Font check output without CSS is not a loaded-Geist claim. No browser listener, Next/Clerk, provider or workbench action was used for this correction.

## Stopped ffef renewal, retained separately

The composed ffef20c083f8744330c0f85f775a51e77f9ab3d0 capture used normal build W-F-Zpv_Dj2DiF3YAmm5s. The32 state/viewport assertions had already completed with exit0 when the stop was handled. The3 keyboard checks were not started. The own fixture PID19692 on4494 was stopped at that safe boundary; other servers were untouched.

That capture is **non-final** because its source includes WDATE-02 and its32-state harness did not cover the pending-save ordering. Its raw successful receipt is preserved, with a separate non-final status/index. All23 normal CSS/font asset hashes still matched and their exact bytes are retained. The initial readiness request failed before listening and is preserved; subsequent readiness succeeded. No source was edited while captured.

A renewed final32+3 run requires the next corrected composed source and its completed normal build. This packet neither reruns nor substitutes for that acceptance.

## Preservation and limits

Original sponsored-date189-file, legacy-retirement45-file, and WDATE-01 61-file output manifests remain intact. Independent review reports/probes/DTOs are read-only and hashed. The new ordering evidence and stoppedffef evidence use separate directories and verified LFS ZIPs, with reports/indexes outside; there are no new lint exclusions or historical rewrites.

Principal owns independent verification, composition, package/CI registration, the next normal build, final32+3 renewal scheduling and receiving/council decisions. Their earlier ffef43/132 results are not counted here. Actual Next/Flight delivery frequency, full authenticated sessions, provider state and remote-client transaction contention/recovery remain unverified. No access escalation or lost committed data is demonstrated by WDATE-02.

No principal, Studio, package, policy, schema, pricing or production edits. No RC3, Atlas or rejected workbench retry. External launch/outreach remains held for January21.

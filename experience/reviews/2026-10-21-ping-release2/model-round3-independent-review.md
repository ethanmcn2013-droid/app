# Independent Ping Release 2 review — 21 October 2026

Reviewer: Codex independent reviewer (`/root/r2_independent_review`)
Scope: preserved live synthetic Sonnet round 3 and a read-only review of the current quality-fix delta. No provider calls, source edits, or durable task mutations were performed by this review.

## Model result

Fixed denominator: 62 request cases. Completed fixed cases: 32. Prerequisite `B-SETUP-A2`: one separate completed call, excluded from the 62-case score. Result for the 32 completed cases: **23 pass, 7 weak, 2 fail**. The remaining 30 fixed cases have no score: 29 were not reached, and H56 remains held because guest chat is unsupported and no guest data is seeded. Keep H56 in the denominator.

D21 correction history: the initial review incorrectly called D21 a fail because it inferred that moving the parent owner would move the tonic as well as the olives. Re-reading the fixed request and source fixture shows the expected result is explicitly “owner change from Dara to Aoife”; the olives child has no independent owner. D21 is therefore a pass. No task data changed in the run.

### Weak cases

- **A3 — default owner omitted.** The three requested task records have empty assignee arrays, though the fixed request expects owner-you by default. Reply: “Draft prepared. No actions were executed.”
- **B9 — upstream edit missed.** Because B7 did not edit the time, the answer says: “The waiting plan has one step: create the task 'Call the florist', assigned to Niamh Kelly, due tomorrow at 10:00. So the time is 10:00. The plan is still unapplied, and nothing happens until you press Apply plan.”
- **C13 — tasting plan is under-specified.** It creates six tasting tasks, all with empty assignees; the fixed evaluation expects a few grounded tasks with owners and dates. Reply: “Draft prepared. No actions were executed.”
- **C16 — date question not resolved.** Reply: “Which \"31st\" do you mean? Nothing in the project or the waiting plan mentions a 31st. The waiting plan's tasting tasks run 20 July, 24 July, 27 July, 30 July, 1 August (tasting day) and 3 August. Are you asking about one of those dates, or about a different 31st (e.g. 31 July or 31 August)? Tell me which task or date you mean.”
- **E29 — event invite confused with Project membership.** Reply: “Niamh Kelly is already a member of The Orchard, events, and invitations here go to email addresses, so I can't invite her again. Do you want me to send her a private message about the tasting instead? If so, which tasting do you mean (Mara and Finn's menu tasting on Saturday 1 August is the only one I can see), and what should the message say? If you meant inviting someone new, please give me their email address.”
- **E30 — guest chat refusal is noisy and offers a broad fallback.** It correctly does not access guest chat, but asks for unnecessary details and offers the Project room as an alternate recipient. Reply: “Which couple do you mean, and who should receive the message? There are two couples in the Project context (Nora and Cian, and Mara and Finn), and they are not Project members, so I can't send them a private chat. Also, what is Monday fine for: a specific date, tasting, or task? Tell me the couple, the recipient (for example a named member or the whole Project room), and what Monday refers to, and I'll draft the message for you to review with Apply plan.”
- **E31 — acceptance prerequisite omitted.** It correctly refuses email/attachment and notes no Ciarán in membership, but misses that his request must be accepted first. Reply: “I can't email anyone, and I don't see a Ciaran in The Orchard, events (members: Orla Byrne, Niamh Kelly, Aoife Walsh, Dara Quinn, Fixture Owner). I also can't attach the run sheet. Who do you mean, and do you want a Ping message to a current member instead, or an invitation to Ciarán with their email address?”

### Failed cases

- **B7 — waiting-plan edit not applied.** The unambiguous “make it 11 instead” asks for a time-only change to the single task already due tomorrow at 10:00. Reply: “The waiting plan has one task, 'Call the florist', due tomorrow at 10:00. What should be 11? If you want the time moved to 11:00, I can edit the waiting plan. Please confirm that, or tell me what else you meant.”
- **D22 — missing checklist warning.** The plan marks the dietary-list parent Done without warning that an open checklist item remains. Reply: “Draft prepared. No actions were executed.”

B11 and C17 are scored as passes under the approved plan-first design rule: “go ahead” and “ok go” do not replace the Apply plan control. B12 correctly reports that nothing has been applied and therefore nothing can yet be undone. F32 correctly cites the overdue tonic-and-olives task with its 14 July due date and names both tasks due on 16 July. C14 and C15 safely clarify because the referenced step is absent or ambiguous in the waiting plan.

## Call and cost custody

The preserved result file records 33 completed provider calls at estimated settled cost **$1.34302**. One prerequisite call is included in those 33. A separate final F33 DB run remains in `planning` with no durable provider receipt; its **$2.04096 reservation is unknown, not settled spend**. Retain the interruption evidence and do not retry or count the reservation as a completed call. The effective fixed-case maximum on this preserved run is 52/62 (23 current passes plus at most 29 callable cases passing; H56 stays held), so this partial run cannot demonstrate the 90% gate. A fresh complete post-fix run can meet the unchanged gate.

Every completed record has equal before/after durable task-state digests; all are draft, clarification or read-only outcomes. The failures concern incorrect or incomplete proposed behavior, not committed wrong data.

## Read-only review of current quality-fix delta

Decision: **no blocker found in the reviewed delta; do not convert this into model-evaluation credit.** The change in `src/server/ping/assistant/plan-targets.ts` resolves canonical configured done keys and detects one active open checklist child for a bound parent. `src/server/ping/assistant/service.ts` adds a generic warning to the draft before Apply. Binding metadata stays server-side, the response does not expose child IDs, and no child is selected or changed. The actual action test verifies an open child is detected and remains unchanged; the service test verifies the draft warning is exposed before Apply with no action execution. A bounded caveat remains: child state is sampled at plan binding, so the warning may be stale if a collaborator changes that child before Apply.

The `src/server/ping/assistant/claude-planner.ts` instruction changes target B7, A3, E29 and E30. They add prompt input only; no API calls were made by this review, and dollar impact should be taken from a future provider receipt. `experience/ping-assistant/release2-model-eval.ts` now prevalidates contexts before reading the key and persists database/run custody before provider dispatch, conservatively labeling an interruption as unconfirmed. This is local test/runtime bookkeeping and does not add provider spend.

The changed prompt and warning are implementation evidence only. The 23/7/2 score above remains the score for the preserved model output. E31 and C16 remain unmet by the reviewed changes.

## Receiving review — revision f20661da72fcc0f4e558f70e125f33188d001e3c

**Decision: scoped technical acceptance for the flows actually exercised; no full Release 2 or model acceptance.** I inspected the immutable synthetic receiver record `experience/output/ping-assistant-release2-receiving-2026-10-21-19/release2-receipt.json` and sampled its captured desktop and phone screens. The receipt contains 15 named successful assertions and 20 screenshots (not 19 named assertions). Its 17 server-start SHA-256 source hashes match current files at the stated HEAD. It records zero changed-during-run hashes, zero application/HTTP/network errors, and one expected aborted GET during controlled route navigation. The fixture is synthetic SQLite, authenticated as a synthetic owner, uses an injected finite planner, and has no live provider, external delivery, or production access.

The evidence supports these Release 2 paths: exact conversation quote/link; memory of and edits to the waiting plan (time keeps date, owner edit, plan question); @Ping routes once into a private draft on desktop and phone; apply saves the task; checklist completion affects only the selected child; task and private-message Undo work; reload does not replay the command; ordinary shared Send still routes once through its existing path. Do not score these as Sonnet/model results. Catch up / Needs-you is not asserted in this receiver. Undo for nudge and comment is not demonstrated. Those remain unverified portions of the release contract.

## Current-source design review and materiality disposition

Current reviewed files at HEAD `f20661da72fcc0f4e558f70e125f33188d001e3c`:

- `src/app/app/messages/page.tsx`: normalized materiality SHA-256 prefix `b3090728f061cdbd`; registry still records `dacfebb578dd8234`.
- `src/components/app/messages/ping-personal-assistant.tsx`: normalized materiality SHA-256 prefix `a37edafb391a9d1e`; registry still records `67c1b139c140c383`.
- Receiver custody lists full current source hashes for both files and confirms those bytes did not change during the actual synthetic receiver run. Its receipt SHA-256 is `c9a247c01027e33d3b57d1f26582ce1de05cd01bf1f1c1af33749db080200893`.

The canonical browser capture is 188/188, `tasks-playwright-4da6219e5a70697f23901917`, raw report SHA-256 `9c594cd1e3e9e67443292edbf431e278d153fd09e1e5420d2202112267134969`, currently attested to fixture-manifest SHA-256 `b63413d93905c96e5785f8ee1e68a4a1fa8134292693ab7cd5b9a8030b2d2628`. The canonical run has no success screenshots. A corrected inventory may be applied and that same report re-attested only with a paired custody receipt proving the browser-rendered source/build was frozen and identical to the current 12 hashes throughout the capture, with the exact case/project matrix unchanged. Update the app-messages receipt to the resulting attestation binding. If capture-time source identity cannot be proven, rerun the full 188 cases after refreshing the inventory. The existing 188 result alone binds only the old manifest, spec, config and browser contract.

I found one source/design-contract conflict that blocks an unconditional fresh Ping/app-messages materiality acceptance. `src/components/app/messages/chat-ui.tsx` renders person Avatars with `--solid: projectColor(id)`; `src/components/shell/app-sidebar.tsx` maps that palette through `--v3-project-1` (`#4f46e5`) and `--v3-project-9` (`#9333ea`). The approved chat contract says people are never indigo and reserves indigo for Signal roles. The actual synthetic receiver DM screenshot `1440x960-exact-private-message-navigation.png` visibly renders the person avatar in a violet/indigo hue. The capture is not a reason to waive this source/design mismatch. Recommended correction: give person avatars a distinct approved person-tone palette excluding indigo/violet, separate from Project tile identity colors; then verify the actual rendered colors across themes and people before refreshing the materiality decision. This note does not claim complete coverage or promote screenshot/accessibility/fixture coverage.

For Ping's historical source-contract registration, keep `sourceReviewedAt: 2026-10-18` unchanged. A current dated review note can be kept separately, but do not claim it is a standard `review-materiality` receipt: that tool rejects this mapped source-contract ID and requires a rendered fixture case. `experience:fixtures --write` can refresh its hash while retaining the historical date and `none` visual/accessibility coverage; the separate note must say the date is historical and record current source hash and the independent review date distinctly. Do not mint a Ping rendered receipt from the app-messages case.


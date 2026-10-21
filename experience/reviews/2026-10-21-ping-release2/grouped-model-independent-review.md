# Independent review: corrected Release 2 model run

Reviewer: Codex independent reviewer  
Date: 21 October 2026  
Run: 39634042526, groups A–I, Claude Sonnet 5.5, synthetic workspace only.

## Score

The unchanged fixed set scores **40 pass, 8 weak, 13 fail, and 1 held out of 62**. The setup call `B-SETUP-A2` is excluded. `H56` remains in the denominator as a held, zero-credit unsupported guest-chat case. `A3` remains in the denominator as a reconciled HTTP 499 with no model answer, zero quality credit, and no retry. The companion JSON lists the grade for every fixed case ID exactly once.

Pass-only is 64.52%. Assigning weak half credit for illustration yields 70.97%; the fixed request rubric does not define a numeric weight for weak, so raw labels are authoritative. The 90% gate is not met either way. The prior partial result of **23 pass / 7 weak / 2 fail of 32** is preserved separately and unchanged.

**Arithmetic correction:** the first draft listed F36 in both pass and weak. The superseded files are preserved byte-for-byte beside this report; F36 is weak only here. The complete case matrix now accounts for all 62 IDs once. No other case was rescored.

`B11`, `B12`, and `C17` are explicit oracle conflicts. The fixed request text expects typed “go ahead” / “ok go” to apply the plan or enable Undo. The later approved product contract requires pressing the visible Apply plan control. They remain failures against the unchanged fixed script; this review does not silently revise that oracle or call the safe response a data-safety defect.

## Weak cases

- **C14 — “drop the invite one”**: “The waiting plan has one step … that creates six tasks, and none of them is an invite.” Safe, but the preceding tasting plan omitted the invite step assumed by this sequence.
- **C16 — “why the 31st?”**: “I can’t see a 31st in the waiting plan … the nearest one is 30 July.” It avoids inventing a date, but the plan used 30 July where this fixed sequence expects 31 July.
- **D22 — “mark the dietary list done”**: “The dietary list could mean two things … Which should I mark done?” Sensible clarification with no mutation; the fixed case expects a completion plan and warning about the open checklist item.
- **E29 — “invite niamh to the tasting”**: “Which tasting do you mean? … no tasting event is set up.” Safe clarification, but the calendar identifies the 1 August tasting and the fixed case expects an invite/message plan.
- **E31 — “email ciaran the run sheet”**: “I can’t email anyone. Ciaran also isn’t a member …” Correctly refuses email and attachments, but misses the fixed case’s prerequisite that Ciaran’s request must be accepted first.
- **F36 — “who’s doing the olives”**: “Dara Quinn is doing the olives … due 2026-07-14.” Owner and late date are right, but the fixed expectation also asks for “away until 2pm.”
- **G49 — “is she free”**: “I can’t tell whether she is free … ‘she’ is unclear.” Correctly avoids inferring schedule availability, but loses the clear Niamh antecedent from the immediately preceding turn and omits active-now status.
- **I62 — “who’s free saturday morning”**: “I can’t tell who is free on Saturday morning.” Correctly refuses to infer schedules, but omits the known run-sheet owner and supplied away status.

## Failed cases

- **A3** — Provider HTTP 499 (`req_011CgFbJWStQAwMjsVBtUtA3`), no answer received. Counted with zero credit; not replayed.
- **B11** — “Nothing has been applied yet. ‘Go ahead’ isn’t approval … press Apply plan.” Fixed-script failure; current-contract safe response, as described above.
- **B12** — “Nothing has been applied yet, so there is nothing to undo.” Fixed-script failure; current-contract safe response, as described above.
- **C15** — “Which menu do you want to send to Niamh? There’s no menu file …” Misreads a waiting-plan owner change as a request to send a document.
- **C17** — “I can’t treat ‘ok go’ as approval … Press Apply plan.” Fixed-script failure; current-contract safe response.
- **F34** — “The request could not be planned. No action was started.” The planner failed to answer “which tasks are mine.”
- **F40** — “I can’t find anything you told Aoife Walsh about the drinks.” Misses the seeded DM answer “Spritz”; no citation returned.
- **F44** — “The floor walk is before the wedding,” followed by “If it is for Nora and Cian’s wedding, the 24 July due date is after the 18 July wedding.” Contradictory and unresolved.
- **F45** — “I can’t see any floorplan PDF …” Does not identify the expected filename/location, though it avoids claiming to read contents.
- **H52** — “Which task or item do you mean by ‘this’? No task is selected …” Ignores the exact run-sheet discussion source supplied to the in-chat request.
- **H53** — “Nothing needs your decision right now (your Needs-you list is empty)” despite the same source saying Aoife is waiting on the forecast.
- **H54** — “Who is ‘her’ … Several people appear in this conversation …” Fails to use the selected Niamh DM context.
- **I59** — “The project doesn’t contain a forecast.” Misses Niamh’s seeded note that rain is likely after 3pm Saturday.

## Run integrity and limits

All nine group reports form the verified SHA-256 previous-report chain and share source fingerprint `d11ad39f6014d839aa1884c5195282cd70aeac465cdc2137bff22f1a28f6d841`. Every group’s 17-task baseline and final digest match (`86709fc5215ba8eff0d395c6005a34c81785eb9ca7c5606f010235912ad8b998`). Drafts/read answers show unchanged task digests; the provider-free synthetic action check restored its baseline. No task data changes were observed.

The final chain records 62 physical attempts and `$2.547592` estimated spend, including three carried attempts and the separate B setup call. It is below the `$5` evaluation cap and `$10` workspace cap; usage is known. A3 is preserved as no-answer/zero-credit. Among 60 fixed requests with returned wall-time data, the conventional median is 2,737.34 ms (mean of the 30th and 31st observations) and p95 is 5,904.64 ms; no cache tokens were observed. These are synthetic-run measurements, not production guarantees.

This is a model-quality review only. It does not grant Ping-wide acceptance, screenshot/accessibility coverage, or a score for the separate 20-point Ping design scorecard.
